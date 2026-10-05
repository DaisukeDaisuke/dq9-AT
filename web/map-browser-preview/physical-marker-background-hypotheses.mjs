/* Continue same-frame physical-marker ambiguity as image hypotheses only.
 * The existing primaryCandidate, HUD/registration predicates, and marker meaning
 * are unchanged. Missing supported COL2 never disproves an actor alternative.
 */
export function physicalMarkerBackgroundHypotheses(result,{layout,sourceImage}={}){
 const supportedInput=layout==='obs-side-1920'&&sourceImage?.width===1920&&sourceImage?.height===1080;
 const eligible=supportedInput&&result?.status==='first-player-candidate-ambiguous'&&result.binding?.kind==='physical-xz-under-ordinary-group'&&result.selection?.firstSlotHUDConfirmed===true&&result.registration?.resolved===true;
 const positions=[],alternatives=[];
 if(eligible)for(const [candidateIndex,position]of(result.candidates??[]).entries()){
  if(!position.registrationAccepted)continue;
  const slotCompatible=position.slotColorCandidates?.length===1&&position.slotColorCandidates[0]===1,heights=position.floor?.heightsFx??[];
  const reason=!slotCompatible?'slot1-color-association-unresolved':!position.world?'physical-world-coordinate-unavailable':!heights.length?'supported-COL2-height-unavailable':null;
  const evidence={kind:'ambiguous-physical-marker-background-hypothesis',candidateIndex,markerId:position.markerId,peakIndex:position.peakIndex,renderable:reason===null,reason,firstSlotHUDConfirmed:true,aggregateCalibrationStatus:result.markers?.calibration?.status??null,playerIdentityProven:false,worldPositionKnown:false,noPlayerAlternativePossible:true,otherPlayerAlternativesPossible:true,unsupportedFloorIsNotNoPlayerProof:true};
  alternatives.push(evidence);if(!reason)positions.push({position,evidence});
 }
 return{positions,diagnostics:{kind:'physical-marker-background-continuation',eligible,supportedInput,alternatives,renderableCount:positions.length,primaryCandidateUnchanged:true,playerIdentityProven:false,worldPositionKnown:false,noPlayerAlternativePossible:true,otherPlayerAlternativesPossible:true,allRuntimeBranchesSearched:false,scope:'Accepted registration and confirmed slot1 HUD allow each compatible physical-coordinate component to propose a background. Supported COL2 heights only bound rendered branches; missing heights and other/non-player marker explanations remain unresolved. Forward image agreement does not identify a player.'}};
}

export const AMBIGUOUS_MARKER_BACKGROUND_BUDGET=Object.freeze({maxBranches:128,maxMilliseconds:30000});
/** Shared across ambiguous physical markers in one frozen-frame search. */
export function createAmbiguousMarkerBackgroundBudget({budget=AMBIGUOUS_MARKER_BACKGROUND_BUDGET,now=()=>performance.now()}={}){
 if(!Number.isSafeInteger(budget.maxBranches)||budget.maxBranches<=0||!Number.isFinite(budget.maxMilliseconds)||budget.maxMilliseconds<=0)throw Error('Finite ambiguous-marker background budget required');
 let startedAt=null,attempted=0,skipped=0;
 const snapshot=()=>({...budget,attempted,skipped,elapsedMilliseconds:startedAt===null?0:now()-startedAt,timingEnforcement:'Between independent marker/height/heading/phase branches; an in-flight source operation completes or is cancelled',allRuntimeBranchesSearched:false});
 return{admit(){startedAt??=now();const reason=attempted>=budget.maxBranches?'ambiguous-marker-branch-budget-exhausted':now()-startedAt>=budget.maxMilliseconds?'ambiguous-marker-time-budget-exhausted':null;if(reason){skipped++;return{ready:false,reason};}attempted++;return{ready:true,attemptIndex:attempted-1};},snapshot};
}
