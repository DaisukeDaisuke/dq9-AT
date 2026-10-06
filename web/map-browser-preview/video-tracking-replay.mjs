import{EnemyProposalTracker,PROPOSAL_LIMITS}from'../monster-position-proposals.mjs?v=camera-loss-evidence-20261006-1205';
import{trackingGray,patchTrackingFrame,correspondVideoPatch,videoTrackingFrameKey,videoTrackingSourceKey}from'./video-patch-correspondence.mjs?v=continuity-yield-local-evidence-20261006-1458';
const clone=x=>structuredClone(x),time=f=>f.stamp.mediaTime??f.stamp.videoTime,scope=b=>JSON.stringify([b?.romSHA256,b?.recordKey,b?.mapId]),pause=()=>new Promise(r=>setTimeout(r,0));
const diagnosticNow=timing=>{try{const value=timing?.now?.();return Number.isFinite(value)?value:null;}catch{return null;}};
const frameStamp=(f,trackingObservationSequence)=>({videoTime:time(f),frameSerial:f.stamp.frameSerial??null,trackingSequenceScope:'retained-frame-replay-pair',trackingObservationSequence,sceneContext:{gameplayROI:{x:0,y:0,w:256,h:192}}});
const failureFrame=f=>({key:f.key,sourcePTS:time(f),stamp:Object.fromEntries(['sourceId','sourceEpoch','timelineSegment','timestampBasis','frameSerial','mediaTime','videoTime','layout','gameplayRGBA_SHA256','fullRGBA_SHA256'].filter(k=>f.stamp[k]!==undefined).map(k=>[k,f.stamp[k]])),pixelTimestampUs:f.stamp.captureTiming?.pixelTimestampUs??null,pixelTimestampBound:f.stamp.captureTiming?.pixelTimestampBound??null});
function restoredTracker(previous,tracks){const tracker=new EnemyProposalTracker();tracker.tracks=clone(tracks);tracker.previous={captureStamp:frameStamp(previous,0),trackingFrame:patchTrackingFrame(previous,tracks)};return tracker;}
const trackingRows=rows=>rows.map(r=>({id:r.id,roi:clone(r.roi),firstSeen:r.firstSeen,lastSeen:r.lastSeen,sightings:r.sightings,...(r.measuredCorrespondence?{partialPatch:r.measuredCorrespondence.partialPatch===true,knownPatchSamples:r.measuredCorrespondence.forward.knownSamples,observedPatchROI:clone(r.measuredCorrespondence.observedROI),unobservedPatchPixels:r.measuredCorrespondence.unobservedPatchPixels}:r.partialPatch!==undefined?{partialPatch:r.partialPatch,knownPatchSamples:r.knownPatchSamples,observedPatchROI:clone(r.observedPatchROI),unobservedPatchPixels:r.unobservedPatchPixels}:{})}));
/** Fixed-size actual-pixel replay. There are no predicted frames, root
 * propagation, species decisions or inferred birth/death/AT events here. */
