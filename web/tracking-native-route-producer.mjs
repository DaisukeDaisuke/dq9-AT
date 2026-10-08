import {readMovementNoDrawSource} from './monster-motion-source-binding.mjs?v=motion-closure-20261008-89e290ef';
import { enumerateNativeRouteChoiceHypotheses } from './tracking-native-route-choice.mjs?v=native-route-20261008-171401b8';
import { connectConditionalNativeRouteChoices,composeConditionalNativeRouteSequence } from './tracking-native-route-chain.mjs?v=motion-closure-20261008-89e290ef';
import { mineFieldGraphs, fieldPathName } from './field-graph.mjs';
import { decodeCalls } from './map-core.mjs';
import { prepareFieldSpawnTables } from './field-spawn-source.mjs';
import { mineCreatorResources } from './monster-creation-resources.mjs';
import { preferredNodeTrigFromRom, fieldNativeFacing, fieldNativeDistance } from './field-preferred-node.mjs';
import { MonsterMovementKernel } from './monster-movement.mjs?v=motion-closure-20261008-89e290ef';
import { ATKernel } from './at-core.mjs';
import { FieldATKernel } from './field-at.mjs';
import { assertProductionATInput } from './production-at-input-policy.mjs';
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const defaultLoad = async name => { const r=await fetch(new URL(`./wasm/${name}`,import.meta.url)); if(!r.ok)throw Error(`Route WASM HTTP ${r.status}`);return (await WebAssembly.instantiate(await r.arrayBuffer(),{})).instance; };

