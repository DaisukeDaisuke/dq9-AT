// Automatically mine existing observation factors and EXECUTE a conditional
// replay-input join. This is not native FirstSpawnReplay or an AT-call model.
// No seconds -> frames/calls conversion, inferred seed, source pose fit or
// replacement of unknown state by zero. Rejections are local to the selected
// entry/map/located-position hypothesis; the broad unknown branch stays alive.
import {mapHypothesisFrameKey,mapHypothesisProvenance} from './map-browser-preview/map-hypothesis-provenance.mjs?v=automatic-entry-factors-20261006-1120';
const clone=x=>structuredClone(x),finite=Number.isFinite,integer=Number.isSafeInteger;
const fields=(v,ks)=>v?Object.fromEntries(ks.filter(k=>v[k]!==undefined).map(k=>[k,v[k]])):null;
const sameSource=(a,b)=>a&&b&&['romSHA256','sourceId','sourceEpoch','timelineSegment'].every(k=>a[k]!==null&&a[k]!==undefined&&a[k]===b[k]);
const validFx=n=>integer(n)&&n>=-2147483648&&n<=2147483647;
function frameBinding(f){
 const s=f?.stamp,t=f?.sourcePTS;
 if(!s||!finite(t)||(s.mediaTime??s.videoTime)!==t||typeof s.sourceId!=='string'||!s.sourceId||!integer(s.sourceEpoch)||!integer(s.timelineSegment)||!['romSHA256','fullRGBA_SHA256'].every(k=>/^[a-f0-9]{64}$/.test((k==='romSHA256'?f:s)?.[k]??'')))return null;
 return{romSHA256:f.romSHA256,sourceId:s.sourceId,sourceEpoch:s.sourceEpoch,timelineSegment:s.timelineSegment,sourcePTS:t,frameKey:mapHypothesisFrameKey(s),timestampBasis:s.timestampBasis??null};
}
const mapRef=m=>({recordKey:m.recordKey,mapId:m.mapId,fieldCode:m.fieldCode??null});
const mapRefs=maps=>[...new Map((Array.isArray(maps)?maps:[]).filter(m=>typeof m?.recordKey==='string'&&integer(m.mapId)).map(m=>[m.recordKey,mapRef(m)])).values()].sort((a,b)=>a.recordKey.localeCompare(b.recordKey));
function timelines(bundle){
 if(bundle?.schema==='video-map-observation-timeline-v1')return[bundle];
 if(bundle?.schema!=='headless-monster-observation-bundle-v1')throw Error('Frozen observation bundle/timeline required');
 return(bundle.videoObservations??[]).map(v=>v.timeline).filter(t=>t?.schema==='video-map-observation-timeline-v1');
}
/** Records are deliberately small: references, bounded intervals, map records,
 * located XZ and the original geometric floor alternatives. No images, masks,
 * model programs, or raw observation bundles are retained by the search. */
