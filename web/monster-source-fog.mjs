/* SPDX-License-Identifier: GPL-2.0-or-later
 * Isolated source mode2 fog binding for an actor comparison. No inferred/default
 * time, phase search, actor depth, or transfer of static-map lighting to actors.
 * Existing fog modules retain their original DeSmuME-derived notices.
 */
import {readRomMode2Environment} from './map-browser-preview/mode2-environment.mjs';
import {Narc} from './map-browser-preview/vendor/narc-source.js';
import {Compression,BufferReader} from './map-browser-preview/vendor/nitro-fs.mjs';
import {parseCalls} from './map-browser-preview/vendor/call-stream.mjs';
import {lowerEnvironmentFog,inheritTimeFogRecords} from './map-browser-preview/native/fog-records.mjs';
import {evaluateMode2FogState} from './map-browser-preview/native/mode2-fog-state.mjs';
import {buildFogTable} from './map-browser-preview/native/fog-raster.mjs';
const need=(ok,why)=>{if(!ok)throw Error(why);};
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
const FRAME_KEYS=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
function frameCopy(value){
 need(value&&typeof value==='object','Explicit frozen actor/background frame binding required');
 need(/^[a-f0-9]{64}$/.test(value.romSHA256??'')&&/^[a-f0-9]{64}$/.test(value.fullRGBA_SHA256??''),'Frozen ROM/pixel SHA256 required');
 need(typeof value.recordKey==='string'&&value.recordKey&&typeof value.sourceId==='string'&&value.sourceId,'Frozen map/source identity required');
 need(['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)&&Number.isFinite(value.mediaTime)&&value.mediaTime>=0,'Frozen source epoch/timeline/PTS required');
 return Object.fromEntries(FRAME_KEYS.map(k=>[k,value[k]]));
}
/** All inputs are required and must come from the same already-frozen frame.
 * `frame` identifies actor evidence and `backgroundFrame` independently identifies
 * the source of the supplied photometry inputs. The caller owns ROM SHA checking.
 * This returns a source LUT; the caller must supply ACTOR fragment depth and fog
 * membership to applyFogPixel. A float projection is still an approximate raster,
 * not native fragment acceptance. Background depth must not stand in for actors.
 */
export function readFrozenMonsterFog({project,record,inputs,frame,backgroundFrame}={}){
 const actor=frameCopy(frame),background=frameCopy(backgroundFrame);
 need(FRAME_KEYS.every(k=>actor[k]===background[k]),'Actor/fog inputs are from different frozen frames');
 need(record?.key===actor.recordKey&&record.source,'Frozen map record differs from actor/fog input');
 need(inputs&&typeof inputs==='object'&&Object.hasOwn(inputs,'fogWriterEnabled'),'Explicit same-frame fog writer and state inputs required');
 const savedInputs=structuredClone(inputs),environment=readRomMode2Environment(project,record);
 need(environment.source.callIndex===record.source.callIndex&&environment.source.callOffset===record.source.callOffset,'Source environment map binding differs');
 const archive=Narc.load(new Uint8Array(project.nfs.readFile(environment.source.archive)));
 need(archive.fnt.getFilenameOf(environment.source.archiveIndex)===environment.source.member,'Source fog member differs');
 let bytes=archive.files[environment.source.archiveIndex];
 if(bytes[0]===16)bytes=new Uint8Array(Compression.decompress(new BufferReader(bytes.buffer,bytes.byteOffset,bytes.byteLength)));
 const lowered=lowerEnvironmentFog(parseCalls(bytes));
 need(lowered.ready&&lowered.mode===2,'Explicit source mode2 fog records required');
 const inherited=inheritTimeFogRecords(lowered.records),fog=evaluateMode2FogState({sdk:project.sdk,inheritedRecords:inherited.records,rules:environment.rules,inputs:savedInputs});
 need(fog.ready,fog.reason??'Source fog state unsupported');
 const table=buildFogTable(fog.parameters),snapshot=deepFreeze({kind:'same-frame-source-mode2-actor-fog',frame:actor,inputs:savedInputs,environmentSource:structuredClone(environment.source),selection:structuredClone(fog.selected),nativeSourceEvidence:structuredClone(fog.evidence??null)});
 return {ready:true,parameters:structuredClone(fog.parameters),table,snapshot,actorDepthProvided:false,actorFogMembershipProvided:false,currentEnvironmentCertified:false,nativeActorPixelsCertified:false,minimumProvenATCalls:0,scope:'Exact source fog parameters/LUT for supplied frozen state; no actor placement, fragment depth, material fog mask, raster acceptance, current-state certainty or visibility proof.'};
}
