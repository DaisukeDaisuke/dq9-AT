import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareVideoReplaySources} from '../web/video-replay-source-preparation.mjs';
import {prepareFieldSpawnTables} from '../web/field-spawn-source.mjs';
import {mineCreatorResources} from '../web/monster-creation-resources.mjs';
import {mineFieldGraphs,fieldPathName} from '../web/field-graph.mjs';
import {decodeCalls} from '../web/map-core.mjs';
import {openMapRom} from '../web/map-browser-preview/static-scene.mjs';
import {buildRomMapCatalog} from '../web/map-browser-preview/rom-map-catalog.mjs';
import {createVideoTrackingAT} from '../web/map-browser-preview/video-tracking-at.mjs?v=browser-at-20261008-138417cd';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=async(f,name)=>{await assert.rejects(f,name?{name}:undefined);checks++;};
const hash=b=>createHash('sha256').update(b).digest('hex');
const romSHA256='a'.repeat(64),frame=(t,key)=>({romSHA256,sourceId:'synthetic-video',sourceEpoch:1,timelineSegment:2,sourcePTS:t,frameKey:key});
const input={schema:'conditional-video-replay-input-v1',source:frame(2,'after'),targetFrame:frame(3,'target'),entryWitnessFrames:{before:frame(1,'before'),after:frame(2,'after')},map:{recordKey:'map:0:16',mapId:7,fieldCode:'F01'},mapIdentityCertified:false,entryCertified:false,initialSeed:null,initialSeedInferred:false,cadence:null,ATCallRange:null,nativeRuntimePacketConstructed:false,minimumProvenATCalls:0};
const search=(inputs=[input])=>({schema:'automatic-conditional-replay-input-search-v1',inputs:structuredClone(inputs),complete:true,retention:{allCompatibleInputsRetained:true},stats:{compatiblePairs:inputs.length},unknownBranch:{retained:true,reason:'unchanged unknown'}});
const record={key:'map:0:16',mapId:7,fieldCode:'F01',source:{path:'data/map/maplist9.bin',callIndex:0,callOffset:16}};
const noFiles={romSHA256,catalog:{maps:[record]},project:{nfs:{readFile:p=>{throw Error('Unavailable synthetic '+p);}}}};
const before=search(),out=await prepareVideoReplaySources(before,noFiles,{yieldTask:async()=>{}});eq(before,search());eq(out.sources.length,1);eq(out.sources[0].unsupported.map(r=>r.stage),['graph','encounters','creator']);eq(out.bindings[0].status,'conditional-static-source-partial');eq(out.sources[0].graph,null);eq(out.unknownBranch,before.unknownBranch);eq(out.currentVideoStateRecovered,false);eq(out.minimumProvenATCalls,0);
const repeated=await prepareVideoReplaySources(search([input,{...input,targetFrame:frame(4,'later')}]),noFiles,{yieldTask:async()=>{}});eq(repeated.sources.length,1);eq(repeated.bindings.map(b=>b.sourceIndex),[0,0]);eq(repeated.bindings.map(b=>b.input.targetFrame.sourcePTS),[3,4]);
const other={...input,map:{recordKey:'map:1:20',mapId:8,fieldCode:'F02'}},multi=await prepareVideoReplaySources(search([input,other]),{...noFiles,catalog:{maps:[record,{...record,key:other.map.recordKey,mapId:8,fieldCode:'F02'}]}},{yieldTask:async()=>{}});eq(multi.sources.length,2);eq(multi.bindings.map(b=>b.input.map.mapId),[7,8]);eq(multi.sources.map(s=>s.unsupported.length),[3,3]);
for(const mutate of [x=>x.map.mapId++,x=>x.map.fieldCode='OTHER',x=>x.map.recordKey='unknown',x=>x.source.romSHA256='b'.repeat(64),x=>x.targetFrame.sourceEpoch++,x=>x.entryWitnessFrames.before.sourcePTS=4,x=>x.source.frameKey='different',x=>x.targetFrame.frameKey=null,x=>x.initialSeed=0,x=>x.cadence=33,x=>x.ATCallRange={min:0,max:2},x=>x.mapIdentityCertified=true]){
 const s=search();mutate(s.inputs[0]);const r=await prepareVideoReplaySources(s,noFiles);eq(r.sources.length,0);eq(r.bindings[0].status,'unresolved-input-binding');eq(r.bindings[0].input,s.inputs[0]);
}
for(const c of [undefined,null,{}, {...noFiles,catalog:{maps:[record,record]}}]){const r=await prepareVideoReplaySources(search(),c);eq(r.sources.length,0);eq(r.bindings.length,1);}
await reject(()=>prepareVideoReplaySources({...search(),debugOnly:true},noFiles),'ProductionATInputPolicyError');
await reject(()=>prepareVideoReplaySources(search(),noFiles,{isCurrent:()=>false}),'AbortError');
let current=true;await reject(()=>prepareVideoReplaySources(search(),noFiles,{isCurrent:()=>current,yieldTask:async()=>{current=false;}}),'AbortError');
const mutable=search(),mutableContext={...noFiles,catalog:{maps:[structuredClone(record)]}};
const frozen=await prepareVideoReplaySources(mutable,mutableContext,{yieldTask:async()=>{mutable.inputs[0].map.mapId=999;mutableContext.catalog.maps[0].mapId=999;}});eq(frozen.bindings[0].input.map.mapId,7);eq(frozen.sources[0].record.mapId,7);
const empty=await prepareVideoReplaySources(search([]),{...noFiles,project:{nfs:{readFile:()=>{throw Error('must not read');}}}});eq(empty.sources,[]);eq(empty.bindings,[]);
let actual=null;if(process.argv[2]&&process.argv[3]){
 const rom=fs.readFileSync(process.argv[2]),romSHA256=hash(rom);eq(romSHA256,'3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7');
 const project=openMapRom(rom),catalog=buildRomMapCatalog(project),savedBytes=fs.readFileSync(process.argv[3]),saved=JSON.parse(savedBytes),untouched=structuredClone(saved),t=performance.now();
 const prepared=await prepareVideoReplaySources(saved,{project,catalog,romSHA256});const elapsedMs=performance.now()-t;
 eq(saved,untouched);eq(saved.inputs.length,24);eq(prepared.bindings.length,24);eq(prepared.sources.length,1);eq(prepared.sources[0].record.mapId,20001);eq(prepared.sources[0].sourceReady,true);eq(prepared.bindings.map(b=>b.input),saved.inputs);eq(prepared.bindings.map(b=>b.inputIndex),Array.from({length:24},(_,i)=>i));eq(prepared.unknownBranch,saved.unknownBranch);eq(prepared.inputSearchStats,saved.stats);eq(prepared.inputRetention,saved.retention);
 const source=prepared.sources[0],oldTables=prepareFieldSpawnTables(project.nfs,20001),oldCreator=mineCreatorResources(project.nfs,20001),oldGraphs=mineFieldGraphs(project.nfs,decodeCalls);eq(source.encounters,oldTables);eq(source.creator,oldCreator);eq(source.graph,oldGraphs.graphs.find(g=>g.path===fieldPathName('F01')));eq(source.graph.nodes.length,79);eq(source.graph.edges.length,139);eq(source.creator.species.length,6);eq(source.encounters.groups[0].tableIds,[12,14,15]);
 for(const dep of source.dependencies){const bytes=new Uint8Array(project.nfs.readFile(dep.path));eq(dep.bytes,bytes.length);eq(dep.sha256,hash(bytes));}
 // Mutation and source mismatch cannot contaminate a second preparation.
 source.graph.nodes[0].position[0]++;source.creator.species[0]=-999;prepared.bindings[0].input.map.mapId=0;
 const again=await prepareVideoReplaySources(saved,{project,catalog,romSHA256},{yieldTask:async()=>{}});eq(again.sources[0].graph,oldGraphs.graphs.find(g=>g.path===fieldPathName('F01')));eq(again.sources[0].creator,oldCreator);eq(again.bindings.map(b=>b.input),saved.inputs);
 // Preserve distinct map records and unsupported aliases, with their own failures.
 const missing=catalog.maps.find(r=>r.mapId>=40000&&r.mapId<50000),alias=catalog.maps.find(r=>r.mapId===20043);assert(missing&&alias);checks++;
 const extra=structuredClone(saved);for(const r of [alias,missing])extra.inputs.push({...structuredClone(saved.inputs[0]),map:{recordKey:r.key,mapId:r.mapId,fieldCode:r.fieldCode}});
 const alternatives=await prepareVideoReplaySources(extra,{project,catalog,romSHA256});eq(alternatives.sources.length,3);eq(alternatives.bindings.length,26);eq(alternatives.sources[2].sourceReady,false);eq(alternatives.sources[2].graph,null);eq(alternatives.sources[2].unsupported.some(r=>r.stage==='graph'&&r.reason.includes('Procedural')),true);eq(alternatives.minimumProvenATCalls,0);
 actual={savedInputBytes:savedBytes.length,savedInputSHA256:hash(savedBytes),elapsedMs,retainedConditionalInputs:24,distinctSourceRecords:1,graphNodes:79,graphEdges:139,tableIds:[12,14,15],creatorSpecies:oldCreator.species,allExistingSourceReaderOutputsExact:true,allConditionalInputBranchesExact:true,aliasAndUnsupportedControls:alternatives.sources.map(s=>({mapId:s.record.mapId,sourceReady:s.sourceReady,failures:s.unsupported.map(e=>e.stage)})),nativeReplayExecuted:false,currentVideoStateRecovered:false,minimumProvenATCalls:0};
}
// Existing controller defaults and the new no-source/unknown branch do not start
// an AT search, even when static preparation is requested.
const states=[],controller=createVideoTrackingAT({getReplaySourceContext:()=>noFiles,engineRevision:'synthetic-source-preparation',onState:s=>states.push(s),prepare:()=>{throw Error('No body evidence must not prepare AT');}});
await controller.observe({schema:'headless-monster-observation-bundle-v1',source:{background:{romSHA256},modelPlan:{models:[]}},sightings:[],videoObservations:[]});eq(controller.replaySourcePreparation.bindings,[]);eq(states.at(-1).status,'waiting');eq(states.at(-1).replaySourcePreparation.nativeReplayExecuted,false);controller.cancel();eq(controller.replaySourcePreparation,null);
console.log(JSON.stringify({passed:true,checks,actual,scope:'Conditional static source preparation and controller connection. No live origin, source-clock producer, actor identity or current AT recovery.'},null,2));
