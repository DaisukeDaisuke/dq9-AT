// Conditional source leaf, not a tick scheduler or actor-runtime initializer.
// Occupancy/current-node alternatives are enumerated, never read from video.
const copy=structuredClone;
const samePair=(a,b)=>a.tableId===b.tableId&&a.monsterId===b.monsterId;
export function* enumerateNativeRouteChoiceHypotheses(candidate,{romSHA256,resources,motionKernel,fieldKernel,sourceFacing,sourceDistance}){
 if(!/^[a-f0-9]{64}$/.test(romSHA256??'')||candidate?.romSHA256!==romSHA256)throw Error('ROM source/observation identity differs');
 const links=candidate?.conditionalATInput;
 if(!links||links.endpointPredicatesIntersected!==false)throw Error('Exact conditional endpoint links required');
 for(const[hypothesisIndex,h]of candidate.hypotheses.entries()){
  const r=resources.find(r=>(r.record??r.map).recordKey===h.recordKey);
  if(!r?.graph?.nodes?.length){yield{kind:'deferred',reason:'ROM graph for this native branch unavailable',hypothesisIndex};continue;}
  const priors=links.priorSelectionLinks.filter(l=>l.hypothesisIndex===hypothesisIndex),incoming=links.incomingSelectionLinks.filter(l=>l.hypothesisIndex===hypothesisIndex),pairs=[];
  for(const a of priors)for(const b of incoming)for(const p of a.sourceSpecificTableSpeciesAlternatives)if(b.sourceSpecificTableSpeciesAlternatives.some(q=>samePair(p,q))&&!pairs.some(q=>samePair(p,q)))pairs.push(p);
  if(!pairs.length){yield{kind:'deferred',reason:'Same-actor stable-table endpoint pair unavailable',hypothesisIndex};continue;}
  const wanted=sourceFacing(h.toPose?.yawFx);
  if(!wanted){yield{kind:'deferred',reason:'Incoming native yaw has no source facing interpretation',hypothesisIndex};continue;}
  const targets=[];let unresolvedTarget=false;
  for(const node of r.graph.nodes){const xyz=node.position.map(v=>v*4096),xz=p=>[p[0],0,p[2]],beforeDistance=sourceDistance(xz(h.fromPositionFx),xz(xyz)),afterDistance=sourceDistance(xz(h.toPositionFx),xz(xyz));if(beforeDistance===null||afterDistance===null){unresolvedTarget=true;continue;}if(afterDistance>=beforeDistance)continue;const a=motionKernel.state2EntrySteering(h.fromPositionFx,xyz),b=motionKernel.state2Steering(h.toPositionFx,xyz);
   if(!a.resolved||!b.resolved){unresolvedTarget=true;continue;}const fa=sourceFacing(a.targetAngle),fb=sourceFacing(b.targetAngle);if(!fa||!fb){unresolvedTarget=true;continue;}
   // This explicitly tests a completed-turn, stable-bearing progress hypothesis.
   // Other turns, states, targets and root/yaw alternatives stay unknown.
   if(fa&&fb&&fa.every((n,i)=>n===wanted[i])&&fb.every((n,i)=>n===wanted[i])&&b.xzArrivalDistance<a.xzArrivalDistance)targets.push(node.id);
  }
  if(unresolvedTarget){yield{kind:'deferred',reason:'A potentially compatible source steering target is unresolved; no node excluded from AT',hypothesisIndex};continue;}
  for(const pair of pairs){const ai=(r.creator?.ai??r.selectedAI).find(a=>a.species===pair.monsterId),table=r.encounters.tables.find(t=>t.tableId===pair.tableId);
   if(!ai||(ai.flags&7)!==1||!(((ai.flags>>>3)&7)>0)||!table){yield{kind:'deferred',reason:'Supported moving routeMode1 ROM/table source unavailable',hypothesisIndex,pair};continue;}
   if(!targets.length){yield{kind:'incompatible-source-route-hypothesis',reason:'No ROM target matches the explicit completed-turn stable-bearing progress hypothesis',hypothesisIndex,pair,sourceROM:romSHA256,conditionalStateCount:'0',unknownAlternativeRetained:true,currentVideoStateRecovered:false};continue;}
   const area=(table.schedulerRow.flags>>>13)&255;
   for(const current of r.graph.nodes){const adjacent=current.neighbors.map(i=>r.graph.nodes[i]);if(adjacent.some(n=>!n))throw Error('ROM adjacency outside graph');const occupancyNodes=[...new Set(current.neighbors)],patterns=1n<<BigInt(occupancyNodes.length);
    for(let pattern=0n;pattern<patterns;pattern++){
     const occupied=adjacent.map(n=>Number((pattern>>BigInt(occupancyNodes.indexOf(n.index)))&1n)),n=adjacent.length;
     fieldKernel.reserve(Math.max(4,n*12));const p=fieldKernel.kernel.heap,memory=new Uint32Array(fieldKernel.e.memory.buffer,p,n*3);memory.set(adjacent.map(n=>n.areaMask));memory.set(occupied,n);const count=fieldKernel.e.field_neighbor_candidates(p,p+n*4,n,area,p+n*8);if(count<0)throw Error('Explicit conditional occupancy unexpectedly unresolved');
     const ordered=Array.from(new Uint32Array(fieldKernel.e.memory.buffer,p+n*8,count),i=>adjacent[i].id),selected=targets.slice();
     const reference={hypothesisIndex,fromSightingId:candidate.fromSightingId,toSightingId:candidate.toSightingId,sourceIdentity:copy(candidate.sourceIdentity),romSHA256:candidate.romSHA256,recordKey:h.recordKey,modelId:h.modelId,variant:h.variant,fromPositionFx:copy(h.fromPositionFx),toPositionFx:copy(h.toPositionFx),from:copy(h.from),to:copy(h.to),pair:copy(pair),currentNodeIndex:current.index,occupancyNodeIndices:occupancyNodes.slice(),occupiedPattern:pattern.toString(),graphSource:copy(r.graph.source),aiSourceOffset:ai.sourceOffset,tableFlags:table.schedulerRow.flags};
     if(!ordered.length){yield{kind:'no-draw-alternative',reference,minimumProvenATCalls:0};continue;}
     const id=`route-choice:${hypothesisIndex}:${pair.tableId}:${pair.monsterId}:${current.index}:${pattern}`;
     yield{kind:'conditional-event',reference,event:{id,operation:'direct-output-modulo',stateBoundary:'immediately-after-draw',eligibleNodeIdsInOrder:ordered,selectedNodeAlternatives:selected,evidence:{...reference,source:'02077d10 routeMode1 armed choice / 02079d54 direct UpdateAT modulo',conditionHypotheses:['Both native root/pose proposals describe the same actor with a stable encounter table','Reached armed state1 target-choice handler with its timer and upstream gates passed','Source node occupancy equals this enumerated pattern; current node equals this enumerated index','Native rendered yaw equals the actor movement angle in this branch', 'Observed interval has completed turn, source target bearing unchanged at both roots, and positive progress toward that target'],conditionHypothesesMeasured:false,nativeBirthObserved:false,independentDrawCertified:false,fullMonsterStepResolved:false,sourceClockKnown:false,minimumProvenATCalls:0}},unknownAlternativeRetained:true,currentVideoStateRecovered:false};
    }
   }
  }
 }
}