export function mineAutomaticReplayFactors(bundle){
 const frames=[],positions=[],entries=[],unresolved=[],seenFrames=new Set();
 for(const [timelineIndex,timeline]of timelines(bundle).entries()){
  const local=[];
  for(const f of timeline.frames??[]){const binding=frameBinding(f);if(!binding){unresolved.push({timelineIndex,frameSerial:f?.frameSerial??null,reason:'Frame source/ROM/timestamp binding unavailable'});continue;}const maps=mapHypothesisProvenance(f),row={binding,maps:mapRefs(maps.candidates),panelPresent:f.panelPresent??null,frameSerial:f.frameSerial,positionRows:[]};local.push(row);
   for(const [positionIndex,p]of (Array.isArray(f.positionCandidates)?f.positionCandidates:[]).entries()){
    const own=row.maps.find(m=>m.recordKey===p?.recordKey),position={timelineIndex,positionIndex,frame:binding,recordKey:p?.recordKey??null,mapId:p?.mapId??null,descriptor:p?.descriptorPath??p?.descriptor??null,world:validFx(p?.world?.xFx)&&validFx(p?.world?.zFx)?{xFx:p.world.xFx,zFx:p.world.zFx}:null,floorHeightsFx:Array.isArray(p?.floorHeightsFx)&&p.floorHeightsFx.every(validFx)?p.floorHeightsFx.slice():null,bindingReason:!own||own.mapId!==p?.mapId?'Located position differs from own-frame map provenance':p?.frameKey!==undefined&&p.frameKey!==binding.frameKey?'Explicit position frame differs from own observation':null};row.positionRows.push(position);
   }
   const boundFrameKey=binding.romSHA256+':'+binding.frameKey;if(!seenFrames.has(boundFrameKey)){seenFrames.add(boundFrameKey);frames.push(row);positions.push(...row.positionRows);}
  }
  for(const [eventIndex,e]of (Array.isArray(timeline.entryCandidates)?timeline.entryCandidates:[]).entries()){
   const base={timelineIndex,eventIndex,kind:e?.kind,cause:e?.cause,observedSignalInterval:{min:e?.startPTS,max:e?.endPTS},entryCertified:false,minimumProvenATCalls:0};
   if(e?.kind!=='map-entry-or-reload-candidate'||!finite(e.startPTS)||!finite(e.endPTS)||e.startPTS>e.endPTS){unresolved.push({...base,reason:'Malformed observed entry signal interval'});continue;}
   const before=local.filter(f=>f.binding.sourcePTS===e.startPTS),after=local.filter(f=>f.binding.sourcePTS===e.endPTS);
   if(before.length!==1||after.length!==1||!sameSource(before[0]?.binding,after[0]?.binding)){entries.push({...base,bindingReady:false,reason:'Entry witness frames absent, ambiguous or from different sources'});continue;}
   const [a,b]=[before[0],after[0]];
   if(e.cause==='map-candidate-set-changed'){
    const old=e.previousMapHypotheses?.frame,now=e.currentMapHypotheses?.frame;
    if(!old||!now||old.frameKey!==a.binding.frameKey||now.frameKey!==b.binding.frameKey||old.romSHA256!==a.binding.romSHA256||now.romSHA256!==b.binding.romSHA256||JSON.stringify(mapRefs(e.previousMapHypotheses.candidates))!==JSON.stringify(a.maps)||JSON.stringify(mapRefs(e.currentMapHypotheses.candidates))!==JSON.stringify(b.maps)){entries.push({...base,bindingReady:false,reason:'Entry map witnesses differ from retained frozen frames'});continue;}
   }else if(e.cause==='name-panel-reappeared'){
    if(a.panelPresent!==false||b.panelPresent!==true){entries.push({...base,bindingReady:false,reason:'Name-panel reappearance witnesses unavailable'});continue;}
   }else{entries.push({...base,bindingReady:false,reason:'Unsupported entry-signal cause retained'});continue;}
   const destinations=b.maps,origins=a.maps.length?a.maps:[null];
   if(!destinations.length){entries.push({...base,bindingReady:false,source:b.binding,reason:'Destination map hypothesis unavailable; no current map is invented'});continue;}
   for(const destination of destinations)for(const origin of origins){
    const changedMap=e.cause==='map-candidate-set-changed'&&origin&&origin.recordKey!==destination.recordKey;
    entries.push({...base,bindingReady:true,source:b.binding,entryWitnessFrames:{before:a.binding,after:b.binding},fromMap:origin,toMap:destination,entryTimeHypothesis:{min:changedMap?e.startPTS:null,max:e.endPTS,lowerBoundKnown:Boolean(changedMap),basis:changedMap?'Selected replay-entry marker assumed between the old/new map observations; earlier native loader entry remains in the broad unknown branch':'Reappearance/same-map ambiguity can occur after actual entry; no finite lower entry bound'},alternatives:['map-entry','same-map-or-return','candidate-ambiguity','observation-error'],timingCertified:false,nativeLoaderTimingCertified:false});
   }
  }
 }
 return{schema:'automatic-video-replay-factors-v1',frames:frames.map(f=>({frame:f.binding,mapHypotheses:f.maps})),entries,positions,unresolved,initialSeed:null,initialSeedInferred:false,cadence:null,ATCallRange:null,minimumProvenATCalls:0};
}
/** A position observation and an entry/map choice are only compatible if their
 * source/ROM/record bindings and conditional time domains can coexist. The
 * actual marker position is kept as a PLAYER-location hypothesis, never used
 * as an enemy root or a proven geometric/native floor assignment. */
