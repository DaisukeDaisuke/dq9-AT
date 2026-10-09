// Bind automatically enumerated replay INPUT hypotheses to existing ROM readers.
// This prepares static source resources, never a native runtime packet. A map
// observation is not a reached loader, actor origin, seed, or source clock.
import {mineFieldGraphs,fieldPathName} from './field-graph.mjs';
import {bindSourceFieldScheduler,prepareGraphPresentSchedulerDomain} from './symbolic-field-scheduler.mjs';
import {bindOrdinaryFieldInvocationClock,prepareReplayInputClockHypotheses} from './source-field-invocation-clock.mjs';
import {decodeCalls} from './map-core.mjs';
import {prepareFieldSpawnTables} from './field-spawn-source.mjs?v=field-source-preparation-20261006-1806';
import {mineCreatorResources} from './monster-creation-resources.mjs';
import {assertProductionATInput} from './production-at-input-policy.mjs?v=production-inputs-20261006-1320';
const copy=structuredClone,shaPattern=/^[a-f0-9]{64}$/;
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const requiredRuntime=[
 'Reached loader/reset/cache branch and successful allocations',
 'Active/story/current field, carried spawn timer and runtime node flags',
 'Effective party state, current node, pool occupancy and actor/template topology',
 'Ordered reached source clocks and intervening input/AT consumers',
 'Initial AT state or independently supported event-state alternatives',
];
const notLive={sourceOnly:true,runtimeInitialized:false,nativeRuntimePacketConstructed:false,nativeReplayExecuted:false,currentVideoStateRecovered:false,minimumProvenATCalls:0};
/** Context is the currently loaded ROM project/catalog, supplied by the owner of
 * the ROM bytes. It is never reconstructed from an observation's map metadata.
 * Resources are request-local and shared only among exact record bindings.
 */
