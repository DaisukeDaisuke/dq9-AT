import {snapshotCpuGlyphInput,validateCpuAkinatorRequest} from './font-akinator.mjs';
import {cpuTextDiagnostic} from './font-akinator-diagnostic.mjs';
// One active CPU frame job. Default is disposable; continuous preview may reuse an idle successful ROM Worker. Cancellation and watchdog always terminate active work.
const aborted=()=>new DOMException('CPU文字照合を中止しました','AbortError');
const need=(value,message)=>{if(!value)throw Error(message);};
const stampKey=stamp=>JSON.stringify(stamp);
export function cpuUnknownResult(reason='time-budget'){
 return {route:'glyph-akinator',backend:'cpu-reference',cpuOneFrame:true,sequence:'',characters:[],candidates:[],hypotheses:[],evaluated:0,evaluationCountKnown:false,complete:false,reason,searchStopped:reason,hypothesisSearchComplete:false,thresholdSearchComplete:false,textResolved:false,fontIdentityResolved:false,confidenceCalibrated:false,unknownTextPossible:true,unsearchedTextPossible:true,provisional:true,whitespaceUnresolved:true,workerTerminated:true};
}
export class CPUTextClient {
 constructor({reuseWorker=false,factory=()=>new Worker(new URL('./font-akinator-cpu-worker.mjs',import.meta.url),{type:'module'}),setTimer=(callback,delay)=>globalThis.setTimeout(callback,delay),clearTimer=timer=>globalThis.clearTimeout(timer),now=()=>performance.now()}={}){
  Object.assign(this,{factory,setTimer,clearTimer,now,reuseWorker,idle:null,active:null,sequence:0});
 }
 match(image,{glyphsBySize,romEpoch,stamp,options={}}={}){
  // Snapshot before the first await; source/ROM changes are handled by cancel().
  const width=image?.width,height=image?.height;
  need(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=256&&height<=192,'CPU文字範囲は256×192px以内にしてください');
  need((image.data instanceof Uint8Array||image.data instanceof Uint8ClampedArray)&&image.data.length===width*height*4,'CPU文字画像の長さが不正です');
  need(!(typeof SharedArrayBuffer!=='undefined'&&image.data.buffer instanceof SharedArrayBuffer),'共有された画像は利用できません');
  need(Number.isSafeInteger(romEpoch)&&romEpoch>=0&&stamp&&stamp.romEpoch===romEpoch,'現在のROM・撮影識別情報が必要です');
  const budget=options.maxMilliseconds??1500;
  need(Number.isFinite(budget)&&budget>0&&budget<=10000,'CPU一回照合の上限は1〜10000msです');
  validateCpuAkinatorRequest(image,options);
  need(stampKey(stamp).length<=32768,'撮影識別情報の上限を超えています');
  const captureStamp=structuredClone(stamp),snapshot={width,height,data:Uint8ClampedArray.from(image.data)},config=structuredClone(Object.fromEntries(['threshold','charCount','topN','maxEvaluations','maxMilliseconds','scales','shiftX','shiftY','shiftStep','autoThreshold','sequenceMode'].filter(k=>Object.hasOwn(options,k)).map(k=>[k,options[k]]))),glyphs=snapshotCpuGlyphInput(glyphsBySize);
  this.cancel();
  return new Promise((resolve,reject)=>{
   const id=`cpu-frame-${++this.sequence}`,started=this.now(),worker=this.idle?.romEpoch===romEpoch&&this.idle?.glyphsBySize===glyphsBySize?this.idle.worker:this.factory(),initialized=this.idle?.worker===worker;if(this.idle&&this.idle.worker!==worker)this.idle.worker.terminate();this.idle=null;
   const token={id,romEpoch,stamp:captureStamp,worker,timer:null,settled:false,reject};this.active=token;
   const finish=(error,result,reusable=false)=>{if(token.settled)return;token.settled=true;this.clearTimer(token.timer);if(this.reuseWorker&&reusable&&!error)this.idle={worker,romEpoch,glyphsBySize};else worker.terminate();if(this.active===token)this.active=null;error?reject(error):resolve(result);};
   token.finish=finish;
   worker.onmessage=({data:m})=>{
    if(this.active!==token||token.settled||m?.id!==id||m.romEpoch!==romEpoch)return;
    if(this.now()-started>=budget){finish(null,cpuUnknownResult());return;}
    if(m.type==='error'){const error=Error(m.message||'CPU文字照合を完了できませんでした');error.cpuDiagnostic=cpuTextDiagnostic({cpuDiagnostic:m.diagnostic},'client');finish(error);return;}
    if(m.type==='ready'){
     if(token.sent)return;token.sent=true;
     const remaining=budget-(this.now()-started);
     if(remaining<=0){finish(null,cpuUnknownResult());return;}
     try{worker.postMessage({type:'match',id,romEpoch,stamp:captureStamp,image:snapshot,options:{...config,maxMilliseconds:remaining}},[snapshot.data.buffer]);}catch(error){finish(error);}return;
    }
    if(m.type!=='result')return;
    if(stampKey(m.stamp)!==stampKey(captureStamp)){finish(Error('CPU結果の撮影識別情報が一致しないため破棄しました'));return;}
    if(m.result?.route!=='glyph-akinator'){finish(Error('CPU文字照合の応答形式が不正です'));return;}
    // Exhaustive mathematical subpasses do not establish semantic text identity.
    finish(null,{...m.result,backend:'cpu-reference',cpuOneFrame:true,unknownTextPossible:true,unsearchedTextPossible:true,fontIdentityResolved:false,textResolved:false,confidenceCalibrated:false},true);
   };
   worker.onerror=event=>{if(this.active===token)finish(Error(event.message||'CPU Workerを起動できませんでした'));};
   token.timer=this.setTimer(()=>{if(this.active===token)finish(null,cpuUnknownResult());},budget);
   try{if(initialized)worker.onmessage({data:{type:'ready',id,romEpoch}});else worker.postMessage({type:'init',id,romEpoch,glyphsBySize:glyphs});}catch(error){finish(error);}
  });
 }
 cancel(){this.active?.finish(aborted());}
 destroy(){this.cancel();this.idle?.worker.terminate();this.idle=null;}
}
