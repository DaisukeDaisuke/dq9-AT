// A small observation contract for hidden spawned entities. It is not a world
// simulator or detector. No first-sighting draw, beam pruning, or AT-bound update.
const clone=x=>structuredClone(x);
const interval=v=>v&&Number.isFinite(v.min)&&Number.isFinite(v.max)&&v.min<=v.max;
const separated=(a,b)=>a.max<b.min||b.max<a.min;

/** An entity id must identify an internal generation/lifetime, not a reusable
 * native slot or wrapping serial alone. Native slot/serial/event are provenance.
 * Unknown lifecycle/position/visibility remains unknown in the returned record.
 */
export function associateWorldObservation(hypothesis,observation){
 if(!hypothesis?.id||!Array.isArray(hypothesis.entities)||!observation?.id||!observation.frameKey)throw Error('World hypothesis, entity lifetimes and stamped observation required');
 const ids=hypothesis.entities.map(e=>e.id);
 if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw Error('Entity lifetime IDs must be unique');
 const coverage={enumerationComplete:false,unsearchedPossible:true,modelComplete:false,...clone(hypothesis.coverage??{})};
 const alternatives=[],rejectedAssociations=[];
 // Absence can arise from camera, occlusion, detector failure or despawn. This
 // contract does not certify all those predicates, so it never chooses despawn.
 if(observation.kind==='absence')return{hypothesis:clone(hypothesis),observation:clone(observation),coverage,
  alternatives:[{kind:'absence-unresolved',entityIds:ids,possibilities:['offscreen','occluded','not-detected','despawn-unproven']}],
  rejectedAssociations,minimumProvenATCalls:0,hypothesisRejected:false};
 if(observation.kind!=='sighting')throw Error('Expected sighting or absence');
 const observedIds=observation.monsterIds??[];
 if(!Array.isArray(observedIds)||!observedIds.every(Number.isInteger))throw Error('Monster identities must remain an explicit candidate set');
 for(const entity of hypothesis.entities){
  const reasons=[];
  if(observation.identityCertified===true&&entity.identityCertified===true
      &&observedIds.length&&Array.isArray(entity.monsterIds)&&entity.monsterIds.length
      &&!entity.monsterIds.some(id=>observedIds.includes(id)))reasons.push('certified-species-disjoint');
  if(entity.lifecycle?.absentAtFrameCertified===observation.frameKey)reasons.push('certified-lifetime-absent-at-frame');
  const p=entity.position,q=observation.position;
  if(p?.certified===true&&q?.certified===true&&p.frameKey===observation.frameKey&&q.frameKey===observation.frameKey
      &&p.space===q.space&&p.mapId===q.mapId&&['x','z'].every(axis=>interval(p[axis])&&interval(q[axis]))
      &&['x','z'].some(axis=>separated(p[axis],q[axis])))reasons.push('certified-same-frame-position-disjoint');
  if(reasons.length)rejectedAssociations.push({entityId:entity.id,reasons});
  else alternatives.push({kind:'existing-entity-or-reappearance',entityId:entity.id,
    generationTime:entity.generationTime??null,firstSightingIsBirth:false,minimumProvenATCalls:0});
 }
 if(!coverage.enumerationComplete||coverage.unsearchedPossible||!coverage.modelComplete)
  alternatives.push({kind:'previously-untracked-existing-entity',entityId:null,generationTime:null,
    offscreenGenerationPossible:true,firstSightingIsBirth:false,minimumProvenATCalls:0});
 if(observation.identityCertified!==true||observation.detectionCertified!==true)
  alternatives.push({kind:'observation-label-or-detection-error',minimumProvenATCalls:0});
 return{hypothesis:clone(hypothesis),observation:clone(observation),coverage,alternatives,rejectedAssociations,
  minimumProvenATCalls:0,forcedNewSpawn:false,
  hypothesisRejected:alternatives.length===0&&coverage.enumerationComplete&&!coverage.unsearchedPossible&&coverage.modelComplete};
}

/** Only report agreement supplied for every represented possible world; never
 * call agreement over an arbitrary enumerated subset a robust recommendation.
 */
export function worldActionAgreement(hypotheses,predictions){
 if(!Array.isArray(hypotheses)||!hypotheses.length||!Array.isArray(predictions))throw Error('World hypotheses and predictions required');
 if(hypotheses.some(h=>!h.id)||new Set(hypotheses.map(h=>h.id)).size!==hypotheses.length
     ||new Set(predictions.map(p=>p.hypothesisId)).size!==predictions.length)throw Error('Hypothesis and prediction IDs must be unique');
 const missing=hypotheses.filter(h=>!predictions.some(p=>p.hypothesisId===h.id));
 const incomplete=hypotheses.some(h=>h.coverage?.enumerationComplete!==true||h.coverage?.unsearchedPossible!==false||h.coverage?.modelComplete!==true);
 const actions=predictions.map(p=>p.actionId),unique=[...new Set(actions)];
 const robust=!missing.length&&!incomplete&&predictions.length===hypotheses.length&&unique.length===1
  &&typeof unique[0]==='string'&&unique[0].length>0&&predictions.every(p=>p.validForWholeHypothesis===true);
 return{status:robust?'all-represented-possibilities-agree':'observation-or-model-coverage-needed',actionId:robust?unique[0]:null,
  robust,unsearchedPossibilitiesPreserved:incomplete,missingHypothesisIds:missing.map(h=>h.id),
  interpretation:'Coverage and per-world prediction validity are caller proof obligations; no route was simulated here.'};
}