export async function prepareVideoReplaySources(replayInputs,context={},
 {isCurrent=()=>true,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 assertProductionATInput(replayInputs);
 if(replayInputs?.schema!=='automatic-conditional-replay-input-search-v1'||!Array.isArray(replayInputs.inputs))throw Error('Automatic conditional replay-input search required');
 const current=()=>{if(!isCurrent())throw new DOMException('Replay source preparation cancelled or stale','AbortError');};
 current();
 const {project,catalog,romSHA256}=context??{};
 const snapshot=copy(replayInputs),sources=[],bindings=[],byRecord=new Map(),nfs=project?.nfs??project?.nitro;
 const records=Array.isArray(catalog?.maps)?catalog.maps.map(r=>({key:r.key,mapId:r.mapId,fieldCode:r.fieldCode,source:copy(r.source)})):null;
 let graphs=null,graphError=null,graphAttempted=false,schedulerBinding=null,schedulerBindingError=null,invocationClock=null,invocationClockError=null;
 if(context?.rom instanceof Uint8Array){try{schedulerBinding=await bindSourceFieldScheduler(context);}catch(error){schedulerBindingError=String(error?.message??error);}}
 if(context?.rom instanceof Uint8Array){try{invocationClock=await bindOrdinaryFieldInvocationClock(context);}catch(error){invocationClockError=String(error?.message??error);}}
 const contextReady=shaPattern.test(romSHA256??'')&&typeof nfs?.readFile==='function'&&Array.isArray(records);
 const checkInput=input=>{
  if(!contextReady)return 'Loaded ROM project, exact catalog and ROM identity unavailable';
  if(input?.schema!=='conditional-video-replay-input-v1')return 'Conditional replay-input schema unavailable';
  const frames=[input.source,input.targetFrame,input.entryWitnessFrames?.before,input.entryWitnessFrames?.after];
  if(frames.some(f=>!f||f.romSHA256!==romSHA256))return 'Replay witness/target ROM differs from loaded ROM';
  if(frames.some(f=>!Number.isFinite(f.sourcePTS)||typeof f.frameKey!=='string'||!f.frameKey||typeof f.sourceId!=='string'||!f.sourceId||!Number.isSafeInteger(f.sourceEpoch)||!Number.isSafeInteger(f.timelineSegment)))return 'Replay witness/target frame identity incomplete';
  if(frames.some(f=>['sourceId','sourceEpoch','timelineSegment'].some(k=>f[k]!==input.source[k])))return 'Replay witness/target source epoch or segment differs';
  if(input.entryWitnessFrames.before.sourcePTS>input.entryWitnessFrames.after.sourcePTS||input.source.frameKey!==input.entryWitnessFrames.after.frameKey)return 'Replay entry witness order or source binding differs';
  if(input.entryCertified!==false||input.mapIdentityCertified!==false)return 'Replay map/entry hypotheses must remain uncertified';
  if(input.initialSeed!==null||input.initialSeedInferred!==false||input.cadence!==null||input.ATCallRange!==null||input.nativeRuntimePacketConstructed!==false||input.minimumProvenATCalls!==0)return 'Replay input no longer has the unresolved automatic input contract';
  const matches=records.filter(r=>r.key===input.map?.recordKey);
  if(matches.length!==1||matches[0].mapId!==input.map?.mapId||matches[0].fieldCode!==input.map?.fieldCode)return 'Replay map record differs from exact loaded ROM catalog';
  return null;
 };
 async function prepareRecord(record){
  const errors=[],dependencies=[];
  // Freeze each byte stream once in this request. A hash always describes the
  // very bytes given to an existing decoder, not a caller-provided digest.
  const files=new Map();
  const readFile=path=>{if(!files.has(path))files.set(path,new Uint8Array(nfs.readFile(path)).slice());return files.get(path);};
  let graph=null,encounters=null,creator=null;
  if(!graphAttempted){graphAttempted=true;try{graphs=mineFieldGraphs({readFile},decodeCalls);}catch(e){graphError=String(e?.message??e);}}
  const requestedPath=fieldPathName(record.fieldCode),matches=graphs?.graphs.filter(g=>g.path===requestedPath)??[];
  if(record.mapId>=40000&&record.mapId<50000)errors.push({stage:'graph',reason:'Procedural grotto requires its separate runtime graph construction'});
  else if(matches.length===1)graph=copy(matches[0]);
  else errors.push({stage:'graph',reason:graphError??(matches.length?'Ambiguous static graph source':'No static graph source'),requestedPath,failures:copy(graphs?.errors.filter(e=>e.pack===requestedPath)??[])});
  try{encounters=prepareFieldSpawnTables({readFile},record.mapId);for(const e of encounters.unsupported)errors.push({stage:'encounters',...copy(e)});}catch(e){errors.push({stage:'encounters',reason:String(e?.message??e)});}
  try{creator=mineCreatorResources({readFile},record.mapId);}catch(e){errors.push({stage:'creator',reason:String(e?.message??e)});}
  for(const [path,bytes] of files){dependencies.push({path,bytes:bytes.length,sha256:await hash(bytes)});current();}
  // The graph cache is this source request's decoded immutable ROM source. Its
  // archive identity is carried on every source, including subsequent records.
  const graphArchive=dependencies.find(d=>d.path==='data/pack_lv5/path.gp2')??sources.flatMap(s=>s.dependencies).find(d=>d.path==='data/pack_lv5/path.gp2');
  if(graphArchive&&!dependencies.some(d=>d.path===graphArchive.path))dependencies.unshift(copy(graphArchive));
  const schedulerSource={graph,romSHA256,record:{recordKey:record.key,mapId:record.mapId,fieldCode:record.fieldCode}};
  const schedulerProgression=schedulerBinding?prepareGraphPresentSchedulerDomain(schedulerSource,schedulerBinding):{schema:'conditional-graph-scheduler-domain-v1',status:'unresolved-source-binding',reason:schedulerBindingError??'Owned ROM instruction bytes unavailable',unknownAlternativeRetained:true};
  return {schedulerProgression,schema:'conditional-ROM-field-replay-source-v1',record:{recordKey:record.key,mapId:record.mapId,fieldCode:record.fieldCode,source:copy(record.source)},romSHA256,sourceReady:errors.length===0,graph,encounters,creator,dependencies,unsupported:errors,missingRuntimeInputs:requiredRuntime.slice(),...notLive,
   scope:'Static graph, full ordered encounter groups/rows and ordinary creator species/model/AI records. Static node initialFlags are not current node flags; player location/floor is not an enemy root. Current group/table, templates/allocation topology and source execution remain unknown.'};
 }
 for(const [inputIndex,input] of snapshot.inputs.entries()){
  current();const reason=checkInput(input);
  if(reason){bindings.push({inputIndex,status:'unresolved-input-binding',reason,input:copy(input),sourceIndex:null,...notLive});continue;}
  const key=input.map.recordKey;
  if(!byRecord.has(key)){
   await yieldTask();current();const record=records.find(r=>r.key===key),source=await prepareRecord(record);current();byRecord.set(key,sources.length);sources.push(source);
  }
  const sourceIndex=byRecord.get(key);
  const clockHypotheses=invocationClock?prepareReplayInputClockHypotheses(input,invocationClock):{schema:'conditional-replay-clock-hypotheses-v1',spans:[],unresolved:[{reason:invocationClockError??'Owned ROM invocation-clock binding unavailable'}],unknownAlternativeRetained:true};
  bindings.push({clockHypotheses,inputIndex,status:sources[sourceIndex].sourceReady?'conditional-static-source-prepared':'conditional-static-source-partial',sourceIndex,input:copy(input),...notLive});
 }
 current();
 return {schema:'automatic-video-replay-source-preparation-v1',sources,bindings,inputSearchComplete:snapshot.complete===true,inputRetention:copy(snapshot.retention??null),inputSearchStats:copy(snapshot.stats??null),unretainedInputsPrepared:false,unknownBranch:copy(snapshot.unknownBranch),retainedInputBranchesPreserved:true,ATConstraintsChanged:false,initialSeed:null,initialSeedInferred:false,cadence:null,ATCallRange:null,missingRuntimeInputs:requiredRuntime.slice(),...notLive,
  scope:'Source preparation for retained conditional replay-input branches only. Search rejections/unretained and unknown alternatives stay as in the input search. No event, reset, birth, current state or replay timing is inferred.'};
}
