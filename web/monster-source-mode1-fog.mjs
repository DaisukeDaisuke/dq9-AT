/* SPDX-License-Identifier: GPL-2.0-or-later
 * Source mode1 fog for the actor's own accepted fragments. No scene fabrication,
 * live phase inference, background depth substitution, or map GX COLOR tint.
 * Existing fog modules retain their original DeSmuME-derived notices.
 */
import {readMode1SourceFogEnvironment} from './map-browser-preview/automatic-material-environment.mjs';
import {buildFogTable} from './map-browser-preview/native/fog-raster.mjs';

const need=(ok,why)=>{if(!ok)throw Error(why);};
const FRAME_KEYS=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const PROFILE='conditional-ROM-initial-ordinary-mode1';
function frameCopy(value){
 need(value&&typeof value==='object','Explicit frozen actor/background frame binding required');
 need(/^[a-f0-9]{64}$/.test(value.romSHA256??'')&&/^[a-f0-9]{64}$/.test(value.fullRGBA_SHA256??''),'Frozen ROM/pixel SHA256 required');
 need(typeof value.recordKey==='string'&&value.recordKey&&typeof value.sourceId==='string'&&value.sourceId,'Frozen map/source identity required');
 need(['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)&&Number.isFinite(value.mediaTime)&&value.mediaTime>=0,'Frozen source epoch/timeline/PTS required');
 return Object.fromEntries(FRAME_KEYS.map(k=>[k,value[k]]));
}
function immutable(value){
 if(ArrayBuffer.isView(value))return Object.freeze(Array.from(value));
 if(Array.isArray(value))return Object.freeze(value.map(immutable));
 if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,immutable(v)])));
 return value;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function parametersCopy(p){
 need(p&&typeof p.enabled==='boolean'&&typeof p.alphaOnly==='boolean','Explicit boolean source fog enable/alpha mode required');
 need(Number.isInteger(p.shift)&&p.shift>=0&&p.shift<=15&&Number.isInteger(p.offset)&&p.offset>=0&&p.offset<=0x7fff&&Number.isInteger(p.color)&&p.color>=0&&p.color<=0xffffffff,'Explicit source fog register values required');
 need((Array.isArray(p.density)||p.density instanceof Uint8Array)&&p.density.length===32&&Array.from(p.density).every(x=>Number.isInteger(x)&&x>=0&&x<=255),'Explicit 32-byte source fog density required');
 return {enabled:p.enabled,alphaOnly:p.alphaOnly,shift:p.shift,offset:p.offset,color:p.color,density:Array.from(p.density)};
}
function sourceCopy(source){
 need(source&&source.maplist,'Background source environment identity required');
 return {maplist:Object.fromEntries(['name','callIndex','callOffset','argument','consumer'].map(k=>[k,source.maplist[k]])),
  archive:source.archive,member:source.member,archiveIndex:source.archiveIndex};
}
function hypothesisCopy(h,record,environment){
 need(h&&h.kind==='source-mode1-retained-ordinary-load-state'&&h.recordKey===record.key,'Explicit matching retained ordinary mode1 hypothesis required');
 need(Number.isInteger(h.index)&&h.index>=0&&h.index<4,'Mode1 ordinary index must be explicit 0..3');
 need(h.sourceStateObserved===false&&h.currentEnvironmentCertified===false,'Mode1 ordinary hypothesis must remain conditional, not observed/certified');
 need(same(h.selection,environment.selection)&&same(h.updateSpans,environment.updateSpans),'Retained ordinary selection/update proof differs from ROM');
 return {kind:h.kind,recordKey:h.recordKey,index:h.index,selection:structuredClone(environment.selection),updateSpans:structuredClone(environment.updateSpans),sourceStateObserved:false,currentEnvironmentCertified:false};
}