// Owned immutable ROM context, not a fabricated replay entry or runtime packet.
export function createNativeRouteProducer({loadKernel=defaultLoad}={}) {
  let cached=null;
  return async function produce(inputs,context,{isCurrent=()=>true,maximumRouteRows=4096,maximumPairEvaluations=32768,maximumChains=32,maximumEvents=32,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}) {
    assertProductionATInput(inputs);
    if(![maximumRouteRows,maximumPairEvaluations,maximumChains].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Positive route resource budgets required');
    if(!Number.isSafeInteger(maximumEvents)||maximumEvents<2||maximumEvents>32)throw Error('Source engine supports 2..32 ordered route events');
    const output={schema:'automatic-conditional-native-route-chains-v1',chains:[],deferred:[],budgetStopped:false,routeRows:0,pairEvaluations:0,unknownAlternativeRetained:true,currentVideoStateRecovered:false,sourceRuntimeInitialized:false,sourceClockKnown:false,minimumProvenATCalls:0,coverageComplete:false};
    const current=()=>{if(!isCurrent())throw new DOMException('Native route preparation superseded','AbortError');};
    const candidates=(inputs?.perSightingPriorCandidates??[]).flatMap(row=>row.candidates??[]).filter(c=>c.conditionalATInput?.priorSelectionLinks?.length&&c.conditionalATInput?.incomingSelectionLinks?.length);
    if(candidates.length<2){output.deferred.push({reason:'Two source-bound native motion intervals have not been observed',available:candidates.length});return output;}
    const {project,catalog,romSHA256,rom}=context??{},nfs=project?.nfs??project?.nitro;
    if(!rom||!nfs?.readFile||!Array.isArray(catalog?.maps)||!/^[a-f0-9]{64}$/.test(romSHA256??'')){output.deferred.push({reason:'Owned ROM bytes/project/catalog unavailable'});return output;}
    if(candidates.some(c=>c.romSHA256!==romSHA256)){output.deferred.push({reason:'Motion source differs from loaded ROM'});return output;}
    current();
    if(!cached||cached.rom!==rom||cached.project!==project||cached.romSHA256!==romSHA256){
      const bytes=rom instanceof Uint8Array?rom:new Uint8Array(rom);
      if(await digest(bytes)!==romSHA256)throw Error('Owned route ROM hash mismatch');current();
      const trig=preferredNodeTrigFromRom(bytes,{includeAtan:true});
      const [motion,map]=await Promise.all([loadKernel('monster_movement.wasm'),loadKernel('map_render.wasm')]);current();
      let sourceBinding=null;try{sourceBinding=await readMovementNoDrawSource(bytes,{romSHA256});}catch(error){output.deferred.push({reason:String(error?.message??error),sourceClosureUnavailable:true});}current();
      cached={rom,project,romSHA256,trig,sourceBinding,motionKernel:new MonsterMovementKernel(motion,trig,{sourceBinding}),fieldKernel:new FieldATKernel(new ATKernel(map)),graphs:mineFieldGraphs(nfs,decodeCalls),records:new Map()};
    }
    const state=cached,resources=[];
    for(const key of new Set(candidates.flatMap(c=>c.hypotheses.map(h=>h.recordKey)))){
      current();const matches=catalog.maps.filter(r=>r.key===key);
      if(matches.length!==1){output.deferred.push({recordKey:key,reason:'Unique loaded catalog record unavailable'});continue;}
      const record=matches[0];
      if(record.mapId>=40000&&record.mapId<50000){output.deferred.push({recordKey:key,reason:'Procedural runtime graph unavailable'});continue;}
      if(!state.records.has(key)){
        const graphs=state.graphs.graphs.filter(g=>g.path===fieldPathName(record.fieldCode));
        if(graphs.length!==1){output.deferred.push({recordKey:key,reason:'Unique ROM field graph unavailable'});continue;}
        state.records.set(key,{romSHA256,record:{recordKey:key,mapId:record.mapId,fieldCode:record.fieldCode},graph:graphs[0],encounters:prepareFieldSpawnTables(nfs,record.mapId),creator:mineCreatorResources(nfs,record.mapId)});
      }
      resources.push(state.records.get(key));await yieldTask();current();
    }
    return enumeratePreparedNativeRouteChains(inputs,{romSHA256,resources,trig:state.trig,sourceBinding:state.sourceBinding,motionKernel:state.motionKernel,fieldKernel:state.fieldKernel},{isCurrent,maximumRouteRows,maximumPairEvaluations,maximumChains,maximumEvents,yieldTask,output});
  };
}

export async function enumeratePreparedNativeRouteChains(inputs,{romSHA256,resources,trig,motionKernel,fieldKernel,sourceBinding=null},{isCurrent=()=>true,maximumRouteRows=4096,maximumPairEvaluations=32768,maximumChains=32,maximumEvents=32,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),output=null}={}) {
    assertProductionATInput(inputs);
    if(![maximumRouteRows,maximumPairEvaluations,maximumChains].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Positive route resource budgets required');
    if(!Number.isSafeInteger(maximumEvents)||maximumEvents<2||maximumEvents>32)throw Error('Source engine supports 2..32 ordered route events');
    output??={schema:'automatic-conditional-native-route-chains-v1',chains:[],deferred:[],budgetStopped:false,routeRows:0,pairEvaluations:0,unknownAlternativeRetained:true,currentVideoStateRecovered:false,sourceRuntimeInitialized:false,sourceClockKnown:false,minimumProvenATCalls:0,coverageComplete:false};
    const current=()=>{if(!isCurrent())throw new DOMException('Native route preparation superseded','AbortError');};
    current();
    const candidates=(inputs?.perSightingPriorCandidates??[]).flatMap(row=>row.candidates??[]).filter(c=>c.conditionalATInput?.priorSelectionLinks?.length&&c.conditionalATInput?.incomingSelectionLinks?.length);
    const args={romSHA256,resources,motionKernel:motionKernel,fieldKernel:fieldKernel,sourceFacing:a=>fieldNativeFacing(a,trig),sourceDistance:fieldNativeDistance};
    output.candidateIds=candidates.map(c=>c.id);
    const rows=candidates.map(()=>[]),enumerators=candidates.map(candidate=>enumerateNativeRouteChoiceHypotheses(candidate,args));
    const exhausted=candidates.map(()=>false),visited=candidates.map(()=>0);
    // Equal turns prevent one graph/table's occupancy space from consuming the
    // entire snapshot budget before a second observed interval is considered.
    while(exhausted.some(done=>!done)&&output.routeRows<maximumRouteRows){
      for(let index=0;index<enumerators.length&&output.routeRows<maximumRouteRows;index++){
        if(exhausted[index])continue;
        const next=enumerators[index].next();
        if(next.done){exhausted[index]=true;continue;}
        const row=next.value;output.routeRows++;visited[index]++;
        if(row.kind==='conditional-event')rows[index].push(row);else output.deferred.push(row);
        if(output.routeRows%64===0){await yieldTask();current();}
      }
    }
    if(exhausted.some(done=>!done))output.budgetStopped=true;
    output.candidateEnumeration=candidates.map((candidate,index)=>({candidateId:candidate.id,rowsVisited:visited[index],exhausted:exhausted[index],unvisitedAlternativesRetainedAsUnknown:!exhausted[index]}));
    // Work backwards from the latest supported interval so added constraints
    // still end at that observation. Prefer deeper hypotheses without treating
    // omitted shorter/other-consumer explanations as false.
    const ordered=rows.flat().sort((a,b)=>b.reference.to.sourcePTS-a.reference.to.sourcePTS||b.reference.from.sourcePTS-a.reference.from.sourcePTS||a.event.id.localeCompare(b.event.id));
    const seen=new Set();let depthLimitReached=false;
    const emitSequence=sequence=>{
      if(sequence.length<2||output.chains.length>=maximumChains)return;
      const chain=composeConditionalNativeRouteSequence(sequence,{resources,sourceDistance:fieldNativeDistance,sourceBinding});
      if(chain.kind==='conditional-chain'&&!seen.has(chain.hypothesis.id)){seen.add(chain.hypothesis.id);output.chains.push(chain);}
    };
    async function extendBackwards(sequence){
      if(output.chains.length>=maximumChains){output.budgetStopped=true;return;}
      if(sequence.length===maximumEvents){depthLimitReached=true;emitSequence(sequence);return;}
      let extended=false;const head=sequence[0];
      for(const prior of ordered){
        if(prior.reference.to.sourcePTS>head.reference.from.sourcePTS)continue;
        if(output.pairEvaluations>=maximumPairEvaluations){output.budgetStopped=true;break;}
        output.pairEvaluations++;
        const link=connectConditionalNativeRouteChoices(prior,head,{resources,sourceDistance:fieldNativeDistance,sourceBinding});
        if(link.kind==='conditional-chain'){extended=true;await extendBackwards([prior,...sequence]);}
        if(output.pairEvaluations%64===0){await yieldTask();current();}
        if(output.chains.length>=maximumChains)break;
      }
      if(!extended)emitSequence(sequence);
    }
    for(const latest of ordered){
      await extendBackwards([latest]);
      if(output.chains.length>=maximumChains||output.pairEvaluations>=maximumPairEvaluations){output.budgetStopped=true;break;}
    }
    output.maximumEvents=maximumEvents;output.depthLimitReached=depthLimitReached;
    output.shorterPrefixesAndOtherConsumerOrdersRetainedAsUnknown=true;
    output.enumerationCompleteWithinSuppliedSupport=false;
    output.maximalSequenceEnumerationComplete=!output.budgetStopped&&!depthLimitReached&&inputs?.enumeration?.budgetStopped===false;
    output.unenumeratedAlternativesRetainedAsUnknown=true;
    output.candidatesVisited=rows.length;
    output.budgets={maximumRouteRows,maximumPairEvaluations,maximumChains,maximumEvents};
    current();return output;
}
