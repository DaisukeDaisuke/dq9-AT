// Scratch-only constraint compilation. No state search, AT advance, video detector,
// world update or conversion of a sighting into a draw event occurs here.
import {monsterForRandom} from './at-core.mjs';
const N=32768;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const uint=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
const id=x=>typeof x==='string'&&x.length>0;
const clone=x=>structuredClone(x);
const requireIt=(v,m)=>{if(!v)throw Error(m);};
function ranges(mask){const out=[];let first=null;for(let i=0;i<=N;i++){if(i<N&&mask[i]&&first===null)first=i;if((i===N||!mask[i])&&first!==null){out.push({first,last:i-1});first=null;}}return out;}
function tableValid(t){return t&&uint(t.maxRand,32767)&&t.maxRand>0&&dense(t.data)&&t.data.every(r=>r&&uint(r.start,32767)&&Number.isInteger(r.end)&&r.end>=-1&&r.end<32768&&uint(r.monsterId,65535)&&typeof r.trapMonster==='boolean');}
export function compileEvent(event,{tables={}}={}){
 requireIt(event&&id(event.id),'Explicit event ID required');
 requireIt(event.stateBoundary==='immediately-after-draw','Explicit after-draw state boundary required');
 const possibleMask=new Uint8Array(N),unresolvedMask=new Uint8Array(N),reasons=new Set();
 const unresolvedAll=reason=>{possibleMask.fill(1);unresolvedMask.fill(1);reasons.add(reason);};
 if(event.operation==='weighted-species'){
  requireIt(dense(event.tableSpeciesAlternatives),'Dense table/species alternatives required');
  if(!event.tableSpeciesAlternatives.length)unresolvedAll('table/species alternatives unresolved');
  for(const a of event.tableSpeciesAlternatives){
   requireIt(a&&uint(a.tableId,65535)&&uint(a.monsterId,65535),'Native-width table/species IDs required');
   const table=tables?.[String(a.tableId)];
   if(!tableValid(table)){unresolvedAll(`table ${a.tableId} unavailable or structurally unresolved`);continue;}
   for(let r=0;r<N;r++){
    const outcome=monsterForRandom(table,r);
    if(!outcome.monster){possibleMask[r]=1;unresolvedMask[r]=1;reasons.add(`table ${a.tableId}: ${outcome.reason}`);}
    else if(Number(outcome.monster.monsterId)===a.monsterId)possibleMask[r]=1;
   }
  }
 }else if(event.operation==='direct-output-modulo'){
  const order=event.eligibleNodeIdsInOrder,selected=event.selectedNodeAlternatives;
  requireIt(dense(selected)&&selected.every(v=>uint(v,255)),'Dense selected native-byte node alternatives required');
  if(order===null||order===undefined)unresolvedAll('eligible node order/count unresolved');
  else{
   requireIt(dense(order)&&order.every(v=>uint(v,255)),'Dense eligible native-byte node order required');
   if(!order.length)unresolvedAll('empty eligibility cannot establish a reached route draw');
   else if(!selected.length)unresolvedAll('selected node unresolved');
   else for(let r=0;r<N;r++)possibleMask[r]=selected.includes(order[r%order.length])?1:0;
  }
 }else throw Error('Unsupported event operation');
 const count=possibleMask.reduce((n,v)=>n+v,0),unknown=unresolvedMask.reduce((n,v)=>n+v,0);
 return {id:event.id,operation:event.operation,stateBoundary:event.stateBoundary,possibleMask,unresolvedMask,outputRanges:ranges(possibleMask),possibleOutputCount:count,unresolvedOutputCount:unknown,exactPredicate:unknown===0,unresolvedReasons:[...reasons],conditionalOnEventHypothesis:true,eventEvidence:clone(event.evidence??null),outputClassModulus:2147483648,postDrawStateClassCount:count*65536,fullUint32StateCount:count*131072,fullStateLiftOffsets:[0,2147483648],countsAreSingleEventNotJointSolution:true,currentVideoStateRecovered:false};
}
function count(v){if(typeof v==='number'){requireIt(Number.isSafeInteger(v)&&v>=0,'Gap count must be nonnegative safe integer or decimal string');return BigInt(v);}requireIt(typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v),'Canonical nonnegative decimal gap required');return BigInt(v);}
export function compileGap(edge,eventIds){
 requireIt(edge&&id(edge.from)&&id(edge.to)&&edge.from!==edge.to,'Distinct event endpoints required');
 requireIt(eventIds.has(edge.from)&&eventIds.has(edge.to),'Gap endpoint must name an event in its branch');
 const raw=edge.callsBetweenPostStates;
 const min=raw===null?1n:count(raw?.min),max=raw===null||raw?.max===null?null:count(raw?.max);
 requireIt(min>=1n&&(max===null||max>=min),'Post-state gap includes destination draw and must be >=1');
 requireIt(id(edge.provenance),'Explicit gap provenance required');
 return {...clone(edge),callsBetweenPostStates:{min:String(min),max:max===null?null:String(max)},gapKind:max===null?'unbounded':max===min?'exact':'range',destinationDrawIncluded:true,provenance:edge.provenance,gapInferredFromVideoTime:false};
}
export function compileExperiment(input,resources={}){
 requireIt(input&&dense(input.sightings)&&dense(input.hypotheses),'Explicit sighting and hypothesis arrays required');
 requireIt(dense(input.associationAlternatives),'Explicit association alternatives required');
 const sightingIds=new Set();for(const s of input.sightings){requireIt(s&&id(s.id)&&!sightingIds.has(s.id),'Unique sighting IDs required');sightingIds.add(s.id);}
 // Resources are fixed for this compilation. Repeated crops/tracks may share
 // a numerical predicate, but each retains its own event/evidence metadata.
 const eventCache=new Map();
 const compileCached=e=>{
  const key=JSON.stringify({operation:e.operation,stateBoundary:e.stateBoundary,alternatives:e.tableSpeciesAlternatives,nodes:e.eligibleNodeIdsInOrder,selected:e.selectedNodeAlternatives});
  if(!eventCache.has(key)){const compiled=compileEvent(e,resources);eventCache.set(key,compiled);return compiled;}
  // Validate ID separately: numerical caching does not relax event validation.
  requireIt(e&&id(e.id),'Explicit event ID required');
  return {...clone(eventCache.get(key)),id:e.id,eventEvidence:clone(e.evidence??null)};
 };
 const branchIds=new Set(),branches=[];
 for(const h of input.hypotheses){
  requireIt(h&&id(h.id)&&!branchIds.has(h.id)&&dense(h.events)&&dense(h.edges),'Unique branch ID and explicit events/edges required');branchIds.add(h.id);
  const eventIds=new Set();for(const e of h.events){requireIt(e&&id(e.id)&&!eventIds.has(e.id),'Unique branch event IDs required');eventIds.add(e.id);}
  const events=h.events.map(compileCached),edges=h.edges.map(e=>compileGap(e,eventIds));
  const bindings=h.sightingEventBindings??{};requireIt(bindings&&typeof bindings==='object'&&!Array.isArray(bindings),'Sighting bindings must be an object');
  for(const [s,e]of Object.entries(bindings))requireIt(sightingIds.has(s)&&(e===null||eventIds.has(e)),'Sighting binding must refer to known sighting/event or unresolved null');
  const observationEdges=h.observationEdges??[];requireIt(dense(observationEdges),'Dense observation-time edges required');
  const compiledObservationEdges=observationEdges.map(e=>{requireIt(e&&eventIds.has(e.from)&&sightingIds.has(e.toSighting)&&id(e.provenance),'Known event/sighting and provenance required');const min=count(e.callsAfterEvent?.min),max=e.callsAfterEvent?.max===null?null:count(e.callsAfterEvent?.max);requireIt(max===null||max>=min,'Invalid event-to-observation range');return{...clone(e),callsAfterEvent:{min:String(min),max:max===null?null:String(max)},destinationIsDraw:false,gapInferredFromVideoTime:false};});
  branches.push({id:h.id,association:clone(h.association??null),sightingEventBindings:clone(bindings),observationEdges:compiledObservationEdges,assumptions:clone(h.assumptions??[]),events,edges,drawOrderInferredFromSightings:false,latentEventCount:events.length,unresolvedPredicates:events.filter(e=>!e.exactPredicate).map(e=>e.id),unboundedEdges:edges.filter(e=>e.gapKind==='unbounded').length,searchPerformed:false});
 }
 const origin=input.origin??null;if(origin!==null)requireIt(uint(origin.initialSeed,0xffffffff)&&id(origin.provenance),'Optional origin must include uint32 seed and provenance');
 return {schema:'at-output-predicate-compilation-v1',sightings:clone(input.sightings),associationAlternatives:clone(input.associationAlternatives),branches,origin:clone(origin),originUsage:'optional inverse-index mapping only; not a current-state oracle',coverage:clone(input.coverage??{associationEnumerationComplete:false,eventHypothesesComplete:false}),coverageVerified:false,certifiedDrawsAddedFromSightings:0,searchPerformed:false,jointCandidateCount:null,eventStateIsCurrentVideoState:false,currentVideoStateRecovered:false,fullStateLiftAmbiguityRetained:true};
}