/**
 * inputs = {profile:'conditional-ROM-initial-ordinary-mode1', fogWriterEnabled:true,
 *           sourceEnvironment: branch.sourceEnvironment}.
 * For an invariant legacy background, sourceEnvironment is
 * {fogApplied:background.fogApplied, fog:background.rendererEvidence.integer.fog}.
 * The caller independently freezes both identities and verifies that project is
 * opened from frame.romSHA256. This synchronous helper checks ROM instructions,
 * map identity, source member and every parameter against those source records.
 * It does not hash the entire original ROM or infer initial/live execution state.
 * Apply only through the native actor renderer's own accepted fragment depth and
 * source polygon fog bit; this return value contains no map COLOR/light state.
 */
export function readFrozenMonsterMode1Fog({project,record,inputs,frame,backgroundFrame}={}){
 const actor=frameCopy(frame),background=frameCopy(backgroundFrame);
 need(FRAME_KEYS.every(k=>actor[k]===background[k]),'Actor/fog inputs are from different frozen frames');
 need(record?.key===actor.recordKey&&record.source,'Frozen map record differs from actor/fog input');
 need(inputs?.profile===PROFILE&&inputs.fogWriterEnabled===true,'Explicit conditional initial-ordinary mode1 fog writer profile required');
 need(Object.keys(inputs).every(k=>['profile','fogWriterEnabled','sourceEnvironment'].includes(k)),'Mode1 fog does not accept inferred live phase/time/selector inputs');
 const supplied=inputs.sourceEnvironment;
 need(supplied?.fogApplied===true&&supplied.fog,'Explicit same-frame applied background source fog required');
 need(supplied.mode2Inputs==null,'Mode2 state cannot select retained mode1 fog');
 const environment=readMode1SourceFogEnvironment(project,record),fog=supplied.fog;
 need(same(sourceCopy(fog.source),sourceCopy(environment.source)),'Background/source fog member or map binding differs');
 need(fog.timeIndependent===environment.fogTimeIndependent,'Background ordinary fog invariance differs from ROM');
 let hypothesis=null;
 if(fog.discreteOrdinaryHypothesis!=null)hypothesis=hypothesisCopy(fog.discreteOrdinaryHypothesis,record,environment);
 if(supplied.mode1!=null){const other=hypothesisCopy(supplied.mode1,record,environment);need(hypothesis&&same(hypothesis,other),'Background mode1/fog hypotheses differ');}
 need(environment.fogTimeIndependent||hypothesis,'Differing ordinary fog records require an explicit retained index; no live phase inferred');
 const parameters=environment.fogTimeIndependent?environment.fogParameters:environment.fogOrdinaryParameters[hypothesis.index];
 const exact=parametersCopy(parameters);
 need(same(parametersCopy(fog.parameters),exact),'Background/source mode1 fog parameters differ');
 const table=buildFogTable(parameters);
 const snapshot=immutable({kind:'same-frame-source-mode1-actor-fog',profile:PROFILE,frame:actor,backgroundFrame:background,
  inputs:{profile:PROFILE,fogWriterEnabled:true,sourceEnvironment:{fogApplied:true,fog:{parameters:exact,source:sourceCopy(environment.source),timeIndependent:environment.fogTimeIndependent,discreteOrdinaryHypothesis:hypothesis}}},
  environmentSource:sourceCopy(environment.source),selection:hypothesis??{kind:'all-four-ordinary-fog-records-equivalent',indices:[0,1,2,3]},
  nativeSourceEvidence:environment.evidence,sourceStateObserved:false,currentEnvironmentCertified:false,
  unknownAlternatives:['Forced/progression selectors','Differing load/entry records','Later script writes, transitions and reload history']});
 return {ready:true,parameters:structuredClone(parameters),table,snapshot,actorDepthProvided:false,actorFogMembershipProvided:false,
  mapColorTintApplied:false,currentEnvironmentCertified:false,nativeActorPixelsCertified:false,minimumProvenATCalls:0,
  scope:'Exact ROM source fog parameters/LUT conditional on the supplied frozen initial ordinary hypothesis. No live state, actor depth, material fog mask, fragment acceptance, visibility or AT proof.'};
}
