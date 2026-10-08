import {collectNativeTrackingBodySupport} from './tracking-native-body-support.mjs?v=enc-motion-at-20261006-1156';
import {trackingSightingMapProvenance} from './map-browser-preview/map-hypothesis-provenance.mjs?v=native-body-20261006-0212';
import {compileExperiment} from './at-observation-compiler.mjs?v=field-stream-20261005-1108';
import {prepare} from './at-identify-engine.mjs';
import {prepareIndexIdentification} from './at-identify-index-engine.mjs';
const need=(v,m)=>{if(!v)throw Error(m);},copy=x=>structuredClone(x);
export const UNKNOWN_BRANCH='tracking-observation-unknown';
// Tracks are association hypotheses, never event/birth certificates. Repeated
// detections contribute alternatives to one latent predicate, not extra draws.
// Default callers retain the complete independent snapshot. The video controller
// already owns its cloneable observation and preparation never uses this copy.
export function compileTrackingObservations(bundle,{tables={},domain,budget,materialization,chains=[],nativeRouteChains=[],singleEvents=[],includeBroadSingletons=true}={},{includeBundleSnapshot=true}={}){
 need(bundle?.schema==='headless-monster-observation-bundle-v1','Observation bundle required');
 const rows=[...(bundle.sightings??[])];
 for(const v of bundle.videoObservations??[])for(const f of v.timeline?.frames??[])rows.push(...(f.sightings??[]));
 const sightings=[],seen=new Map();for(const s of rows){need(typeof s.id==='string','Sighting identity required');if(seen.has(s.id)){need(JSON.stringify(seen.get(s.id))===JSON.stringify(s),'Conflicting immutable sighting');continue;}seen.set(s.id,s);sightings.push(copy(s));}
 // Historic sightings must retain their own ROM/map model-plan alternatives.
 // Never bind a prior map's sighting using only the latest frame's model bank.
 const planBySighting=new Map((bundle.sightings??[]).map(s=>[s.id,bundle.source?.modelPlan]));
 for(const v of bundle.videoObservations??[])for(const f of v.timeline?.frames??[])for(const s of f.sightings??[])if(!planBySighting.has(s.id))planBySighting.set(s.id,f.modelPlan);
 const groups=new Map(),sightingGroup=new Map();
 for(const s of sightings){const h=s.tentativeImageTrack;const key=h?.trackId!==undefined&&h?.trackId!==null&&Array.isArray(h.sourceIdentity)&&h.sourceIdentity.length===3&&h.sourceIdentity.every(x=>x!==null&&x!==undefined)?JSON.stringify([h.sourceIdentity,h.trackId]):JSON.stringify(['unassociated',s.id]);if(!groups.has(key))groups.set(key,{id:`latent-${groups.size}`,sightings:[],species:new Set(),tableIds:new Set()});const g=groups.get(key);g.sightings.push(s);sightingGroup.set(s.id,g.id);for(const n of s.monsterIds??[])g.species.add(n);for(const model of s.modelAliases??[])for(const origin of planBySighting.get(s.id)?.models?.find(m=>m.modelId===model.modelId)?.origins??[])g.tableIds.add(origin.tableId);}
 const alternatives=sightings.map(s=>({sightingId:s.id,kinds:['existing-entity-or-reappearance','same-entity','different-entity','observation-error','conditional-latent-event'],firstSightingIsBirth:false}));
 const hypotheses=[{id:UNKNOWN_BRANCH,events:[],edges:[],assumptions:['Unknown species, existing entity, false detection, different-entity association and omitted timeline history remain possible.']}];
 const eventFor=g=>({id:g.id,operation:'weighted-species',stateBoundary:'immediately-after-draw',tableSpeciesAlternatives:[...g.tableIds].flatMap(tableId=>[...g.species].map(monsterId=>({tableId,monsterId}))),evidence:{sightingIds:g.sightings.map(s=>s.id),nativeBirthObserved:false,independentDrawCertified:false,source:'ROM model-plan alternatives and tentative image tracks',speciesPolicy:'union, never intersect repeated uncalibrated classifications'}});
 const makeBranch=(id,gs,edges,assumptions)=>({id,events:gs.map(eventFor),edges,sightingEventBindings:Object.fromEntries(gs.flatMap(g=>g.sightings.map(s=>[s.id,g.id]))),observationEdges:gs.flatMap(g=>g.sightings.map(s=>({from:g.id,toSighting:s.id,callsAfterEvent:{min:'0',max:null},provenance:'Event-to-observation consumption is not measured'}))),assumptions});
 if(includeBroadSingletons)for(const g of groups.values())hypotheses.push(makeBranch(`conditional-${g.id}`,[g],[],['All track sightings may refer to a single latent weighted selection; no birth or current-state claim.']));
 // An automatic per-model singleton is finite over all output classes. It
 // assumes one latent selection only, never a birth at the first image frame.
 for(const single of singleEvents){
  need(single.status==='conditional-source-model-evidence'&&typeof single.provenance==='string'&&single.provenance.length,'Explicit conditional singleton provenance required');
  need(Array.isArray(single.sightingIds)&&single.sightingIds.length>0,'Singleton sighting references required');
  const ids=single.sightingIds.map(s=>sightingGroup.get(s));need(ids.every(Boolean)&&new Set(ids).size===1,'Singleton cannot merge distinct tentative tracks');
  const g=[...groups.values()].find(g=>g.id===ids[0]),branch=makeBranch(single.id,[g],[],[single.provenance,'This ranked model/alias branch is conditional, not certified recognition. No-event and observation-error alternatives remain.']);
  const event=branch.events[0];event.tableSpeciesAlternatives=copy(single.tableSpeciesAlternatives);
  event.evidence={...event.evidence,modelId:single.modelId,automaticProducer:bundle.automaticATEventEvidence?.producer??'explicit-conditional-singleton',sourceEvidence:copy(single.sourceEvidence),provenance:single.provenance};hypotheses.push(branch);
 }
 // Optional source-model evidence is supplied as data by a producer. The adapter
 // cannot certify it. Missing or unsupported gaps remain unresolved in engines.
 for(const chain of chains){need(chain.status==='conditional-source-model-evidence'&&typeof chain.provenance==='string'&&chain.provenance.length,'Explicit conditional evidence provenance required');need(Array.isArray(chain.sightingIds)&&chain.sightingIds.length>=2,'At least two event representatives required');const ids=chain.sightingIds.map(s=>sightingGroup.get(s));need(ids.every(Boolean)&&new Set(ids).size===ids.length,'Repeated track cannot become independent events');const gs=ids.map(id=>[...groups.values()].find(g=>g.id===id));need(Array.isArray(chain.gaps)&&chain.gaps.length===ids.length-1,'Explicit adjacent gaps required');const edges=chain.gaps.map((g,i)=>({from:ids[i],to:ids[i+1],callsBetweenPostStates:copy(g.callsBetweenPostStates),provenance:g.provenance??chain.provenance}));hypotheses.push(makeBranch(chain.id,gs,edges,[chain.provenance,'Event identity/order/gaps conditional on supplied source-model evidence; unknown alternative retained.']));}
 // Source movement draws belong to one actor; they are not new weighted births.
 // Accept only the explicitly conditional route-chain producer contract.
 for(const route of nativeRouteChains){
  need(route?.kind==='conditional-chain'&&route.unknownAlternativeRetained===true&&route.currentVideoStateRecovered===false&&route.sourceRuntimeInitialized===false,'Conditional native route-chain contract required');
  const refs=route.sourceEvidence,h=route.hypothesis;
  need(refs?.first&&refs?.second&&h&&Array.isArray(h.events)&&h.events.length===2&&h.events.every(e=>e.operation==='direct-output-modulo'),'Two source route choices required');
  for(const ref of [refs.first,refs.second]){
   need(ref.romSHA256===bundle.source?.background?.romSHA256,'Route ROM differs from observation');
   need(Array.isArray(ref.sourceIdentity)&&ref.sourceIdentity.length===3&&ref.sourceIdentity.every((v,i)=>v===[bundle.source?.video?.sourceId,bundle.source?.video?.sourceEpoch,bundle.source?.video?.timelineSegment][i]),'Route source epoch or segment differs');
   need(seen.has(ref.fromSightingId)&&seen.has(ref.toSightingId),'Route endpoints must exist in the owned observation');
   for(const [id,endpoint] of [[ref.fromSightingId,ref.from],[ref.toSightingId,ref.to]]){
    const sighting=seen.get(id),frame=trackingSightingMapProvenance(bundle,sighting)?.frame;
    need(frame&&endpoint?.frameKey===sighting.frameKey&&endpoint.frameKey===frame.frameKey&&endpoint.sourcePTS===frame.sourcePTS&&frame.romSHA256===ref.romSHA256&&['sourceId','sourceEpoch','timelineSegment'].every((k,i)=>frame[k]===ref.sourceIdentity[i]),'Route endpoint differs from its exact immutable frame');
   }
  }
  need(h.edges?.length===1&&h.edges[0].callsBetweenPostStates?.min==='1'&&h.edges[0].callsBetweenPostStates?.max==='1'&&h.edges[0].assumptionsMeasured===false,'Explicit conditional consecutive-consumer edge required');
  hypotheses.push(copy(h));
 }
 const experiment=compileExperiment({sightings,associationAlternatives:alternatives,hypotheses,coverage:{...copy(bundle.coverage??{}),eventHypothesesComplete:false,associationEnumerationComplete:false,deferredAutomaticAlternatives:copy(bundle.automaticATEventEvidence?.deferred??[]),broadTrackingHypothesesDeferred:!includeBroadSingletons}},{tables});
 const request={experiment,domain:copy(domain),budget:copy(budget),...(domain?.kind==='known-origin-terminal-indices'?{materialization:copy(materialization)}:{})};
 const gate=domain?.kind==='known-origin-terminal-indices'?prepareIndexIdentification(request):prepare(request);
 return {nativeBodySupportEvidence:collectNativeTrackingBodySupport(sightings.map(s=>({s,plan:planBySighting.get(s.id),mapProvenance:trackingSightingMapProvenance(bundle,s)}))),request,groups:[...groups.values()].map(g=>({id:g.id,sightingIds:g.sightings.map(s=>s.id)})),gate:gate.checkpoint.branches.map(b=>({branchId:b.branchId,status:b.status,reason:b.reason??null})),minimumProvenATCalls:0,currentVideoStateRecovered:false,missingEvidence:['Automatic native birth/event identification and bounded AT call gaps are not produced by image tracks.','Event-to-current-video propagation is unbounded.'],...(includeBundleSnapshot?{bundleSnapshot:copy(bundle)}:{})};
}
