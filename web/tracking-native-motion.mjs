// Conditional continuity uses source-space roots, so moving the camera does not
// require screen overlap. A ranked edge is never a native actor identity. Keep
// original sightings/tracks, branch references and split/error explanations.
const clone=value=>structuredClone(value),finite=Number.isFinite,integer=Number.isSafeInteger;
const sourceKey=frame=>JSON.stringify([frame.romSHA256,frame.sourceId,frame.sourceEpoch,frame.timelineSegment]);
const modelKey=a=>JSON.stringify([a.recordKey,a.modelId,a.variant]);
const frameValid=f=>f&&/^[a-f0-9]{64}$/.test(f.romSHA256??'')&&typeof f.sourceId==='string'&&f.sourceId.length>0&&integer(f.sourceEpoch)&&f.sourceEpoch>=0&&integer(f.timelineSegment)&&f.timelineSegment>=0&&finite(f.mediaTime)&&/^[a-f0-9]{64}$/.test(f.fullRGBA_SHA256??'');
const flags={identityCertified:false,actorMembershipCertified:false,birthCertified:false,absenceCertified:false,independentDrawCertified:false,minimumProvenATCalls:0};
const nativeReference=(observation,a)=>({sightingId:observation.sightingId,frameKey:observation.frameKey,sourcePTS:observation.sourcePTS,originalProposalId:observation.originalProposalId,evidenceIndex:a.evidenceIndex,rankingIndex:a.rankingIndex,branchIndex:a.branchIndex,branchId:a.branchId,recordKey:a.recordKey,proposalId:a.proposalId,...(a.sourcePoseReference?{sourcePoseReference:clone(a.sourcePoseReference)}:{})});
function eligibleAlternative(a){
 const owned=a.extent?.bodyColorOwnership,p=a.positionFx;
 return a.binding?.ready===true&&typeof a.modelId==='string'&&typeof a.recordKey==='string'&&['_f','regular'].includes(a.variant)&&a.ownGain>0&&finite(a.ownGain)&&owned?.ready===true&&owned.empty===false&&owned.knownPixels>0&&['isolated-source-opaque-binary-body-coverage','source-final-body-color-ownership'].includes(owned.kind)&&owned.roi&&['x','y','w','h'].every(k=>finite(owned.roi[k]))&&owned.roi.w>0&&owned.roi.h>0&&Array.isArray(p)&&p.length===3&&p.every(integer);
}
// Ordering only: prefer both independently supported endpoints naming the
// same ROM target. The route producer still recomputes source steering and
// eligibility. All other pairs retain their original domain and omission count.
function* orderedNativePairs(older,newer){
 const targets=(a,stage)=>{const r=a.routeHeading;if(!r||!Array.isArray(r.targets))return[];return r.targets.filter(t=>t.sourceStage===stage).map(t=>JSON.stringify([r.romSHA256,r.recordKey,r.graphSource,t.nodeIndex,t.nodeId,t.targetXYZ]));};
 const byTarget=new Map();for(let j=0;j<newer.length;j++)for(const key of new Set(targets(newer[j],'state2-update'))){if(!byTarget.has(key))byTarget.set(key,[]);byTarget.get(key).push(j);}
 const yielded=new Set();for(let i=0;i<older.length;i++)for(const key of new Set(targets(older[i],'state2-entry')))for(const j of byTarget.get(key)??[]){const pair=i+':'+j;if(yielded.has(pair))continue;yielded.add(pair);yield[older[i],newer[j]];}
 for(let i=0;i<older.length;i++)for(let j=0;j<newer.length;j++)if(!yielded.has(i+':'+j))yield[older[i],newer[j]];
}
function trackId(o){return o.tentativeImageTrack?.sameObservationBinding===true?o.tentativeImageTrack.trackId??null:null;}
function nativePair(from,to,a,b){
 const deltaPositionFx=b.positionFx.map((v,i)=>v-a.positionFx[i]);
 const x=a.extent.bodyColorOwnership.roi,y=b.extent.bodyColorOwnership.roi;
 return {modelId:a.modelId,variant:a.variant,recordKey:a.recordKey,from:nativeReference(from,a),to:nativeReference(to,b),fromPositionFx:a.positionFx.slice(),toPositionFx:b.positionFx.slice(),deltaPositionFx,worldDistanceFx:Math.hypot(...deltaPositionFx),screenDeltaPixels:[y.x+y.w/2-x.x-x.w/2,y.y+y.h/2-x.y-x.h/2],fromBodyOwnership:clone(a.extent.bodyColorOwnership),toBodyOwnership:clone(b.extent.bodyColorOwnership),fromPose:clone(a.pose),toPose:clone(b.pose),nativeGain:{from:a.ownGain,to:b.ownGain},mapIdentityCertified:false,positionIdentityCertified:false,physicalPlausibilityUnresolved:true,cameraBranchesAreFrameLocal:true,...flags};
}
/** Pure bounded proposal generation. Budgets limit computation/storage, not
 * native speed, association confidence, lifetime or permitted video gaps. */
