import {isMovementNoDrawSource} from './monster-motion-source-binding.mjs?v=motion-closure-20261008-89e290ef';
// A conditional two-choice path, not a recovered runtime or video clock.
// Callers retain all input rows and the unconstrained companion below.
const copy = structuredClone;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const xyz = p => Array.isArray(p) && p.length === 3 && p.every(Number.isSafeInteger);

export function connectConditionalNativeRouteChoices(first, second, { resources, sourceDistance, sourceBinding=null }) {
  const deferred = reason => ({ kind: 'deferred', reason, unknownAlternativeRetained: true, currentVideoStateRecovered: false });
  if (first?.kind !== 'conditional-event' || second?.kind !== 'conditional-event') return deferred('Two explicit route-choice hypotheses required');
  const a = first.reference, b = second.reference;
  if (!a || !b || !/^[a-f0-9]{64}$/.test(a.romSHA256 ?? '') || !Array.isArray(a.sourceIdentity) || a.sourceIdentity.length !== 3 || a.sourceIdentity.some(v => v === null || v === undefined) || typeof a.modelId !== 'string' || !a.modelId || !equal(a.sourceIdentity, b.sourceIdentity) || a.romSHA256 !== b.romSHA256 ||
      a.recordKey !== b.recordKey || a.modelId !== b.modelId || a.variant !== b.variant || !equal(a.pair, b.pair)) return deferred('Same source, epoch, segment, map, model and encounter pair required');
  if (!Number.isFinite(a.to?.sourcePTS) || !Number.isFinite(b.from?.sourcePTS) || a.to.sourcePTS > b.from.sourcePTS || !(a.from?.sourcePTS<a.to.sourcePTS) || !(b.from.sourcePTS<b.to?.sourcePTS) || a.toSightingId === b.toSightingId) return deferred('Distinct ordered motion intervals required; order supplies no call count');
  const r = resources.find(r => (r.record ?? r.map)?.recordKey === a.recordKey);
  const ai=(r?.creator?.ai??r?.selectedAI??[]).find(row=>row.species===a.pair.monsterId);
  if(!ai||(ai.flags&7)!==1||![1,2,3].includes((ai.flags>>>3)&7))return deferred('ROM route/speed family is outside the closed movement path');
  const detectionMode=(ai.flags>>>6)&7;
  if(![0,1,2,3].includes(detectionMode)&&!(detectionMode===4&&isMovementNoDrawSource(sourceBinding,a.romSHA256)))return deferred('Intervening actor detector path has no source AT-consumption closure');
  const node = r?.graph?.nodes?.[b.currentNodeIndex];
  if (!node || node.index !== b.currentNodeIndex || !xyz(node.position) || !xyz(b.fromPositionFx)) return deferred('Source target index and next root unavailable');
  // 02077d10 writes the chosen target index as currentNodeIndex.
  // Ordinary 02078118 arrival retains it when returning to state1.
  if (!first.event.selectedNodeAlternatives.includes(node.id) || !first.event.eligibleNodeIdsInOrder.includes(node.id)) return deferred('No common selected-target / next-current-node hypothesis');
  const target = node.position.map(v => v * 4096);
  if (!xyz(target)) return deferred('Target fixed-point conversion exceeds exact integer range');
  const arrivalDistance = sourceDistance([b.fromPositionFx[0], 0, b.fromPositionFx[2]], [target[0], 0, target[2]]);
  if (!Number.isInteger(arrivalDistance) || arrivalDistance < 0) return deferred('Source arrival distance unresolved');
  if (arrivalDistance >= 4096) return deferred('Next root does not satisfy this ordinary-arrival boundary hypothesis');
  const fullArrivalDistance=sourceDistance([b.fromPositionFx[0],0,b.fromPositionFx[2]],target);
  if(!Number.isInteger(fullArrivalDistance)||fullArrivalDistance<=0||fullArrivalDistance<4096&&!isMovementNoDrawSource(sourceBinding,a.romSHA256))return deferred('Early arrival needs bound source; exact-zero steering remains unresolved');

  const events = [copy(first.event), copy(second.event)];
  events[0].id = `prior:${events[0].id}`;
  events[1].id = `next:${events[1].id}`;
  events[0].selectedNodeAlternatives = [node.id];
  const assumptions = [
    'Both motion intervals depict the same actor and the same source node-index domain',
    'First selected target is the next currentNodeIndex; no external state or target rewrite intervenes',
    'Next initial root is the ordinary state2 arrival/state1 waiting position before its new choice',
    'Both armed state1 choices are reached; timer and upstream runtime gates pass',
    'Every intervening actor tick uses the source-supported all-type1 animation/no correction/no alert path; detection modes1..4 have all effective party members outside their respective source radius',
    'These are consecutive AT consumers; no scheduler, detector or other actor consumes AT between them',
    'No further AT consumer occurs between the second choice and its bound final observation',
    ...events.flatMap(e => e.evidence?.conditionHypotheses ?? [])
  ];
  const edge = { from: events[0].id, to: events[1].id, callsBetweenPostStates: { min: '1', max: '1' },
    provenance: 'Explicit consecutive-consumer hypothesis; each source armed route choice calls UpdateAT once', sourceTransition: { targetNodeId: node.id, nextCurrentNodeIndex: node.index, arrivalDistance, fullArrivalDistance, detectionMode, arrivalThreshold: 4096, sourceNoDrawBinding: isMovementNoDrawSource(sourceBinding,a.romSHA256)?sourceBinding.kind:null, ownActorClosure: 'supported state1 waiting and state2 ordinary arrival leaves consume zero; the next armed choice consumes one' }, assumptionsMeasured: false };
  return { kind: 'conditional-chain', sourceEvidence: { first: copy(a), second: copy(b) }, hypothesis: { id: `route-chain:${encodeURIComponent(JSON.stringify([a.fromSightingId,a.toSightingId]))}:${encodeURIComponent(JSON.stringify([b.fromSightingId,b.toSightingId]))}:${events[0].id}:${events[1].id}`, events, edges: [edge], assumptions,
    sightingEventBindings: { [a.toSightingId]: events[0].id, [b.toSightingId]: events[1].id },
    observationEdges: [{ from: events[1].id, toSighting: b.toSightingId, callsAfterEvent: { min: '0', max: '0' }, provenance: 'Explicit no-further-consumer hypothesis, not inferred from PTS' }] },
    sourceRuntimeInitialized: false, currentVideoStateRecovered: false, unknownAlternativeRetained: true };
}