export class VideoTrackingReplay {
 constructor({maximumFrames=256,maximumWorkSliceMs=8,onState=()=>{},yieldTask=pause,timing=null}={}){if(!Number.isSafeInteger(maximumFrames)||maximumFrames<2)throw Error('At least two retained measured frames required');if(!Number.isFinite(maximumWorkSliceMs)||maximumWorkSliceMs<=0)throw Error('Positive cooperative replay work budget required');Object.assign(this,{maximumFrames,maximumWorkSliceMs,onState,yieldTask,timing,generation:0,sequence:0,activeFrames:[]});this.gapLongTaskReceiver=this.acceptFirstFrameGapLongTask.bind(this);this.reset('initial');}
 reset(reason='source-reset'){try{this.gapTimingUnsubscribe?.();}catch{}this.gapTimingUnsubscribe=null;this.generation++;this.frames=[];this.history=new Map();this.classificationAnchors=new Map();this.anchorEvictions=0;this.source=null;this.batch=null;this.evictedFrames=0;this.rejectedFrames=0;this.gaps=[];this.firstLoss=null;this.firstCameraFailure=null;this.recentLosses=[];this.totalLosses=0;this.failurePixelPair=null;this.firstLocalPatchFailure=null;this.localPatchDiagnosticErrors=0;this.firstFrameGapTiming=null;this.reason=reason;if(!this.activePromise){this.busy=false;this.activePromise=null;}this.onState(this.snapshot());}
 noteGap(stamp,reason){this.gaps.push({sourcePTS:stamp?.mediaTime??stamp?.videoTime??null,reason,observed:false,absenceCertified:false});if(this.gaps.length>this.maximumFrames)this.gaps.shift();}
 retain({image,stamp}){
  const pts=stamp?.mediaTime??stamp?.videoTime;
  if(typeof stamp?.sourceId!=='string'||!['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(stamp[k])&&stamp[k]>=0)||!Number.isFinite(pts)||pts<0||!/^[a-f0-9]{64}$/.test(stamp.gameplayRGBA_SHA256??'')){this.rejectedFrames++;this.noteGap(stamp,'actual-frame-binding-unavailable');return null;}
  const source=videoTrackingSourceKey(stamp);if(this.source!==null&&source!==this.source)this.reset('source-identity-changed');this.source=source;
  const key=videoTrackingFrameKey(stamp),same=this.frames.find(f=>f.key===key);if(same)return same.key;
  const sameTime=this.frames.find(f=>time(f)===pts);if(sameTime){sameTime.conflicted=true;this.rejectedFrames++;this.generation++;this.history.clear();this.classificationAnchors.clear();if(this.batch){this.batch.tracks=[];this.batch.stopped='same-PTS-different-pixels';}this.noteGap(stamp,'same-PTS-different-pixels');this.onState(this.snapshot());return null;}
  if(this.frames.length===this.maximumFrames&&pts<time(this.frames[0])){this.rejectedFrames++;this.noteGap(stamp,'late-frame-history-evicted');return null;}
  const pixels=trackingGray(image),f={key,stamp:clone(stamp),retainedAtPerformanceMs:diagnosticNow(this.timing),...pixels};this.frames.push(f);this.frames.sort((a,b)=>time(a)-time(b));
  const at=this.frames.indexOf(f),previous=this.frames[at-1];
  if(this.timing&&!this.firstFrameGapTiming&&at===this.frames.length-1&&previous&&!previous.conflicted&&time(f)-time(previous)>PROPOSAL_LIMITS.maxGapSeconds)this.pinFirstFrameGapTiming(previous,f);
  while(this.frames.length>this.maximumFrames){const old=this.frames.shift();this.history.delete(old.key);if(this.classificationAnchors.delete(old.key))this.anchorEvictions++;this.evictedFrames++;}this.schedule();return key;
 }
 seed({stamp,backgroundEvidence,tracking,measuredContinuity=null}){
  const key=videoTrackingFrameKey(stamp),frame=this.frames.find(f=>f.key===key),pts=stamp.mediaTime??stamp.videoTime;
  if(!frame||frame.conflicted){this.noteGap(stamp,'residual-seed-frame-not-retained');return{ready:false,reason:'residual-seed-frame-not-retained',identityCertified:false};}
  if(this.batch&&pts<=time(this.batch.seed))return{ready:false,reason:'older-or-identical-seed-retained',identityCertified:false};
  const rows=(tracking?.observed??[]).slice(0,PROPOSAL_LIMITS.maxTracks);
  const valid=r=>typeof r.id==='string'&&r.id.length>0&&r.lastSeen===pts&&Number.isFinite(r.firstSeen)&&r.firstSeen<=pts&&Number.isSafeInteger(r.sightings)&&r.sightings>0&&r.roi&&['x','y','w','h'].every(k=>Number.isFinite(r.roi[k]))&&r.roi.w>0&&r.roi.h>0&&r.roi.x>=0&&r.roi.y>=0&&r.roi.x+r.roi.w<=256&&r.roi.y+r.roi.h<=192;
  if(!rows.every(valid)||new Set(rows.map(r=>r.id)).size!==rows.length){this.noteGap(stamp,'residual-seed-track-binding-unavailable');return{ready:false,reason:'residual-seed-track-binding-unavailable',identityCertified:false};}
  const tracks=trackingRows(rows),mapScope=scope(backgroundEvidence),record=this.history.get(key);
  const handoff=measuredContinuity?.ready===true&&record&&this.batch&&record.batchId===this.batch.id&&measuredContinuity.id===record.batchId+':'+key&&measuredContinuity.targetFrameKey===key&&measuredContinuity.targetSourceKey===videoTrackingSourceKey(stamp)&&measuredContinuity.mapScope===mapScope&&record.mapScope===mapScope&&measuredContinuity.seedFrameKey===record.seedFrameKey&&measuredContinuity.identityCertified===false&&measuredContinuity.minimumProvenATCalls===0;
  const keep=new Set(handoff?(measuredContinuity.associations??[]).filter(h=>record.continuedIds.includes(h.trackId)&&rows.some(r=>r.id===h.trackId&&r.originalResidualId===h.originalResidualId&&record.associationBindings?.some(a=>a.trackId===h.trackId&&a.originalResidualId===h.originalResidualId&&['x','y','w','h'].every(k=>a.roi[k]===r.roi[k])))).map(h=>h.trackId):[]);
  for(const [anchorKey,a]of this.classificationAnchors){a.rows=a.mapScope===mapScope?a.rows.filter(r=>keep.has(r.trackId)):[];if(!a.rows.length)this.classificationAnchors.delete(anchorKey);else a.measuredSeedHandoffs++;}
  const fields=['sourceId','sourceEpoch','timelineSegment','frameSerial','mediaTime','videoTime','timestampBasis','layout','fullRGBA_SHA256','gameplayRGBA_SHA256'];
  this.classificationAnchors.set(key,{sourceFrameKey:key,sourcePTS:pts,frameEvidence:Object.fromEntries(fields.filter(k=>stamp[k]!==undefined).map(k=>[k,stamp[k]])),mapScope,rows:rows.map(r=>({trackId:r.id,originalProposalId:String(r.originalResidualId),sourceROI:clone(r.roi)})),measuredSeedHandoffs:0,measuredPairsFromAnchor:0});
  this.generation++;this.history.clear();
  this.batch={id:'measured-replay-'+(++this.sequence),seed:{key:frame.key,stamp:clone(stamp)},previous:frame,tracks,mapScope:scope(backgroundEvidence),seedReferences:rows.map(r=>({trackId:r.id,originalProposalId:String(r.originalResidualId),sourceROI:clone(r.roi),sourceFrameKey:key,sourcePTS:pts})),steps:0,stopped:null,lastFailures:[]};
  this.onState(this.snapshot());this.schedule();return{ready:true,sourceFrameKey:key,tracks:tracks.length,identityCertified:false};
 }
 schedule(){if(this.busy||!this.batch||!this.frames.some(f=>time(f)>time(this.batch.previous)))return;this.busy=true;const mine=this.generation;this.activePromise=this.drain(mine).finally(()=>{this.activeFrames=[];this.busy=false;this.activePromise=null;this.schedule();});}
 retainLoss({batch,previous,next,before,proposals,failures,trackerResult,reason}){
  const remaining=new Set(batch.tracks.map(t=>t.id)),lost=before.filter(t=>!remaining.has(t.id));if(!lost.length)return;
  const record={kind:'measured-replay-track-loss-v1',sequence:++this.totalLosses,batchId:batch.id,mapScope:batch.mapScope,from:failureFrame(previous),to:failureFrame(next),deltaSeconds:time(next)-time(previous),reason:reason??'patch-or-association-rejected',beforeCount:before.length,remainingCount:batch.tracks.length,lostTracks:lost.map(t=>({id:t.id,roi:clone(t.roi),reasons:failures.filter(f=>f.trackId===t.id).map(f=>f.reason)})),rejectedCameraAttempt:trackerResult?.rejectedCameraAttempt?clone(trackerResult.rejectedCameraAttempt):null,diagnosticOnly:true,absenceCertified:false,identityCertified:false,minimumProvenATCalls:0};
  this.firstLoss??=record;this.recentLosses.push(record);if(this.recentLosses.length>8)this.recentLosses.shift();
  const gap=this.firstFrameGapTiming;if(record.reason==='unobserved-or-conflicted-frame-gap'&&gap?.from.key===record.from.key&&gap.to.key===record.to.key){gap.matchingReplayLossCount++;gap.firstMatchingReplayLoss??={sequence:record.sequence,batchId:record.batchId,reason:record.reason,fromFrameKey:record.from.key,toFrameKey:record.to.key,lostTrackCount:record.lostTracks.length};}
  if(record.rejectedCameraAttempt&&!this.firstCameraFailure){
   this.firstCameraFailure=record;
   // One owned pair only, 2 * (49,152 gray + 49,152 blocked) = 196,608 bytes.
   // Registration masks can be exactly reconstructed from these bounded ROIs.
   this.failurePixelPair={previous:{...failureFrame(previous),gray:previous.gray.slice(),blocked:previous.blocked.slice()},current:{...failureFrame(next),gray:next.gray.slice(),blocked:next.blocked.slice()},previousTracks:before.map(t=>({id:t.id,roi:clone(t.roi)})),currentProposals:proposals.map(p=>({proposalId:p.proposalId,roi:clone(p.roi)}))};
  }
 }
 // Select by existing failure stages only. Tiny/flat patch precheck failures
 // cannot consume this single pair; no tuned score, identity, ROI or PTS filter.
 retainLocalPatchFailure({batch,previous,next,attempts}){
  if(this.firstLocalPatchFailure||!attempts?.length)return;
  try{
   const registrationRejected=r=>r&&!r.ready&&(r.reason==='patch-registration-outside-existing-gates'||r.reason==='patch-registration-tied');
   const meaningful=a=>!a.result.ready&&(registrationRejected(a.result.forward)||registrationRejected(a.result.backward)||(a.result.forward?.ready&&a.result.backward?.ready));
   if(!attempts.some(meaningful))return;
   const rows=attempts.slice(0,PROPOSAL_LIMITS.maxTracks).map(a=>({trackId:a.trackId,sourceROI:clone(a.roi),ready:a.result.ready,reason:a.result.reason??null,meaningfulRegistrationFailure:!!meaningful(a),forward:a.result.forward?{fromFrameKey:previous.key,toFrameKey:next.key,result:clone(a.result.forward)}:null,backward:a.result.backward?{fromFrameKey:next.key,toFrameKey:previous.key,result:clone(a.result.backward)}:null,backwardNotRun:!a.result.backward,diagnosticOnly:true,identityCertified:false}));
   const summary={kind:'first-meaningful-local-patch-rejection-v1',batchId:batch.id,mapScope:batch.mapScope,from:failureFrame(previous),to:failureFrame(next),deltaSeconds:time(next)-time(previous),attemptCount:rows.length,meaningfulRejectedTrackCount:rows.filter(a=>a.meaningfulRegistrationFailure).length,maximumTrackAttempts:PROPOSAL_LIMITS.maxTracks,selection:'first pair with an existing registration-gate/tie rejection or forward/backward mismatch after sample/texture checks',diagnosticOnly:true,identityCertified:false,absenceCertified:false,minimumProvenATCalls:0};
   // One additional owned pair, independent of the existing camera pair:
   // 2 * (49,152 gray + 49,152 blocked) = 196,608 pixel bytes. No RGBA copies.
   const pixels={previous:{...failureFrame(previous),gray:previous.gray.slice(),blocked:previous.blocked.slice()},current:{...failureFrame(next),gray:next.gray.slice(),blocked:next.blocked.slice()}};
   this.firstLocalPatchFailure={summary,attempts:rows,pixels};
  }catch{this.localPatchDiagnosticErrors++;}
 }
 // Explicit private comparison download only. Live/ownership snapshots contain
 // the small summary/counts, never these arrays or the per-track attempt ledger.
 localPatchFailurePixelPairSnapshot(){
  const saved=this.firstLocalPatchFailure;if(!saved)return null;
  try{const frame=f=>{const {gray,blocked,...metadata}=f;return{...clone(metadata),gray:Array.from(gray),blocked:Array.from(blocked)};};return{...clone(saved.summary),width:256,height:192,retainedBytes:196608,maximumBytes:196608,previous:frame(saved.pixels.previous),current:frame(saved.pixels.current),attempts:clone(saved.attempts),pixelDerivation:'trackingGray: (R*77+G*150+B*29)>>8; blocked: alpha!==255. Stamp hashes identify the original sampled RGBA, not these derived gray/blocked arrays. Replay correspondVideoPatch on each sourceROI; backward uses the translated forward ROI.',diagnosticOnly:true};}catch{this.localPatchDiagnosticErrors++;return{kind:'local-patch-rejection-export-unavailable',diagnosticOnly:true,identityCertified:false,minimumProvenATCalls:0};}
 }
 lossEvidenceSnapshot(){return clone({firstLoss:this.firstLoss,firstCameraFailure:this.firstCameraFailure,recentLosses:this.recentLosses,totalLosses:this.totalLosses,maximumRecentLosses:8,evictedRecentLosses:Math.max(0,this.totalLosses-8),localPatchFailure:{firstPair:this.firstLocalPatchFailure?.summary??null,diagnosticRecordErrors:this.localPatchDiagnosticErrors,maximumPairs:1,maximumTrackAttempts:PROPOSAL_LIMITS.maxTracks,retainedBytes:this.firstLocalPatchFailure?196608:0,maximumBytes:196608,exportedOnlyOnExplicitComparisonDownload:true},failurePixels:{retained:!!this.failurePixelPair,maximumPairs:1,retainedBytes:this.failurePixelPair?196608:0,maximumBytes:196608,exportedOnlyOnExplicitComparisonDownload:true},diagnosticOnly:true});}
 // Never called by onState/preview. Pixel arrays enter the explicit private
 // comparison download only; normal snapshots contain bounded scalar evidence.
 failurePixelPairSnapshot(){const pair=this.failurePixelPair;if(!pair)return null;const frame=f=>{const {gray,blocked,...metadata}=f;return{...clone(metadata),gray:Array.from(gray),blocked:Array.from(blocked)};};return{kind:'first-rejected-camera-registration-pixels-v1',width:256,height:192,retainedBytes:196608,maximumBytes:196608,previous:frame(pair.previous),current:frame(pair.current),previousTracks:clone(pair.previousTracks),currentProposals:clone(pair.currentProposals),rejectedCameraAttempt:clone(this.firstCameraFailure.rejectedCameraAttempt),pixelDerivation:'trackingGray: (R*77+G*150+B*29)>>8; blocked: alpha!==255. Stamp hashes identify the original sampled RGBA, not these derived gray/blocked arrays. Rebuild masks with patchTrackingFrame and the retained ROI lists.',diagnosticOnly:true,cameraIdentityCertified:false,minimumProvenATCalls:0};}
 pinFirstFrameGapTiming(previous,next){
  const window={startedAtMs:previous.retainedAtPerformanceMs,endedAtMs:next.retainedAtPerformanceMs,basis:'actual frame-retention events after pixel hash, not decoded callback delivery'},saved=this.firstFrameGapTiming={schema:'first-retained-frame-gap-timing-v1',from:failureFrame(previous),to:failureFrame(next),deltaSeconds:time(next)-time(previous),existingMaximumGapSeconds:PROPOSAL_LIMITS.maxGapSeconds,capturedAtPerformanceMs:next.retainedAtPerformanceMs,performanceWindow:window,timing:null,timingSnapshotStatus:'unavailable',timingUnavailableReason:null,longTaskWatchStatus:'unavailable',overlappingLongTasks:[],highestLongTaskSequenceSeen:0,droppedOverlappingLongTasks:0,diagnosticRecordErrors:0,maximumOverlappingLongTasks:16,maximumSavedSnapshots:1,additionalPixelBytes:0,matchingReplayLossCount:0,firstMatchingReplayLoss:null,diagnosticOnly:true,scope:'First advancing retention gap only. A later real frame may fill it; no missing frame or cause is inferred. Exact replay-loss linkage is separate. The bounded ledger is frozen here; at most 16 delayed completed long tasks overlapping this original performance window may be appended.',minimumProvenATCalls:0};
  if(!Number.isFinite(window.startedAtMs)||!Number.isFinite(window.endedAtMs)||window.endedAtMs<window.startedAtMs){saved.timingUnavailableReason='performance-clock-unavailable';return;}
  try{
   const record=this.timing.snapshot({flushCompletedLongTasks:true});
   if(record?.schema!=='video-background-pipeline-timing-v1'||!Array.isArray(record.recent)||record.recent.length>64||!Array.isArray(record.stages)||record.stages.length>32||!record.longest||Object.keys(record.longest).length>4||Object.values(record.longest).some(a=>!Array.isArray(a)||a.length>16))throw Error('Unsupported timing snapshot');
   saved.timing=clone(record);saved.timingSnapshotStatus='captured';
   const rows=[...saved.timing.recent,...(saved.timing.longest['browser-main-thread-long-task']??[])].sort((a,b)=>a.sequence-b.sequence);
   for(const row of rows)this.acceptFirstFrameGapLongTask(row);
  }catch{saved.timing=null;saved.timingSnapshotStatus='unavailable';saved.timingUnavailableReason='timing-snapshot-unavailable';}
  // All work above is synchronous. Install after draining/sorting the bounded
  // snapshot, so later deliveries have increasing sequence IDs and need no set.
  try{const dispose=this.timing.watchFirstFrameGapLongTasks(window.startedAtMs,window.endedAtMs,this.gapLongTaskReceiver);if(typeof dispose==='function'){this.gapTimingUnsubscribe=dispose;saved.longTaskWatchStatus='watching-original-window';}}catch{/* Optional diagnostics cannot interrupt retain/schedule. */}
 }
 acceptFirstFrameGapLongTask(row){
  const saved=this.firstFrameGapTiming;if(!saved||row.kind!=='browser-main-thread-long-task'||!(row.startedAtMs<saved.performanceWindow.endedAtMs&&row.endedAtMs>saved.performanceWindow.startedAtMs)||!Number.isSafeInteger(row.sequence)||row.sequence<=saved.highestLongTaskSequenceSeen)return;
  saved.highestLongTaskSequenceSeen=row.sequence;
  if(saved.overlappingLongTasks.length>=16){saved.droppedOverlappingLongTasks++;return;}
  try{saved.overlappingLongTasks.push(clone(row));}catch{saved.diagnosticRecordErrors++;}
 }
 // Explicit comparison download only; never append this ledger to live preview,
 // ownership-cloned observation bundles, or each retained frame.
 firstFrameGapTimingSnapshot(){
  if(!this.firstFrameGapTiming)return null;let flushStatus='requested';try{this.timing?.flushCompletedLongTasks?.();}catch{flushStatus='unavailable';}
  const saved=this.firstFrameGapTiming;return clone({...saved,longTaskAttribution:{status:saved.overlappingLongTasks.length?'overlap-observed-function-unattributed':saved.timing?.observerStatus==='observing'?'no-overlap-recorded-not-proof-of-absence':'observer-or-snapshot-unavailable',observerStatusAtGap:saved.timing?.observerStatus??'unavailable',completedRecordFlush:flushStatus,absenceEstablished:false,functionAttributionAvailable:false,delayedCompletedRecordsAccepted:typeof this.gapTimingUnsubscribe==='function',unfinishedTaskAtExportMayBeUnavailable:true}});
 }
 async drain(mine){
  while(mine===this.generation&&this.batch){const b=this.batch,next=this.frames.find(f=>time(f)>time(b.previous));if(!next)break;const previous=b.previous,before=trackingRows(b.tracks),dt=time(next)-time(previous),failures=[],proposals=[],localAttempts=this.firstLocalPatchFailure?null:[];let trackerResult=null,lossReason=null;this.activeFrames=[previous,next];
   if(previous.conflicted||next.conflicted||!(dt>0&&dt<=PROPOSAL_LIMITS.maxGapSeconds)){b.stopped='unobserved-or-conflicted-frame-gap';lossReason=b.stopped;b.tracks=[];this.classificationAnchors.clear();this.noteGap(next.stamp,b.stopped);}
   else if(before.length){
    let sliceStarted=performance.now();
    for(const track of before){const local=this.timing?this.timing.sync('replay-patch-correspondence',next.stamp,()=>correspondVideoPatch(previous,next,track.roi)):correspondVideoPatch(previous,next,track.roi);if(local.ready)proposals.push({proposalId:track.id,roi:local.roi,measuredCorrespondence:local});else failures.push({trackId:track.id,reason:local.reason,positionCurrent:false,absenceCertified:false});try{if(localAttempts&&localAttempts.length<PROPOSAL_LIMITS.maxTracks)localAttempts.push({trackId:track.id,roi:track.roi,result:local});}catch{this.localPatchDiagnosticErrors++;}if(performance.now()-sliceStarted>=this.maximumWorkSliceMs){await this.yieldTask();if(mine!==this.generation||this.batch!==b)return;sliceStarted=performance.now();}}
    const tracker=restoredTracker(previous,before),update=()=>tracker.update({captureStamp:frameStamp(next,1),proposals,trackingFrame:patchTrackingFrame(next,proposals)}),result=this.timing?this.timing.sync('replay-existing-tracker-update',next.stamp,update):update();trackerResult=result;lossReason=result.resetReason;
    const continued=result.observed.filter(r=>r.association==='tentative-continuation'&&r.id===r.proposalId),continuedIds=new Set(continued.map(r=>r.id));
    for(const p of proposals)if(!continuedIds.has(p.proposalId))failures.push({trackId:p.proposalId,reason:result.resetReason??'existing-association-gate-unresolved',positionCurrent:false,absenceCertified:false});
    b.tracks=trackingRows(continued);for(const [key,a]of this.classificationAnchors){a.rows=a.rows.filter(r=>continuedIds.has(r.trackId));if(!a.rows.length)this.classificationAnchors.delete(key);else a.measuredPairsFromAnchor++;}if(result.resetReason)b.stopped=result.resetReason;
    this.history.set(next.key,{batchId:b.id,previousKey:previous.key,previousFrame:previous,tracksBefore:before,continuedIds:[...continuedIds],failures:clone(failures),mapScope:b.mapScope,seedFrameKey:b.seed.key,seedPTS:time(b.seed),steps:b.steps+1});
   }
   this.retainLocalPatchFailure({batch:b,previous,next,attempts:localAttempts});this.retainLoss({batch:b,previous,next,before,proposals,failures,trackerResult,reason:lossReason});b.steps++;b.previous=next;b.lastFailures=failures;this.onState(this.snapshot());await this.yieldTask();
  }
 }
 /** Apply only when the delayed ROM residual frame itself is present. Use the
  * existing conservative tracker on its immediately preceding measured state. */
 continuityFor({stamp,backgroundEvidence,components}){
  const key=videoTrackingFrameKey(stamp),record=this.history.get(key),current=this.frames.find(f=>f.key===key);
  if(!record||!current||current.conflicted||record.previousFrame.conflicted||record.mapScope!==scope(backgroundEvidence))return{ready:false,reason:'matching-measured-history-unavailable',identityCertified:false};
  const before=record.tracksBefore.filter(t=>record.continuedIds.includes(t.id));if(!before.length)return{ready:false,reason:'no-bidirectional-object-correspondences',identityCertified:false};
  const tracker=restoredTracker(record.previousFrame,before),observed=tracker.update({captureStamp:frameStamp(current,1),proposals:components.map(r=>({...r,originalResidualId:r.id,roi:clone(r.roi)})),trackingFrame:patchTrackingFrame(current,components)}),priorIds=new Set(before.map(r=>r.id));
  const associations=observed.observed.filter(r=>r.association==='tentative-continuation'&&priorIds.has(r.id)).map(r=>({originalResidualId:r.originalResidualId,trackId:r.id,firstSeen:r.firstSeen,lastSeen:r.lastSeen,sightings:r.sightings}));
  record.associationBindings=associations.map(a=>({...a,roi:clone(components.find(c=>c.id===a.originalResidualId).roi)}));
  return{ready:associations.length>0,kind:'measured-video-patch-continuity-v1',id:record.batchId+':'+key,targetFrameKey:key,targetSourceKey:videoTrackingSourceKey(stamp),mapScope:record.mapScope,seedFrameKey:record.seedFrameKey,seedPTS:record.seedPTS,measuredSteps:record.steps,associations,identityCertified:false,birthCertified:false,absenceCertified:false,independentDrawCertified:false,minimumProvenATCalls:0};
 }
 /** Current-position access for one exact historical classification frame.
  * Anchors only survive measured patch steps and verified seed handoffs. */
 classificationAnchorFor({stamp,backgroundEvidence}){const key=videoTrackingFrameKey(stamp),a=this.classificationAnchors.get(key),retained=this.frames.find(f=>f.key===key),b=this.batch,no=reason=>({ready:false,reason,identityCertified:false,minimumProvenATCalls:0});if(!retained||retained.conflicted)return no('classification-frame-not-retained');if(!a||!b||a.mapScope!==scope(backgroundEvidence)||b.mapScope!==a.mapScope)return no('classification-lineage-unavailable');if(!['sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256','gameplayRGBA_SHA256','frameSerial'].every(k=>a.frameEvidence[k]===stamp[k]))return no('classification-anchor-evidence-differs');const ids=new Set(b.tracks.map(t=>t.id)),rows=a.rows.filter(r=>ids.has(r.trackId));return{ready:rows.length>0,kind:'measured-classification-source-anchor-v1',...clone(a),rows:clone(rows),currentFrameKey:b.previous.key,currentPTS:time(b.previous),positionCurrent:true,identityCertified:false,bodyExtentCertified:false,birthCertified:false,absenceCertified:false,minimumProvenATCalls:0};}
 snapshot(){const b=this.batch,ownedFrames=new Set([...this.frames,...this.activeFrames,...[...this.history.values()].map(h=>h.previousFrame),...(b?.previous?[b.previous]:[])]),replayPixelBytes=[...ownedFrames].reduce((n,f)=>n+f.gray.byteLength+f.blocked.byteLength,0),diagnosticPixelBytes=(this.failurePixelPair?196608:0)+(this.firstLocalPatchFailure?196608:0);return{schema:'measured-video-tracking-replay-v1',sourceKey:this.source,reason:this.reason,retainedFrames:this.frames.length,maximumFrames:this.maximumFrames,maximumWorkSliceMs:this.maximumWorkSliceMs,pixelBytes:replayPixelBytes,diagnosticPixelBytes,totalRetainedPixelBytes:replayPixelBytes+diagnosticPixelBytes,pixelByteScope:'pixelBytes covers replay frames; diagnosticPixelBytes covers separately bounded first camera and local-patch failure pairs',maximumDiagnosticPixelBytes:393216,retainedHistories:this.history.size,maximumRetainedPixelBytes:(this.maximumFrames+3)*49152*2,evictedFrames:this.evictedFrames,rejectedFrames:this.rejectedFrames,recentGaps:clone(this.gaps.slice(-8)),seedFrameKey:b?.seed.key??null,seedPTS:b?time(b.seed):null,seedFrameRetained:Boolean(b&&this.frames.some(f=>f.key===b.seed.key&&!f.conflicted)),seedEvidence:b?clone(b.seed.stamp):null,conditionalMapScope:b?.mapScope??null,currentFrameEvidence:b?clone(b.previous.stamp):null,currentFrameKey:b?.previous.key??null,currentPTS:b?time(b.previous):null,measuredSteps:b?.steps??0,tracks:clone(b?.tracks??[]),classificationAnchorRetention:{frames:this.classificationAnchors.size,rows:[...this.classificationAnchors.values()].reduce((n,a)=>n+a.rows.length,0),maximumFrames:this.maximumFrames,maximumRows:this.maximumFrames*PROPOSAL_LIMITS.maxTracks,evicted:this.anchorEvictions,historyComplete:false},seedReferences:clone(b?.seedReferences??[]),lastFailures:clone(b?.lastFailures??[]),lossEvidence:this.lossEvidenceSnapshot(),stopped:b?.stopped??null,historyComplete:false,identityCertified:false,bodyExtentCertified:false,birthCertified:false,absenceCertified:false,minimumProvenATCalls:0};}
 currentGray(){const f=this.batch?.previous;return f?{gray:f.gray.slice(),stamp:clone(f.stamp)}:null;}
 async settled(){while(this.activePromise)await this.activePromise;return this.snapshot();}
}

// Wait only for the target retained frame's measured record, not all future
// replay work. This creates no correspondence or handoff evidence by itself.
export async function waitForMeasuredReplayFrame({replay,stamp,isCurrent=()=>true,yieldTask=pause}){
 const key=videoTrackingFrameKey(stamp),source=videoTrackingSourceKey(stamp),pts=stamp.mediaTime??stamp.videoTime;
 for(;;){
  if(!isCurrent())return{recordAvailable:false,reason:'comparison-invalidated',frameKey:key};
  const state=replay.snapshot();if(state.sourceKey!==source)return{recordAvailable:false,reason:'replay-source-differs',frameKey:key};
  const frame=replay.frames.find(f=>f.key===key),record=replay.history.get(key);
  if(!frame||frame.conflicted)return{recordAvailable:false,reason:'target-frame-not-retained-or-conflicted',frameKey:key};
  if(record&&record.batchId===replay.batch?.id&&!record.previousFrame.conflicted)return{recordAvailable:true,reason:'matching-measured-record-available',frameKey:key};
  if(!replay.busy||state.currentPTS===null||state.currentPTS>=pts)return{recordAvailable:false,reason:'no-pending-measured-record-for-target',frameKey:key};
  await yieldTask();
 }
}