export function buildNativeMotionContinuity(observations,{maximumIncomingSightings=128,maximumPriorSightings=128,maximumHypothesesPerPair=64,maximumPairEvaluations=32768}={}){
 const budgets={maximumIncomingSightings,maximumPriorSightings,maximumHypothesesPerPair,maximumPairEvaluations};
 if(!Object.values(budgets).every(v=>integer(v)&&v>0))throw Error('Positive native motion resource budgets required');
 const prepared=[],deferred=[],seen=new Map(),conflicts=new Set();
 for(const o of observations??[]){
  if(typeof o?.sightingId!=='string'||!o.sightingId)continue;
  if(seen.has(o.sightingId)){if(JSON.stringify(seen.get(o.sightingId))!==JSON.stringify(o))conflicts.add(o.sightingId);continue;}seen.set(o.sightingId,o);
 }
 for(const [id,o]of seen){
  if(conflicts.has(id)){deferred.push({sightingId:id,reason:'conflicting-immutable-sighting',noEventPossible:true});continue;}
  if(!frameValid(o.frame)||o.sourcePTS!==o.frame.mediaTime||typeof o.frameKey!=='string'){deferred.push({sightingId:id,reason:'own-frame-provenance-unavailable',noEventPossible:true});continue;}
  const alternatives=(o.alternatives??[]).filter(eligibleAlternative);
  if(!alternatives.length){deferred.push({sightingId:id,reason:'no-positive-bound-owned-body-support',noEventPossible:true});continue;}
  const models=new Map();for(const a of alternatives){const k=modelKey(a);if(!models.has(k))models.set(k,[]);models.get(k).push(a);}
  prepared.push({o,key:sourceKey(o.frame),models});
 }
 prepared.sort((a,b)=>b.o.sourcePTS-a.o.sourcePTS||a.o.sightingId.localeCompare(b.o.sightingId));
 const incoming=prepared.slice(0,maximumIncomingSightings),candidates=[],queries=[];let pairEvaluations=0,budgetStopped=false;
 for(const next of incoming){
  const {o:to}=next,prior=prepared.filter(p=>p.key===next.key&&p.o.sourcePTS<to.sourcePTS&&p.o.frameKey!==to.frameKey),query={sightingId:to.sightingId,consideredPriorSightings:0,compatiblePriorSightings:0,omittedPriorSightings:Math.max(0,prior.length-maximumPriorSightings),enumerationCompleteWithinSuppliedSupport:true};
  for(const previous of prior.slice(0,maximumPriorSightings)){
   if(budgetStopped){query.enumerationCompleteWithinSuppliedSupport=false;break;}
   query.consideredPriorSightings++;const {o:from}=previous,hypotheses=[];let omittedHypotheses=0;
   for(const [key,bodies]of next.models){const older=previous.models.get(key);if(!older)continue;
    nativePairs: for(const [a,b] of orderedNativePairs(older,bodies)){
     if(pairEvaluations>=maximumPairEvaluations){budgetStopped=true;query.enumerationCompleteWithinSuppliedSupport=false;break nativePairs;}
     pairEvaluations++;
     if(hypotheses.length>=maximumHypothesesPerPair){omittedHypotheses++;continue;}
     hypotheses.push(nativePair(from,to,a,b));
    }
    if(budgetStopped)break;
   }
   if(!hypotheses.length)continue;
   query.compatiblePriorSightings++;hypotheses.sort((a,b)=>a.worldDistanceFx-b.worldDistanceFx||JSON.stringify(a.from).localeCompare(JSON.stringify(b.from))||JSON.stringify(a.to).localeCompare(JSON.stringify(b.to)));
   const a=trackId(from),b=trackId(to);
   candidates.push({id:'native-motion:'+JSON.stringify([from.sightingId,to.sightingId]),fromSightingId:from.sightingId,toSightingId:to.sightingId,fromTrackId:a,toTrackId:b,sourceIdentity:[to.frame.sourceId,to.frame.sourceEpoch,to.frame.timelineSegment],romSHA256:to.frame.romSHA256,interval:{startPTS:from.sourcePTS,endPTS:to.sourcePTS,seconds:to.sourcePTS-from.sourcePTS,continuousObservation:false,interveningTrajectoryKnown:false,sourceTickIntervalKnown:false,ATCallIntervalKnown:false},existingImageTrackAgreement:a!==null&&b!==null&&a===b,hypotheses,omittedHypotheses,enumerationCompleteWithinSuppliedSupport:omittedHypotheses===0&&!budgetStopped,ranking:{basis:'ascending-world-root-displacement-only',minimumWorldDistanceFx:hypotheses[0].worldDistanceFx,calibrated:false,identityDecision:false},association:'conditional-same-individual-candidate',associationAlternatives:['same-entity','different-entity','observation-error'],noEventPossible:true,...flags});
  }
  if(query.omittedPriorSightings)query.enumerationCompleteWithinSuppliedSupport=false;queries.push(query);
 }
 // Keep both many-to-one and one-to-many relations. A nearest root does not
 // resolve crossing identical species or same-frame fragmented residuals.
 candidates.sort((a,b)=>a.toSightingId.localeCompare(b.toSightingId)||a.ranking.minimumWorldDistanceFx-b.ranking.minimumWorldDistanceFx||b.interval.startPTS-a.interval.startPTS||a.fromSightingId.localeCompare(b.fromSightingId));
 return {schema:'conditional-native-motion-continuity-v1',candidates,queries,deferred,budgets,pairEvaluations,omittedIncomingSightings:Math.max(0,prepared.length-incoming.length),budgetStopped,temporalGapLimitSeconds:null,originalSightingsPreserved:true,originalTrackIdsPreserved:true,associationEnumerationComplete:false,unknownAlternativeRetained:true,noEventPossible:true,sameModelImpliesSameActor:false,worldRootProximityImpliesSameActor:false,usedForATConstraints:false,...flags,scope:'Executable predecessor candidates from two independently bound positive native owned-body hypotheses. Same ROM/map/model roots allow camera-independent displacement ranking only. No root proximity, reused image track, elapsed time or missing frame proves identity, birth, death, draw count or source ticks. Unsupported, omitted, different-actor and observation-error alternatives remain.'};
}
function timelineContext(bundle,candidate){
 const timelines=(bundle?.videoObservations??[]).map(v=>v.timeline).filter(Boolean),gaps=[],entryCandidates=[],retention=[];
 for(const t of timelines){
  const stamp=t.source,sourceMatches=stamp&&['sourceId','sourceEpoch','timelineSegment'].every((k,i)=>stamp[k]===candidate.sourceIdentity[i]);
  const matchingFrames=(t.frames??[]).filter(f=>['sourceId','sourceEpoch','timelineSegment'].every((k,i)=>f.stamp?.[k]===candidate.sourceIdentity[i]));
  if(!sourceMatches&&!matchingFrames.length)continue;
  retention.push(clone(t.retention??{complete:false,reason:'retention-metadata-unavailable'}));
  for(const gap of t.unobservedIntervals??[]){if(finite(gap.startPTS)&&finite(gap.endPTS)&&gap.endPTS>candidate.interval.startPTS&&gap.startPTS<candidate.interval.endPTS)gaps.push(clone(gap));}
  for(const event of t.entryCandidates??[]){if(finite(event.startPTS)&&finite(event.endPTS)&&event.endPTS>candidate.interval.startPTS&&event.startPTS<candidate.interval.endPTS)entryCandidates.push(clone(event));}
 }
 return {explicitUnobservedIntervals:gaps,interveningEntryCandidates:entryCandidates,entityResetPossible:true,historyRetention:retention,retainedTimelineAvailable:retention.length>0,retainedHistoryComplete:retention.length>0&&retention.every(r=>r.complete===true),unobservedIntervalRetained:true,continuousObservation:false,absenceCertified:false};
}
/** A consumable index, rather than an actor merge. Its result can accompany a
 * conditional AT branch: all linked sightings may be one latent selection,
 * but they never establish that selection or a second independent draw. */
