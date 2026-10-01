/* Bounded latest-frame observation scheduling. Ranks are historical candidate observations,
 * never accepted enemies, native tracks, births or AT facts. No frames are queued. */
import {proposeEnemyROIs,EnemyProposalTracker,proposalRecognitionRequest} from './monster-position-proposals.mjs';
import {validateRGBA} from './monster-roi-descriptor.mjs';
export const VIDEO_OBSERVER_LIMITS=Object.freeze({cpuIntervalMs:250,classifyIntervalMs:500,trackRefreshMs:5000,denseIntervalMs:3000,denseMaxFrameAgeMs:1500,maxSourcePixels:2097152,maxProposals:8,maxAttemptRecords:32});
const need=(v,m)=>{if(!v)throw Error(m);},clone=v=>structuredClone(v);
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const key=v=>JSON.stringify(canonical(v));
const sourceKey=s=>key(Object.fromEntries(['sourceId','sourceEpoch','timelineSegment','romEpoch','sourceFrame','featureMethod','inferenceBackend','sceneContext'].map(k=>[k,s?.[k]??null])));
const safeCandidate=p=>p.classificationEligible!==false&&p.roi&&['x','y','w','h'].every(k=>Number.isInteger(p.roi[k]))&&p.roi.w>0&&p.roi.h>0&&p.roi.w<=1024&&p.roi.h<=1024&&p.roi.w*p.roi.h<=1048576;
export class LatestVideoObserver{
 constructor({prepare,classify,supplement,cancelActive=()=>{},onPositions=()=>{},onObservation=()=>{},onState=()=>{},onProgress=()=>{},now=()=>performance.now(),nextID,propose=proposeEnemyROIs,tracker=new EnemyProposalTracker()}={}){
  need(typeof prepare==='function'&&typeof classify==='function','Preparation and classifier adapters required');
  Object.assign(this,{prepare,classify,supplement,cancelActive,onPositions,onObservation,onState,onProgress,now,propose,tracker});
  this.sequence=0;this.nextID=nextID??(()=>`video-observation-${++this.sequence}`);this.generation=0;this.running=false;this.active=null;this.latest=null;
 }
 start(config){
  this.stop('restart');need(config?.captureStamp?.featureMethod==='dinov2','Video observations require DINO');
  need(config.captureStamp.sceneContext?.kind==='field'&&config.captureStamp.sceneContext.excludeCenter,'Explicit field and center exclusion required');
  const f=config.captureStamp.sourceFrame;need(f&&f.width*f.height<=VIDEO_OBSERVER_LIMITS.maxSourcePixels,'Automatic video source exceeds the 2M-pixel limit');
  this.config=clone(config);this.sourceIdentity=sourceKey(config.captureStamp);this.running=true;this.prepared=false;this.latest=null;this.tracker.reset();this.attempts=new Map();this.cursor=0;
  this.lastCPUAt=-Infinity;this.lastPTS=-Infinity;this.nextClassAt=this.now();this.lastDenseAt=-Infinity;this.completed=0;this.lastDenseAfterClass=-1;this.forceCPU=false;
  this.stats={sampledFrames:0,classificationsStarted:0,classificationsCompleted:0,supplementsStarted:0,discardedDenseFrames:0,maxActiveJobs:0,maxLatestSnapshots:0};
  this.onState({running:true,phase:'preparing',stats:{...this.stats}});this._pump();
 }
 stop(reason='stopped'){
  const wasRunning=this.running,job=this.active;this.generation++;this.running=false;this.active=null;this.latest=null;this.prepared=false;this.tracker.reset();this.attempts?.clear();
  if(job){job.controller.abort();this.cancelActive();}
  if(wasRunning)this.onState({running:false,phase:reason,stats:{...this.stats}});
 }
 shouldSample(pts,wall=this.now()){return this.running&&Number.isFinite(pts)&&pts>=0&&pts>this.lastPTS&&wall-this.lastCPUAt>=VIDEO_OBSERVER_LIMITS.cpuIntervalMs;}
 sample(image,captureStamp,wall=this.now()){
  if(!this.running)return false;
  if(sourceKey(captureStamp)!==this.sourceIdentity){this.stop('source-or-configuration-change');return false;}
  if(!this.shouldSample(captureStamp.videoTime,wall))return false;
  validateRGBA(image,VIDEO_OBSERVER_LIMITS.maxSourcePixels);need(image.width===captureStamp.sourceFrame.width&&image.height===captureStamp.sourceFrame.height,'Video pixels and source stamp differ');
  const owned={width:image.width,height:image.height,rgba:new Uint8ClampedArray(image.rgba)},stamp=clone(captureStamp);
  const result=this.propose(owned,stamp,{profile:'shrine-blue-v1',excludeCommandHUD:true,maxProposals:8});
  need(key(result.captureStamp)===key(stamp)&&result.proposals.length<=8,'Proposal stamp or budget mismatch');
  const association=this.tracker.update(result),{trackingFrame,...summary}=result;
  this.latest={image:owned,result:{...summary,proposals:association.observed},wallAt:wall,association};this.lastCPUAt=wall;this.lastPTS=stamp.videoTime;this.stats.sampledFrames++;this.stats.maxLatestSnapshots=1;
  // This callback is synchronous. A renderer must not retain or mutate these source pixels.
  this.onPositions({result:clone(this.latest.result),association:clone(association),image:owned,wallAt:wall});this._pump();return true;
 }
 acceptsProgress(message){const j=this.active;return this.running&&!!j&&j.generation===this.generation&&message.id===j.id&&message.romEpoch===this.config.captureStamp.romEpoch;}
 progress(message){if(this.acceptsProgress(message))this.onProgress(message);}
 _job(kind){const job={kind,id:this.nextID(),generation:this.generation,controller:new AbortController()};this.active=job;this.stats.maxActiveJobs=Math.max(this.stats.maxActiveJobs,1);return job;}
 _current(job){return this.running&&this.active===job&&job.generation===this.generation&&!job.controller.signal.aborted;}
 _eligible(snapshot){
  const now=this.now(),ps=snapshot.result.proposals,eligible=[];
  for(let i=0;i<ps.length;i++){const p=ps[i],last=this.attempts.get(p.id)??-Infinity;if(safeCandidate(p)&&now-last>=VIDEO_OBSERVER_LIMITS.trackRefreshMs)eligible.push({p,i,last,turn:(i-this.cursor+ps.length)%ps.length});}
  eligible.sort((a,b)=>a.last-b.last||a.turn-b.turn);return eligible[0]??null;
 }
 _attempt(candidate,snapshot){
  const p=candidate.p;this.attempts.delete(p.id);this.attempts.set(p.id,this.now());while(this.attempts.size>VIDEO_OBSERVER_LIMITS.maxAttemptRecords)this.attempts.delete(this.attempts.keys().next().value);
  this.cursor=(candidate.i+1)%Math.max(1,snapshot.result.proposals.length);
 }
 _authentic(message,job,stamp){return this._current(job)&&message?.id===job.id&&message.romEpoch===stamp.romEpoch&&key(message.result?.captureStamp)===key(stamp);}
 async _pump(){
  if(!this.running||this.active)return;
  if(!this.prepared){
   const job=this._job('prepare');try{await this.prepare({...clone(this.config),id:job.id,signal:job.controller.signal});if(!this._current(job))return;this.prepared=true;this.onState({running:true,phase:'observing',stats:{...this.stats}});}
   catch(e){if(this._current(job))this.stop(`error: ${e.message}`);}finally{if(this._current(job)){this.active=null;this._pump();}}return;
  }
  const snapshot=this.latest;if(!snapshot||this.now()-snapshot.wallAt>500||this.now()<this.nextClassAt)return;
  let candidate=this._eligible(snapshot);
  const dense=!!this.config.denseSupplement&&typeof this.supplement==='function'&&!this.forceCPU&&snapshot.result.proposals.length<8&&this.completed>this.lastDenseAfterClass&&this.now()-this.lastDenseAt>=VIDEO_OBSERVER_LIMITS.denseIntervalMs&&(this.completed>0||!snapshot.result.proposals.length);
  if(!candidate&&!dense)return;
  const job=this._job(dense?'supplement':'classify');
  try{
   let source=snapshot.result;
   if(dense){
    this.lastDenseAt=this.now();this.lastDenseAfterClass=this.completed;this.stats.supplementsStarted++;this.forceCPU=true;
    const message=await this.supplement({type:'supplement',id:job.id,romEpoch:source.captureStamp.romEpoch,captureStamp:clone(source.captureStamp),current:clone(source),image:{...snapshot.image,rgba:snapshot.image.rgba.slice()},modelIds:[...this.config.modelIds],variant:this.config.variant,preset:this.config.preset,featureMethod:'dinov2',inferenceBackend:this.config.inferenceBackend},{signal:job.controller.signal});
    if(!this._current(job))return;need(this._authentic(message,job,source.captureStamp),'Supplement reply belongs to another observation');
    if(this.now()-snapshot.wallAt>VIDEO_OBSERVER_LIMITS.denseMaxFrameAgeMs){this.stats.discardedDenseFrames++;return;}
    source=message.result;need(Array.isArray(source.proposals)&&source.proposals.length<=8,'Supplement budget exceeded');
    const added=new Set(source.denseAdded??[]),denseChoice=source.proposals.find(p=>added.has(p.proposalId)&&safeCandidate(p));
    if(denseChoice)candidate={p:denseChoice,i:source.proposals.indexOf(denseChoice),dense:true};
   }
   if(!candidate)return;
   if(!this._current(job))return;
   // One logical cycle owns this exact snapshot through an optional coarse pass and one crop.
   job.kind='classify';job.id=this.nextID();
   const request=proposalRecognitionRequest(snapshot.image,{...source,captureStamp:clone(source.captureStamp)},candidate.p.proposalId,{romEpoch:source.captureStamp.romEpoch,modelIds:[...this.config.modelIds],variant:this.config.variant,preset:this.config.preset,featureMethod:'dinov2',inferenceBackend:this.config.inferenceBackend});
   request.type='recognize';request.id=job.id;
   const preview={width:request.crop.width,height:request.crop.height,rgba:request.crop.rgba.slice()};
   if(!candidate.dense)this._attempt(candidate,snapshot);
   this.nextClassAt=this.now()+VIDEO_OBSERVER_LIMITS.classifyIntervalMs;this.stats.classificationsStarted++;const dispatchedAt=this.now();
   const message=await this.classify(request,{signal:job.controller.signal});
   if(!this._current(job))return;need(this._authentic(message,job,request.captureStamp),'Classifier reply belongs to another observation');
   this.completed++;this.stats.classificationsCompleted++;if(!candidate.dense)this.forceCPU=false;
   this.onObservation({captureStamp:clone(request.captureStamp),roi:clone(request.captureStamp.enemyROI),preview,result:message.result,positionObservedAt:snapshot.wallAt,dispatchedAt,completedAt:this.now(),candidateSource:candidate.dense?'dino-patch':'cpu-component',tentativeTrackId:candidate.dense?null:candidate.p.id,unknown:true,currentPositionCertified:false,enemyIdentityCertified:false,birthCertified:false,ATDrawsCertified:0});
   this.onState({running:true,phase:'observing',stats:{...this.stats}});
  }catch(e){if(this._current(job))this.stop(`error: ${e.message}`);}
  finally{if(this._current(job)){this.active=null;this._pump();}}
 }
}