export function nativeRouteChainUnknownAlternative() {
  return { id: 'native-route-unresolved-runtime', events: [], edges: [], assumptions: [
    'Different actor, no new draw, different movement state or yaw transform remains possible',
    'Unmeasured clock, occupancy, detector and other-consumer call gaps remain unrestricted'
  ] };
}

// Compose the existing source transition, keeping one draw per hypothesized
// reached choice. This does not create a draw from every repeated sighting.
export function composeConditionalNativeRouteSequence(choices,options){
  if(!Array.isArray(choices)||choices.length<2||choices.length>32)throw Error('Source route sequence must contain 2..32 explicit choices');
  const links=[];
  for(let i=1;i<choices.length;i++){
    const link=connectConditionalNativeRouteChoices(choices[i-1],choices[i],options);
    if(link.kind!=='conditional-chain')return link;
    links.push(link);
  }
  const refs=choices.map(row=>copy(row.reference));
  const events=[...links.map(link=>copy(link.hypothesis.events[0])),copy(links.at(-1).hypothesis.events[1])];
  events.forEach((event,index)=>event.id=`route-draw-${index}`);
  const id='route-sequence:'+JSON.stringify(choices.map(row=>[row.reference.fromSightingId,row.reference.toSightingId,row.event.id]));
  const edges=links.map((link,index)=>({...copy(link.hypothesis.edges[0]),from:events[index].id,to:events[index+1].id}));
  return {kind:'conditional-chain',sourceEvidence:{first:refs[0],second:refs.at(-1),choices:refs},hypothesis:{id,events,edges,
    assumptions:[...new Set(links.flatMap(link=>link.hypothesis.assumptions))],
    sightingEventBindings:Object.fromEntries(refs.map((ref,index)=>[ref.toSightingId,events[index].id])),
    observationEdges:[{...copy(links.at(-1).hypothesis.observationEdges[0]),from:events.at(-1).id}]},
    sourceRuntimeInitialized:false,currentVideoStateRecovered:false,unknownAlternativeRetained:true};
}

