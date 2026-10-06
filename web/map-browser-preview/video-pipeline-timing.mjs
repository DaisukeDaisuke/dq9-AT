// Bounded diagnostics for the existing video/background pipeline, never input
// to recognition or continuity gates. Performance times share this page's clock.
const binding=stamp=>({sourceId:stamp?.sourceId??null,sourceEpoch:stamp?.sourceEpoch??null,timelineSegment:stamp?.timelineSegment??null,frameSerial:stamp?.frameSerial??null,sourcePTS:stamp?.mediaTime??stamp?.videoTime??null});
export class VideoPipelineTiming{
 constructor({now=()=>performance.now(),timeOrigin=globalThis.performance?.timeOrigin??null,Observer=globalThis.PerformanceObserver}={}){Object.assign(this,{now,timeOrigin,Observer,observer:null,observerGeneration:0});this.reset('initial');}
 reset(reason){this.disconnect();this.firstGapLongTaskWatcher=null;this.reason=reason;this.startedAtMs=this.now();this.recent=[];this.longest={'synchronous-span':[],'async-elapsed-not-CPU-time':[],'callback-interval-not-CPU-time':[],'browser-main-thread-long-task':[]};this.stages=new Map();this.sequence=0;this.evicted=0;this.lastCallback=null;this.lastCallbackBoundary=null;this.callbackCount=0;this.observerStatus='not-started';}
 record(stage,startedAtMs,endedAtMs,stamp=null,extra={},kind='synchronous-span'){
  if(!Number.isFinite(startedAtMs)||!Number.isFinite(endedAtMs)||endedAtMs<startedAtMs)return;
  const row={sequence:++this.sequence,stage,kind,startedAtMs,endedAtMs,durationMs:endedAtMs-startedAtMs,...binding(stamp),...extra};
  this.recent.push(row);if(this.recent.length>64){this.recent.shift();this.evicted++;}
  const longest=this.longest[kind];if(longest){longest.push(row);longest.sort((a,b)=>b.durationMs-a.durationMs||a.sequence-b.sequence);if(longest.length>16)longest.length=16;}
  // Fixed production stage names. Unknown dynamic names cannot grow storage.
  let summary=this.stages.get(stage);if(!summary&&this.stages.size<32){summary={stage,kind,count:0,totalDurationMs:0,maximumDurationMs:0,maximumSpan:null};this.stages.set(stage,summary);}if(summary){summary.count++;summary.totalDurationMs+=row.durationMs;if(!summary.maximumSpan||row.durationMs>summary.maximumDurationMs){summary.maximumDurationMs=row.durationMs;summary.maximumSpan=row;}}
  const watcher=this.firstGapLongTaskWatcher;if(kind==='browser-main-thread-long-task'&&watcher&&row.startedAtMs<watcher.end&&row.endedAtMs>watcher.start){try{watcher.receive(row);}catch{/* Diagnostic retention cannot change observation. */}}
 }
 sync(stage,stamp,run){const started=this.now(),generation=this.observerGeneration;let threw=true;try{const value=run();threw=false;return value;}finally{if(generation===this.observerGeneration)this.record(stage,started,this.now(),stamp,{threw});}}
 // A finish callback adds no Promise, timer, microtask, or scheduling boundary.
 beginElapsed(stage,stamp){const started=this.now(),generation=this.observerGeneration;return()=>{if(generation===this.observerGeneration)this.record(stage,started,this.now(),stamp,{},'async-elapsed-not-CPU-time');};}
 callbackBoundary(reason){this.lastCallback=null;this.lastCallbackBoundary={reason,atMs:this.now()};}
 callback(stamp){const now=this.now(),current={...binding(stamp),timestampBasis:stamp?.timestampBasis,presentedFrames:stamp?.presentedFrames??null,deliveredAtMs:now},old=this.lastCallback;this.lastCallback=current;this.callbackCount++;
  if(old&&['sourceId','sourceEpoch','timelineSegment','timestampBasis'].every(k=>old[k]===current[k]))this.record('decoded-callback-interval',old.deliveredAtMs,now,stamp,{previousSourcePTS:old.sourcePTS,sourcePTSDeltaSeconds:Number.isFinite(current.sourcePTS)&&Number.isFinite(old.sourcePTS)?current.sourcePTS-old.sourcePTS:null,presentedFramesDelta:Number.isFinite(current.presentedFrames)&&Number.isFinite(old.presentedFrames)?current.presentedFrames-old.presentedFrames:null},'callback-interval-not-CPU-time');
 }
 start(){if(this.observer||this.observerStatus==='unsupported'||this.observerStatus==='failed')return;const Observer=this.Observer;if(typeof Observer!=='function'||Observer.supportedEntryTypes&&!Observer.supportedEntryTypes.includes('longtask')){this.observerStatus='unsupported';return;}const mine=this.observerGeneration;
  try{this.observer=new Observer(list=>{if(mine!==this.observerGeneration)return;try{this.collectLongTasks(list.getEntries());}catch{/* Optional browser diagnostics cannot interrupt observation. */}});this.observer.observe({type:'longtask',buffered:false});this.observerStatus='observing';}catch{try{this.observer?.disconnect();}catch{}this.observer=null;this.observerStatus='failed';}
 }
 collectLongTasks(entries){for(const entry of entries)this.record('browser-long-task',entry.startTime,entry.startTime+entry.duration,null,{name:entry.name??null},'browser-main-thread-long-task');}
 // One first-frame-gap window, not a general subscription/event queue. A
 // delayed observer delivery may still describe a task inside that old window.
 watchFirstFrameGapLongTasks(start,end,receive){const watcher={start,end,receive};this.firstGapLongTaskWatcher=watcher;return()=>{if(this.firstGapLongTaskWatcher===watcher)this.firstGapLongTaskWatcher=null;};}
 flushCompletedLongTasks(){try{if(this.observer)this.collectLongTasks(this.observer.takeRecords?.()??[]);}catch{}}
 disconnect(){this.flushCompletedLongTasks();this.observerGeneration++;try{this.observer?.disconnect();}catch{}this.observer=null;if(this.observerStatus==='observing')this.observerStatus='disconnected';}
 snapshot({flushCompletedLongTasks=false}={}){if(flushCompletedLongTasks)this.flushCompletedLongTasks();return structuredClone({schema:'video-background-pipeline-timing-v1',diagnosticOnly:true,reason:this.reason,timeOrigin:this.timeOrigin,startedAtMs:this.startedAtMs,snapshotAtMs:this.now(),observerStatus:this.observerStatus,callbackCount:this.callbackCount,lastCallback:this.lastCallback,lastCallbackBoundary:this.lastCallbackBoundary,retention:{maximumRecentSpans:64,maximumLongestSpansPerKind:16,maximumLongestSpans:64,maximumStages:32,evictedRecent:this.evicted},totalRecords:this.sequence,recent:this.recent,longest:this.longest,stages:[...this.stages.values()],scope:'Synchronous spans can include nested spans; do not add their totals. Async elapsed and callback intervals are not CPU durations. Browser long tasks are page-wide and do not by themselves identify a source function. Correlate performance-time overlap and original PTS; no missing frame is reconstructed.',identityCertified:false,minimumProvenATCalls:0});}
}
