import {mapLoadCallsBetweenPostStates,isPreparedConditionalMapLoadSegment} from './tracking-map-load-segments.mjs';
import {compileGap} from './at-observation-compiler.mjs';
import {prepare} from './at-identify-engine.mjs';
const copy=structuredClone;
// Inputs come from the owner-held compiled history, not reconstructed sightings.
// CompileGap and the existing numerical compiler remain the final edge/gate path.
export function compileHistoricalMapLink(before,after,segment,{maximumPairs=32}={}){
 if(!isPreparedConditionalMapLoadSegment(segment))throw Error('Source-prepared map segment required');
 if(!Number.isSafeInteger(maximumPairs)||maximumPairs<1)throw Error('Positive pair budget required');
 const source=segment.entryWitnessFrames.before;
 for(const r of[before,after]){
  if(r.identity.romSHA256!==segment.romSHA256||!['sourceId','sourceEpoch','timelineSegment'].every(k=>r.sourceVideo?.[k]===source[k]))throw Error('Historical map link crosses ROM/video/epoch/segment');
  if(r.request.domain.kind!=='all-output-classes')throw Error('Historical link requires original all-output domain; no prior is silently replaced');
 }
 if(before.identity.engineRevision!==after.identity.engineRevision)throw Error('Historical compiler versions differ');
 const match=(b,side)=>b.events.length===1&&b.events[0].eventEvidence?.sourceEvidence?.some(e=>{const anchor=segment.entryWitnessFrames[side],record=(side==='before'?segment.fromMap:segment.toMap).recordKey;return e.frame&&['romSHA256','sourceId','sourceEpoch','timelineSegment'].every(k=>e.frame[k]===anchor[k])&&(side==='before'?e.sourcePTS<=anchor.sourcePTS:e.sourcePTS>=anchor.sourcePTS)&&e.maps?.some(m=>m.recordKey===record);});
 const branches=[...before.request.experiment.branches.map(b=>({...copy(b),id:'prior-history:'+b.id})),...after.request.experiment.branches.map(b=>({...copy(b),id:'later-history:'+b.id}))];
 let pairs=0,omittedPairs=0;
 for(const a of before.request.experiment.branches.filter(b=>match(b,'before')))for(const b of after.request.experiment.branches.filter(b=>match(b,'after'))){
  if(pairs>=maximumPairs){omittedPairs++;continue;}
  const x=copy(a.events[0]),y=copy(b.events[0]);x.id='prior:'+x.id;y.id='later:'+y.id;
  const gap=mapLoadCallsBetweenPostStates(segment),edge=compileGap({from:x.id,to:y.id,...gap},new Set([x.id,y.id]));
  branches.push({id:'historical-map-load:'+pairs++,events:[x,y],edges:[edge],assumptions:[...a.assumptions,...b.assumptions,'Conditional latent selections straddle this source-bound loader segment','Original union predicates are retained; other map/table alternatives may remain; no birth or actual clock inferred'],observationEdges:[...a.observationEdges.map(e=>({...copy(e),from:x.id})),...b.observationEdges.map(e=>({...copy(e),from:y.id}))],historicalOriginalCheckpointKeys:[before.identity.historicalOwnedCheckpointKey,after.identity.historicalOwnedCheckpointKey],predicateMayRetainOtherMapTableAlternatives:true,currentVideoStateRecovered:false});
 }
 const request={experiment:{schema:'at-output-predicate-compilation-v1',branches,coverage:{eventHypothesesComplete:false,unknownAndOriginalBranchesRetained:true,omittedMapPairs:omittedPairs}},domain:{kind:'all-output-classes'},budget:{...copy(before.request.budget),maxInspectedStates:0}};
 const compiled=prepare(request);
 return {request,gate:compiled.checkpoint.branches.map(b=>({branchId:b.branchId,status:b.status,reason:b.reason??null})),conditionalPairs:pairs,omittedPairs,sourceSegment:segment,unknownAndOriginalBranchesRetained:true,eventToCurrentPropagationPerformed:false,currentATRecovered:false};
}