export function evaluateReplayInputPair(entry,position){
 const refs={entry:{timelineIndex:entry.timelineIndex,eventIndex:entry.eventIndex},position:{timelineIndex:position.timelineIndex,positionIndex:position.positionIndex,frameKey:position.frame.frameKey}};
 const reject=reason=>({status:'incompatible-with-conditional-branch',reason,...refs}),defer=reason=>({status:'unresolved',reason,...refs});
 if(!entry.bindingReady)return defer(entry.reason);
 if(!sameSource(entry.source,position.frame))return reject('source-ROM-epoch-segment-disjoint');
 if(position.bindingReason)return reject('position-provenance-incompatible: '+position.bindingReason);
 if(position.recordKey!==entry.toMap.recordKey||position.mapId!==entry.toMap.mapId)return reject('destination-map-record-disjoint');
 const min=entry.entryTimeHypothesis.min,max=Math.min(entry.entryTimeHypothesis.max,position.frame.sourcePTS);
 if(min!==null&&max<min)return reject('target-precedes-conditional-entry-window');
 if(!position.world)return defer('Same-map marker XZ is unavailable; no player position is invented');
 return{status:'compatible-replay-input-hypothesis',...refs,input:{schema:'conditional-video-replay-input-v1',factorReferences:clone(refs),entryWitnessFrames:clone(entry.entryWitnessFrames),entrySignal:fields(entry,['cause','observedSignalInterval']),entryTimeHypothesis:{...entry.entryTimeHypothesis,max},source:clone(entry.source),fromMap:clone(entry.fromMap),map:clone(entry.toMap),targetFrame:clone(position.frame),mapIdentityCertified:false,entryCertified:false,playerPositionHypothesis:{world:clone(position.world),floorHeightsFx:clone(position.floorHeightsFx),descriptor:position.descriptor,positionCertified:false,playerIdentityCertified:false,nativeFloorCertified:false,enemyPositionImplied:false},unobservedTransitionsPossible:true,initialSeed:null,initialSeedInferred:false,cadence:null,ATCallRange:null,nativeRuntimePacketConstructed:false,minimumProvenATCalls:0,unresolvedSourceFacts:['Native loader/actor/runtime state at the selected entry','Source update clocks and intervening input/AT consumers','Initial AT state or conditional event-state alternatives'],scope:'Executable replay-input factor join only. Selected map/entry/position assumptions narrow this input branch, not the broad unknown world or AT universe.'}};
}
export function createAutomaticReplayInputSearch(bundle,{maximumRetainedInputs=256,maximumRejectionExamples=32}={}){
 if(!integer(maximumRetainedInputs)||maximumRetainedInputs<1||!integer(maximumRejectionExamples)||maximumRejectionExamples<0)throw Error('Explicit positive replay-input retention budgets required');
 const factors=mineAutomaticReplayFactors(bundle),inputs=[],rejections=[],unresolvedExamples=[],stats={candidatePairs:factors.entries.length*factors.positions.length,evaluatedPairs:0,compatiblePairs:0,incompatiblePairs:0,unresolvedPairs:0,unretainedCompatiblePairs:0},reasons={};let cursor=0;
 const snapshot=()=>({schema:'automatic-conditional-replay-input-search-v1',complete:cursor===stats.candidatePairs,stats:{...stats},stoppingCondition:cursor<stats.candidatePairs?'conditional-input-enumeration-in-progress':!factors.entries.length?'entry-signal-not-yet-observed':!factors.positions.length?'located-position-not-yet-observed':'conditional-input-search-complete-native-runtime-unresolved',nativeReplayBlockers:['Native loader/actor/runtime state','Source update clocks and intervening AT consumers'],ATConstraintsChanged:false,factorCounts:{entryHypotheses:factors.entries.length,positionHypotheses:factors.positions.length,frameObservations:factors.frames.length},inputs:clone(inputs),rejections:clone(rejections),unresolvedExamples:clone(unresolvedExamples),factorUnresolvedCount:factors.unresolved.length,factorUnresolved:clone(factors.unresolved.slice(0,maximumRejectionExamples)),rejectionCounts:{...reasons},retention:{maximumRetainedInputs,maximumRejectionExamples,allCompatibleInputsRetained:stats.unretainedCompatiblePairs===0},unknownBranch:{retained:true,reason:'Entry/map/position observations and unobserved runtime may be wrong or incomplete; rejected input combinations do not reject the broad unknown alternative'},initialSeedInferred:false,ATCallRange:null,cadence:null,minimumProvenATCalls:0,currentVideoStateRecovered:false,nativeReplayExecuted:false,scope:'Automatic conditional replay-input enumeration and filtering. Counts concern candidate input combinations, never actors, frames-per-second, AT calls or proven map entries.'});
 return{advance({maximumPairs=128,isCurrent=()=>true}={}){if(!integer(maximumPairs)||maximumPairs<1)throw Error('Positive replay-input work budget required');let n=0;while(cursor<stats.candidatePairs&&n++<maximumPairs){if(!isCurrent())throw new DOMException('Replay-input search cancelled or stale','AbortError');const e=factors.entries[Math.floor(cursor/factors.positions.length)],p=factors.positions[cursor%factors.positions.length],r=evaluateReplayInputPair(e,p);cursor++;stats.evaluatedPairs++;if(r.status==='compatible-replay-input-hypothesis'){stats.compatiblePairs++;if(inputs.length<maximumRetainedInputs)inputs.push(r.input);else stats.unretainedCompatiblePairs++;}else if(r.status==='incompatible-with-conditional-branch'){stats.incompatiblePairs++;reasons[r.reason]=(reasons[r.reason]??0)+1;if(rejections.length<maximumRejectionExamples)rejections.push(r);}else{stats.unresolvedPairs++;if(unresolvedExamples.length<maximumRejectionExamples)unresolvedExamples.push(r);}}if(!isCurrent())throw new DOMException('Replay-input search cancelled or stale','AbortError');return{complete:cursor===stats.candidatePairs,evaluatedPairs:stats.evaluatedPairs};},snapshot};
}
export async function searchAutomaticReplayInputs(bundle,{isCurrent=()=>true,yieldTask=()=>new Promise(r=>setTimeout(r,0)),maximumPairs=128,...retention}={}){
 const search=createAutomaticReplayInputSearch(bundle,retention);for(;;){const progress=search.advance({maximumPairs,isCurrent});if(progress.complete)return search.snapshot();await yieldTask();if(!isCurrent())throw new DOMException('Replay-input search cancelled or stale','AbortError');}
}
