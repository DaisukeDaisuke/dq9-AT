import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readMonsterWorkflowEncounterContexts,monsterMapWorkflowEligibility,createAutomaticMonsterMapGate} from '../web/map-browser-preview/automatic-monster-map-eligibility.mjs';
import {AutomaticVideoAlignment} from '../web/map-browser-preview/automatic-video-alignment.mjs';
import {VideoMapContinuity} from '../web/map-browser-preview/video-map-continuity.mjs';
import {VideoObservationTimeline} from '../web/map-browser-preview/video-observation-timeline.mjs';
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;},equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
// Synthetic command streams exercise framing and support boundaries only.
function stream(commands){
 const poolBytes=[...new TextEncoder().encode('fixture\0')],parts=commands.map(([opcode,values,types=values.map(()=>1)])=>{
  const start=(3+Math.ceil(values.length/4)+3)&~3,b=Buffer.alloc(start+values.length*4);b.writeUInt16LE(opcode);b[2]=values.length;
  values.forEach((value,i)=>{b[3+(i>>2)]|=types[i]<<((i&3)*2);if(types[i]===2)b.writeFloatLE(value,start+i*4);else b.writeUInt32LE(value>>>0,start+i*4);});return b;
 });
 const end=16+parts.reduce((n,b)=>n+b.length,0),pool=(end+15)&~15,bytes=Buffer.alloc((pool+poolBytes.length+15)&~15,255);
 bytes.writeUInt32LE(commands.length,0);bytes.writeUInt32LE(pool,4);bytes.writeUInt32LE(poolBytes.length,8);bytes.writeUInt32LE(2,12);let p=16;for(const part of parts){bytes.set(part,p);p+=part.length;}bytes.set(poolBytes,pool);return bytes;
}
const metadata=[[101,[0],[0]],[100,[0],[0]]],group=(id,condition=[0,0,0,0])=>[105,[id,...condition]],table=(id,flags)=>[[104,[id]],[102,[flags]],[103,[123,1]]];
const commands=[...metadata,group(10),...table(1,0x123456),...table(2,0xf0f0),group(20,[1,2,3,4]),...table(3,7),group(20),...table(4,9)];
const bytes=stream(commands),project=b=>({nfs:{readFile:path=>{equal(path,'data/prm/encfld.bin','only encounter-context file read');return b;}}});
const source=readMonsterWorkflowEncounterContexts(project(bytes));equal(source.status,'decoded');equal(source.source.summary,{maps:2,groups:3,rows:4});
const admitted=monsterMapWorkflowEligibility(source,20);equal(admitted.status,'eligible');equal(admitted.skipBackground,false);equal(admitted.groups,source.contexts.groups.filter(g=>g.mapId===20),'conditional and unconditional branches retained');
const absent=monsterMapWorkflowEligibility(source,30);equal(absent.status,'no-encfld-group');equal(absent.skipBackground,true);equal(absent.absenceCertified,false);equal(absent.monsterPresenceKnown,false);equal(absent.minimumProvenATCalls,0);equal(absent.mapCandidateRetained,true);
equal(monsterMapWorkflowEligibility(source,'20').status,'unknown','invalid map identity is unknown');
const missing=readMonsterWorkflowEncounterContexts({nfs:{readFile(){throw Error('Missing encfld file');}}});equal(missing.status,'unknown');equal(monsterMapWorkflowEligibility(missing,30).skipBackground,false);
const mutationCases=[
 ['truncated header',bytes.subarray(0,12)],
 ['truncated pool',bytes.subarray(0,bytes.readUInt32LE(4)+bytes.readUInt32LE(8)-1)],
 ['zero calls',(()=>{const b=Buffer.from(bytes);b.writeUInt32LE(0);return b;})()],
 ['omitted tail call',(()=>{const b=Buffer.from(bytes);b.writeUInt32LE(commands.length-1);return b;})()],
 ['too many calls',(()=>{const b=Buffer.from(bytes);b.writeUInt32LE(commands.length+1000);return b;})()],
 ['pool inside commands',(()=>{const b=Buffer.from(bytes);b.writeUInt32LE(32,4);return b;})()],
 ['unsupported header',(()=>{const b=Buffer.from(bytes);b.writeUInt32LE(3,12);return b;})()],
 ['unterminated string',(()=>{const b=Buffer.from(bytes);b.fill(65,b.readUInt32LE(4));return b;})()],
 ['unknown opcode',stream([...commands,[106,[]]])],
 ['unknown argument type',stream([...metadata,[105,[30,0,0,0,0],[3,1,1,1,1]],...table(1,0)])],
 ['missing flags',stream([...metadata,group(30),[104,[1]],[103,[123,1]]])],
 ['missing entries',stream([...metadata,group(30),[104,[1]],[102,[0]]])],
 ['missing group rows',stream([...metadata,group(30)])],
 ['table before group',stream([...metadata,...table(1,0)])],
 ['flags before table',stream([...metadata,group(30),[102,[0]]])],
 ['empty group set',stream(metadata)],
 ['extra group shape',stream([...metadata,[105,[30,0,0,0,0,0]],...table(1,0)])],
 ['duplicate flags',stream([...commands,[102,[0]]])],
];
for(const [name,data]of mutationCases){const parsed=readMonsterWorkflowEncounterContexts(project(data));equal(parsed.status,'unknown',name);equal(monsterMapWorkflowEligibility(parsed,30).skipBackground,false,name+' retains route');}
let reads=0;const cachedGate=createAutomaticMonsterMapGate({nfs:{readFile(){reads++;return bytes;}}});const first=cachedGate(20);first.groups[0].condition[0]=999;equal(cachedGate(20).groups[0].condition[0],1,'returned diagnostics cannot mutate cached source');cachedGate(30);equal(reads,1,'read once per ROM project gate');
const stamp={sourceId:'synthetic-source',sourceEpoch:1,timelineSegment:0,frameSerial:1,mediaTime:12.5,timestampBasis:'test-only',fullRGBA_SHA256:'1'.repeat(64)};
const input={automaticRecognition:true,frameId:1,frameEvidence:stamp,layout:'single',sourceImage:{width:256,height:192,rgba:new Uint8ClampedArray(256*192*4)}};
const records=[10,20,30].map(mapId=>({key:'map:'+mapId,mapId,fieldCode:'synthetic',displayLabel:'synthetic '+mapId,minimapCandidates:[]}));
function alignment(gate=cachedGate){
 const sceneCalls=[],a=Object.create(AutomaticVideoAlignment.prototype);
 Object.assign(a,{project:{},rom:null,romSHA256:'2'.repeat(64),catalog:{},records,matcher:{},monsterMapGate:gate,referenceCache:{cache:new Map(),cacheBytes:0},scenes:new Map(),sceneHits:0,sceneMisses:0,imageHits:0,imageMisses:0,scene(record){sceneCalls.push(record.mapId);throw Error('fixture reached existing scene route');}});
 return{a,sceneCalls};
}
const originalNames={maps:structuredClone(records)},before=structuredClone(originalNames),mixed=alignment();const result=await mixed.a.search({input,names:originalNames});
equal(mixed.sceneCalls,[10,20],'only eligible maps reach scene preparation');equal(originalNames,before,'candidate list unchanged');equal(result.diagnostics.monsterWorkflow.skippedCount,1);equal(result.diagnostics.monsterWorkflow.unknownCount,0);equal(result.diagnostics.mapCandidates.length,3);equal(result.selected,null);equal(result.diagnostics.minimumProvenATCalls,0);equal(result.diagnostics.inputFrame,stamp);
const blocked=alignment();const skipped=await blocked.a.search({input,names:{maps:[records[2]]},prevalidatedMaps:{get selections(){throw Error('must not read scene/minimap prevalidation for skipped map');}}});equal(blocked.sceneCalls,[]);equal(skipped.diagnostics.monsterWorkflow.allSkipped,true);equal(skipped.diagnostics.backgroundCandidates,[]);equal(skipped.backgroundBranchSupport.ready,false,'skip is not successful background recognition');
const manual=alignment();await manual.a.search({input:{...input,automaticRecognition:false},names:{maps:[records[2]]}});equal(manual.sceneCalls,[30],'explicit background preview remains available');
const unknown=alignment(id=>monsterMapWorkflowEligibility(missing,id));const unresolved=await unknown.a.search({input,names:{maps:[records[2]]}});equal(unknown.sceneCalls,[30]);equal(unresolved.diagnostics.monsterWorkflow.unknownCount,1);equal(unresolved.diagnostics.monsterWorkflow.allSkipped,false);
const missingRecord=alignment();const missingResult=await missingRecord.a.search({input,names:{maps:[{key:'missing',mapId:999}]}});equal(missingResult.diagnostics.monsterWorkflow.unknownCount,1);equal(missingResult.diagnostics.monsterWorkflow.allSkipped,false);
await assert.rejects(()=>alignment().a.search({input,names:originalNames,isCurrent:()=>false}),{name:'AbortError'});checks++;
let current=true;await assert.rejects(()=>alignment().a.search({input,names:{maps:[records[2]]},isCurrent:()=>current,onProgress:async()=>{current=false;}}),{name:'AbortError'});checks++;
const timeline=new VideoObservationTimeline();timeline.begin(stamp,{frameSerial:1,pixelHash:stamp.fullRGBA_SHA256,panelPresent:true});timeline.maps(1,[],{mapNameCandidates:records.map(r=>({recordKey:r.key,mapId:r.mapId})),mapSearchDiagnostics:result.diagnostics.mapCandidates,monsterWorkflow:result.diagnostics.monsterWorkflow});const frame=timeline.snapshot().frames[0];equal(frame.sourcePTS,12.5);equal(frame.mapHypothesisProvenance.candidates.map(r=>r.mapId),[10,20,30]);equal(frame.monsterWorkflow.candidates[2].status,'no-encfld-group');equal(frame.mapHypothesisProvenance.absenceCertified,false);
const continuity=new VideoMapContinuity(),c=alignment();continuity.entry={key:continuity.key(input,c.a.romSHA256),evidence:{maps:[records[2]]},originFrame:stamp};equal(await continuity.probe({input,alignment:c.a}),null);equal(c.sceneCalls,[],'cached name candidate cannot bypass gate');
for(const name of ['preview.mjs','gpu-file-preview.mjs']){const text=await fs.readFile(new URL('../web/map-browser-preview/'+name,import.meta.url),'utf8');ok(text.includes('monsterWorkflow:result.diagnostics.monsterWorkflow'),'timeline metadata in '+name);ok(text.includes('result.diagnostics.monsterWorkflow?.allSkipped'),'purpose-skip display in '+name);}
console.log(JSON.stringify({checks,malformedOrUnsupportedCases:mutationCases.length,status:'passed',scope:'Synthetic parser, admission, route reachability, cancellation, candidate/timestamp preservation and explicit preview isolation. No browser render or all-input recognition claim.'},null,2));
