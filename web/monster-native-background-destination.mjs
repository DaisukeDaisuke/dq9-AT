import{prepareBoundMode1NativeScene}from'./monster-native-mode1-source.mjs?v=shrine-beam-20261008-a9738d0c';
import{renderInitialIntegerFogSteps}from'./map-browser-preview/integer-static-fog.mjs?v=native-lineage-at-20261008-556f7ca6';
import{captureMode1MseSceneHypothesis}from'./map-browser-preview/mode1-mse-scene-hypothesis.mjs?v=native-scene-link-20261007-0354';
import {adoptNativeBodyDestinationHandoff} from './map-browser-preview/native-body-destination-handoff.mjs?v=native-lineage-at-20261008-556f7ca6';
// Frame-local lazy source destination reconstruction. No final-RGB inversion,
// transport parameters, camera search, state search or persistent pixel cache.
import {loadAutomaticScene} from './map-browser-preview/automatic-scene.mjs';
import {prepareMode2InverseModel,renderMode2InverseSourceSteps} from './map-browser-preview/mode2-inverse-render.mjs?v=native-lineage-at-20261008-556f7ca6';
import {bindNativeBodyDestination} from './monster-native-scene-composition.mjs?v=native-lineage-at-20261008-556f7ca6';
const need=(v,m)=>{if(!v)throw Error(m);};
const task=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
/** Advance only this provider's frozen source image. A budget yield is pending,
 * never an unsupported destination. Bounds are checked between source steps;
 * load/model/bind and an individual generator.next() remain indivisible and
 * are timed through onSegment. Their wall time is not a hard slice bound. */
