import {cloneImmutableObservationBundle} from './observation-bundle-ownership.mjs?v=gap-owned-observation-20261006-1340';
import {mapHypothesisProvenance,mapHypothesisSignature} from './map-hypothesis-provenance.mjs?v=native-body-20261006-0212';
// Scheduling/storage limits are resource budgets, never recognition thresholds.
const copy=x=>structuredClone(x);
const time=s=>s?.mediaTime??s?.videoTime;
const stampKey=s=>JSON.stringify([s?.sourceId,s?.sourceEpoch,s?.timelineSegment]);
export class VideoObservationPump {
 constructor({process,onSkipped=()=>{},onError=()=>{},onState=()=>{}}){Object.assign(this,{process,onSkipped,onError,onState,enabled:false,busy:false,generation:0});}
 start(){this.enabled=true;this.onState();}
 cancel(){this.enabled=false;this.generation++;this.onState();}
 async offer(stamp){
  if(!this.enabled)return false;
  if(this.busy){this.onSkipped(stamp,'analysis-busy');return false;}
  const generation=this.generation;this.busy=true;this.onState();
  try{await this.process(stamp,()=>this.enabled&&generation===this.generation);return generation===this.generation;}
  catch(error){if(generation===this.generation)this.onError(error);return false;}
  finally{this.busy=false;this.onState();}
 }
}
export function videoObservationFrameKey(evidence){return 'video-frame:'+JSON.stringify([evidence.sourceId??null,evidence.sourceEpoch??null,evidence.timelineSegment??null,evidence.frameSerial??null,evidence.mediaTime??evidence.videoPTS??evidence.videoTime??null])+':'+evidence.fullRGBA_SHA256;}
export function residualAssociationHints(tracking,{frameKey,sourcePTS,sourceIdentity}){
 if(!tracking)return [];
 return (tracking.observed??[]).map(row=>({kind:'tentative-image-track',frameKey,sourcePTS,sourceIdentity,proposalId:String(row.originalResidualId),trackId:row.id,association:row.association,firstSeen:row.firstSeen,lastSeen:row.lastSeen,sightings:row.sightings,alternatives:['same-entity','different-entity','observation-error'],identityCertified:false,birthCertified:false,independentDrawCertified:false,minimumProvenATCalls:0}));
}
export class VideoObservationTimeline {
 constructor({maximumFrames=128,maximumEvents=128,maximumGaps=128,timing=null}={}){if(![maximumFrames,maximumEvents,maximumGaps].every(n=>Number.isInteger(n)&&n>0))throw Error('Positive storage budgets required');Object.assign(this,{maximumFrames,maximumEvents,maximumGaps,timing,resetCount:0});this.reset('initial');}
 #timed(stage,run){return this.timing?this.timing.sync(stage,this.current?.stamp??this.source,run):run();}
 reset(reason,source=null){this.resetCount++;this.reason=reason;this.source=source?copy(source):null;this.key=source?stampKey(source):null;this.frames=[];this.events=[];this.gaps=[];this.evicted={frames:0,events:0,gaps:0};this.previousPanel=null;this.previousMap=null;this.lastCallback=null;this.current=null;this.lastGap=null;this.totalFrames=0;}
 append(list,value,maximum,kind){list.push(value);if(list.length>maximum){list.shift();this.evicted[kind]++;}return value;}
 acceptSource(stamp){const key=stampKey(stamp);if(this.key!==null&&key!==this.key)this.reset('source-epoch-changed',stamp);if(this.key===null){this.key=key;this.source=copy(stamp);}}
 callback(stamp){this.acceptSource(stamp);const previous=this.lastCallback;
  if(previous&&stamp.timestampBasis===previous.timestampBasis&&Number.isFinite(stamp.presentedFrames)&&Number.isFinite(previous.presentedFrames)&&stamp.presentedFrames>previous.presentedFrames+1)this.gap(stamp,'decoded-callbacks-not-observed',{from:time(previous),missingPresentedFrames:stamp.presentedFrames-previous.presentedFrames-1});
  this.lastCallback=copy(stamp);
 }
 gap(stamp,reason,extra={}){this.acceptSource(stamp);const pts=time(stamp);if(!Number.isFinite(pts))return;
  if(this.lastGap?.reason===reason&&this.lastGap.endPTS<=pts){this.lastGap.endPTS=pts;this.lastGap.skippedCallbacks++;this.lastGap.missingPresentedFrames+=(extra.missingPresentedFrames??0);return;}
  this.lastGap=this.append(this.gaps,{reason,startPTS:extra.from??pts,endPTS:pts,skippedCallbacks:1,missingPresentedFrames:extra.missingPresentedFrames??0,observed:false,absenceCertified:false},this.maximumGaps,'gaps');
 }
 event(value){return this.append(this.events,{...value,entryCertified:false,entryPTS:null,romLayerResetEpoch:null,romLayerResetKnown:false,ATResetKnown:false,minimumProvenATCalls:0},this.maximumEvents,'events');}
 begin(stamp,{frameSerial,panelPresent=null,layout=null,pixelHash=null}={}){this.acceptSource(stamp);this.lastGap=null;const pts=time(stamp),previous=this.current;
  if(previous&&(previous.stamp.timestampBasis!==stamp.timestampBasis||pts<previous.sourcePTS)){this.previousPanel=null;this.previousMap=null;}
  if(previous&&pts>previous.sourcePTS)this.gap(stamp,'between-analysis-samples',{from:previous.sourcePTS});this.lastGap=null;
  const row=this.append(this.frames,{frameSerial,sourcePTS:pts,stamp:copy(stamp),pixelHash,layout,panelPresent,mapCandidates:[],positionCandidates:[],mapIdentityCertified:false,backgroundState:'pending',analysisState:'pending',minimumProvenATCalls:0},this.maximumFrames,'frames');this.current=row;this.totalFrames++;
  if(panelPresent===true&&this.previousPanel?.present===false)this.event({kind:'map-entry-or-reload-candidate',cause:'name-panel-reappeared',startPTS:this.previousPanel.sourcePTS,endPTS:pts,alternatives:['map-entry','same-map-return','battle-or-menu-return','missed-panel-detection'],timing:'Name-panel appearance interval only; actual map entry may precede this interval. Not native reset time.'});
  if(typeof panelPresent==='boolean')this.previousPanel={present:panelPresent,sourcePTS:pts};return row;
 }
 maps(frameSerial,candidates,metadata={}){const row=this.frames.find(f=>f.frameSerial===frameSerial);if(!row)return false;Object.assign(row,copy(metadata));row.positionCandidates=copy(candidates);row.mapCandidates=[...new Set(candidates.map(c=>c.recordKey))].sort();
  row.mapHypothesisProvenance=mapHypothesisProvenance(row);const provenance=row.mapHypothesisProvenance,signature=mapHypothesisSignature(provenance);
  if(provenance.candidates.length&&this.previousMap&&this.previousMap.signature!==signature)this.event({kind:'map-entry-or-reload-candidate',cause:'map-candidate-set-changed',startPTS:this.previousMap.sourcePTS,endPTS:row.sourcePTS,previousCandidates:this.previousMap.candidates,currentCandidates:copy(candidates),previousMapHypotheses:copy(this.previousMap.provenance),currentMapHypotheses:copy(provenance),alternatives:['map-change','candidate-ambiguity','observation-error'],timing:'between observed map hypotheses; exact entry unobserved'});
  if(provenance.candidates.length)this.previousMap={signature,sourcePTS:row.sourcePTS,candidates:copy(candidates),provenance:copy(provenance)};return true;
 }
 update(frameSerial,patch){const row=this.frames.find(f=>f.frameSerial===frameSerial);if(!row)return false;Object.assign(row,this.timing?this.timing.sync('timeline-update-clone',row.stamp,()=>copy(patch)):copy(patch));return true;}
 #snapshotRecord(){return {schema:'video-map-observation-timeline-v1',source:this.source,resetReason:this.reason,resetCount:this.resetCount,totalAnalyzedFrames:this.totalFrames,frames:this.frames,entryCandidates:this.events,unobservedIntervals:this.gaps,retention:{maximumFrames:this.maximumFrames,maximumEvents:this.maximumEvents,maximumGaps:this.maximumGaps,evicted:this.evicted,complete:this.evicted.frames+this.evicted.events+this.evicted.gaps===0},coverage:{everyDecodedFrameObserved:false,continuousRecognitionComplete:false,entryDetectionComplete:false,romLayerResetKnown:false,absenceCertified:false},minimumProvenATCalls:0,currentVideoStateRecovered:false};}
 snapshot(){return this.#timed('timeline-snapshot-clone',()=>copy(this.#snapshotRecord()));}
 // Compose the current timeline before the single ownership clone. The old
 // observation's timeline would otherwise be cloned and immediately discarded.
 // Fast path requires the inspected residual producer's fresh envelope, with
 // no other references to that wrapper inside value. Metadata alone is not
 // proof of this contract. Generic callers retain the legacy alias behavior.
 // The fast-path callback receives a detached immutable plain graph so AT can
 // share it safely; built-in mutable values retain full-copy ownership.
 snapshotBundle(value,{unaliasedResidualEnvelope=false}={}){
  const observations=value.videoObservations;
  if(unaliasedResidualEnvelope!==true||value.schema!=='headless-monster-observation-bundle-v1'||value.producer!=='browser-ROM-background-residual'||!Array.isArray(observations)||observations.length!==1||!Object.hasOwn(observations,0)||observations[0]?.kind!=='partial-video-observation-timeline'||Object.getPrototypeOf(observations[0])!==Object.prototype){
   const completed=this.#timed('observation-bundle-clone',()=>copy(value));for(const item of completed.videoObservations??[])item.timeline=this.snapshot();return completed;
  }
  const timeline=this.#snapshotRecord();
  return this.#timed('observation-bundle-clone',()=>cloneImmutableObservationBundle({...value,videoObservations:observations.map(item=>({...item,timeline}))}));
 }
 // JSON serialization is synchronous, so it needs no detached graph before
 // converting this already-owned state to a string. No live references escape.
 stringifySnapshot(space=2){return JSON.stringify({...this.#snapshotRecord(),...(this.timing?{videoPipelineTiming:this.timing.snapshot()}:{})},null,space);}
}