export function createNativeMotionContinuityIndex(nativeBodySupportEvidence,{bundle=null,budgets}={}){
 const graph=budgets?buildNativeMotionContinuity(nativeBodySupportEvidence?.observations??[],budgets):nativeBodySupportEvidence?.motionContinuity??buildNativeMotionContinuity(nativeBodySupportEvidence?.observations??[]);
 const ownedGraph=clone(graph),ownedBundle=bundle?{videoObservations:(bundle.videoObservations??[]).map(v=>({timeline:v.timeline?{source:clone(v.timeline.source),frames:(v.timeline.frames??[]).map(f=>({stamp:clone(f.stamp)})),unobservedIntervals:clone(v.timeline.unobservedIntervals??[]),entryCandidates:clone(v.timeline.entryCandidates??[]),retention:clone(v.timeline.retention??null)}:null}))}:null;
 const byTarget=new Map();for(const candidate of ownedGraph.candidates){if(!byTarget.has(candidate.toSightingId))byTarget.set(candidate.toSightingId,[]);byTarget.get(candidate.toSightingId).push(candidate);}
 return {resolvePriorKnownMonsterCandidates(incomingSightingId){
  if(typeof incomingSightingId!=='string')throw Error('Incoming sighting identity required');
  const candidates=(byTarget.get(incomingSightingId)??[]).map(c=>({...clone(c),gapEvidence:timelineContext(ownedBundle,c),conditionalATInput:{kind:'conditional-single-latent-selection-association',sightingIds:[c.fromSightingId,c.toSightingId],nativeHypothesisReferences:c.hypotheses.map(h=>({modelId:h.modelId,variant:h.variant,recordKey:h.recordKey,from:clone(h.from),to:clone(h.to)})),tableSpeciesPairsRequired:true,source:'bound-native-world-root-continuity-candidate',independentDrawCount:null,additionalDrawsCertified:0,identityCertified:false,noEventPossible:true,unknownAlternativeRetained:true,minimumProvenATCalls:0}}));
  return {schema:'native-motion-predecessor-candidates-v1',incomingSightingId,candidates,query:clone(ownedGraph.queries.find(q=>q.sightingId===incomingSightingId)??null),deferred:clone(ownedGraph.deferred.filter(d=>d.sightingId===incomingSightingId)),knownSpeciesCertified:false,complete:false,originalSightingsPreserved:true,unknownAlternativeRetained:true,...flags};
 },snapshot(){return clone(ownedGraph);}};
}