export function createNativeBodyDestinationProvider({project,rom,record,branch,frame,assertCurrent=()=>{}}){
 let reuseEnvelope=branch.nativeBodyDestinationReuse?structuredClone(branch.nativeBodyDestinationReuse):null;
 frame=structuredClone(frame);branch={branchId:branch.branchId,recordKey:branch.recordKey,viewFx:branch.viewFx.slice(),projectionFx:branch.projectionFx.slice(),alignment:{...branch.alignment},sourceEnvironment:structuredClone(branch.sourceEnvironment),backgroundRGBA:branch.backgroundRGBA.slice(),validMask:branch.validMask.slice()};
 const camera={viewFx:branch.viewFx,projectionFx:branch.projectionFx};
 const mode1SceneRequested=branch.sourceEnvironment?.mode1Scene!=null;let state=null,advancing=false,disposed=false;
 const clear=()=>{try{state?.steps?.return?.();}finally{state=null;}};
 const advance=async({assertCurrent:check=assertCurrent,shouldYield=()=>false,yieldTask=task,sliceMilliseconds=8,now=()=>performance.now(),onSegment=null}={})=>{
  const currentCheck=check;check=()=>{if(disposed)throw new DOMException('Source destination provider disposed','AbortError');currentCheck();};
  need(!advancing,'Source destination preparation already advancing');
  need(typeof shouldYield==='function'&&typeof yieldTask==='function'&&typeof now==='function','Source destination budget, task and clock callbacks required');
  need(Number.isFinite(sliceMilliseconds)&&sliceMilliseconds>0,'Positive finite source destination cooperative slice required');
  advancing=true;
  try{
   check();
   if(!state)state={phase:'validate',automatic:null,model:null,steps:null,image:null,destination:null,error:null,completedSteps:0,maxSegmentMs:0};
   if(state.error)throw state.error;
   let sliceStarted=now();
   for(;;){
    check();
    if(state.phase==='complete'){check();return state.destination;}
    if(shouldYield()){
     // A task boundary lets cancellation/supersession become observable even
     // when the caller resumes repeatedly with no available preparation budget.
     await yieldTask();check();
     return{kind:'native-body-destination-pending',ready:false,phase:state.phase,completedSteps:state.completedSteps,maxSegmentMs:state.maxSegmentMs};
    }
    const phase=state.phase,started=now();let boundary=null;
    if(phase==='validate'){
     need(mode1SceneRequested||branch.sourceEnvironment?.mode2Inputs&&branch.sourceEnvironment.fogApplied===true,'Source scene destination currently admits explicit frozen mode2 only; retained mode1/MSE alternatives remain unknown');
     need(frame.recordKey===record.key&&branch.recordKey===record.key,'Source scene destination record differs');
     state.phase=reuseEnvelope?'adopt-background-handoff':mode1SceneRequested?'prepare-mode1-source':'load-automatic-scene';
    }else if(phase==='prepare-mode1-source'){
     state.mode1=prepareBoundMode1NativeScene({project,rom,record,branch,frame});state.steps=renderInitialIntegerFogSteps(project,rom,record,state.mode1.active,state.mode1.camera,{applyFog:true,screenEffectPhase:state.mode1.phase,retainBodyDestination:true});state.phase='render-source';
    }else if(phase==='adopt-background-handoff'){
     const adopted=await adoptNativeBodyDestinationHandoff({envelope:reuseEnvelope,project,rom,record,branch,frame,assertCurrent:check});check();reuseEnvelope=null;
     if(adopted.ready){state.destination=adopted.destination;state.phase='complete';boundary='validated-background-source-reuse';}
     else{state.phase=mode1SceneRequested?'prepare-mode1-source':'load-automatic-scene';boundary='unverified-handoff-source-reconstruction-fallback';}
    }else if(phase==='load-automatic-scene'){
     state.automatic=loadAutomaticScene(project,record);state.phase='prepare-mode2-model';
    }else if(phase==='prepare-mode2-model'){
     state.model=prepareMode2InverseModel(project,record);
     state.steps=renderMode2InverseSourceSteps({project,rom,record,automatic:state.automatic,camera,model:state.model,inputs:branch.sourceEnvironment.mode2Inputs,retainBodyDestination:true});
     state.phase='render-source';
    }else if(phase==='render-source'){
     const next=state.steps.next();boundary=next.done?null:next.value;
     if(next.done){state.image=next.value;state.steps=null;state.phase='bind-destination';}
    }else if(phase==='bind-destination'){
     const image=state.image;need(image.ready&&image.bodyDestination,'Source scene destination reconstruction unavailable: '+(image.reason??image.diagnostics?.bodyDestinationRetention?.reason??'source planes absent'));if(mode1SceneRequested)need(JSON.stringify(captureMode1MseSceneHypothesis(image.diagnostics))===JSON.stringify(branch.sourceEnvironment.mode1Scene),'Reconstructed mode1 MSE hypothesis differs');
     state.destination=bindNativeBodyDestination(image.bodyDestination,{frame,camera,alignment:branch.alignment,reconstructedRGBA:image.rgba,backgroundRGBA:branch.backgroundRGBA,validMask:branch.validMask});
     state.automatic=null;state.model=null;state.image=null;state.mode1=null;state.phase='complete';
    }else throw Error('Unknown source destination preparation phase');
    const elapsedMs=now()-started;state.completedSteps++;state.maxSegmentMs=Math.max(state.maxSegmentMs,elapsedMs);
    onSegment?.({phase,boundary,elapsedMs,completedSteps:state.completedSteps,maxSegmentMs:state.maxSegmentMs,done:state.phase==='complete'});
    check();
    // Always let queued cancellation run after a long indivisible operation,
    // including the final bind, before delivering a destination or pending.
    if(now()-sliceStarted>=sliceMilliseconds){await yieldTask();check();sliceStarted=now();}
   }
  }catch(error){
   if(error.name==='AbortError'){reuseEnvelope=null;clear();}
   else if(state){state.steps?.return?.();state.steps=null;state.error=error;}
   throw error;
  }finally{advancing=false;}
 };
 advance.mode1SceneRequested=mode1SceneRequested;
 advance.dispose=()=>{disposed=true;reuseEnvelope=null;clear();};
 return advance;
}
