// Source epoch -> admitted call -> pre-offset-update render state. No PTS/FPS
// conversion and no initial retained-phase seed is accepted by this adapter.
import {analyzeObservedMseEpochs} from './mse-reload-epoch.mjs';
import {initializeLoadedMseState,stepNativeMseState} from './native-mse-state.mjs';
import {buildMseStateRenderOptions} from './native-mse-alpha-material.mjs';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const copy=x=>structuredClone(x);
const control=e=>({flags:e.words[2]>>>8&255,remaining:e.words[2]>>>16&255,alpha:e.words[2]>>>24&255,environmentByte:e.words[0]&255});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=['flags','remaining','alpha','environmentByte'];
/** The eight-site epoch observer must additionally read manager+20 (environment)
 * and map-id address in words 0 and 1. These are observations of source results,
 * not an assertion that visible blackouts or menus pause this state machine.
 */
export function buildMseEpochRenderClock({binding,stateRules,profile,capture,manager,mapObject,mapId}){
 need(Number.isSafeInteger(mapId)&&mapId>=0&&mapId<=65535,'Observed map ID required');
 const history=analyzeObservedMseEpochs(binding,{...capture,manager,mapObject});
 need(capture.drains.every(d=>d.wordAddresses[0]===manager+20&&d.wordAddresses[1]===mapObject),'Environment/map observer word layout differs');
 need(Number.isSafeInteger(capture.initialStatus?.frame),'Initial native frame counter required');
 const base=capture.initialStatus.frame,rows=capture.rows,events=capture.events;
 need(Array.isArray(rows)&&rows.length>0&&rows.every((r,i)=>r.frame===i+1),'Consecutive per-frame observations required');
 need(events.every(e=>e.completedFrames>=base&&e.completedFrames<base+rows.length),'Events outside native frame coverage');
 const byStart=new Map(history.calls.map(c=>[c.sequence,c]));
 const byEnd=new Map(history.calls.map(c=>[c.completedAt.sequence,c]));
 const builds=new Map(history.builds.map(b=>[b.completedAt.sequence,b]));
 const resets=new Set(history.resets.map(r=>r.sequence));
 let state=null,epoch=null,active=null,cursor=0,lastCompletedCall=null,verifiedFrameStates=0;
 const calls=[],samples=[],outsideControlChanges=[];
 for(const row of rows){
  const nativeFrame=base+row.frame;
  while(cursor<events.length&&events[cursor].completedFrames<nativeFrame){
   const e=events[cursor++];
   if(resets.has(e.sequence)){state=null;epoch=null;active=null;lastCompletedCall=null;}
   const build=builds.get(e.sequence);
   if(build){
    state=null;lastCompletedCall=null;
    epoch=history.epochs.find(x=>x.origin?.sequence===e.sequence)??null;
    if(build.fresh&&(e.words[1]&65535)===mapId){
     state=initializeLoadedMseState(stateRules,profile);
     Object.assign(state,control(e));
     state.epoch='observed-clear-request-fresh-build';
     // This certifies source phase origin, never framebuffer/video alignment.
     state.currentEpochCertified=true;
    }
   }
   if(e.pc===0x0207ba90){active=byStart.get(e.sequence)??history.inFlightUpdate;need(active?.sequence===e.sequence,'Missing admitted-call history');}
   const call=byEnd.get(e.sequence);
   if(!call)continue;
   const entry=events[call.sequence],before=control(entry),after=control(e);
   let renderState=null,sourceStateReady=false;
   if(state&&epoch?.index===call.epoch){
    need((entry.words[1]&65535)===mapId&&(e.words[1]&65535)===mapId,'Map changed during observed MSE call');
    const changes=fields.filter(k=>state[k]!==before[k]);
    if(changes.length)outsideControlChanges.push({sequence:call.sequence,fields:changes});
    Object.assign(state,before);
    if(call.reason==='admitted'){
     need(epoch.exactSinceBuild,'Retained source phase cannot become known from a call');
     need(state.completedDraws===String(call.completedUpdateOrdinal-1),'Missing complete update in fresh epoch');
     // The native updater has stored its current gate at the epilogue. Reading
     // that source result handles a gate transition without a guessed constant.
     const stepped=stepNativeMseState(stateRules,state,{drawDispatchReached:true,surfaceGate:!!(after.environmentByte&4)});
     need(stepped.drawn,'Source admission differs');
     need(fields.every(k=>stepped.stateAfter[k]===after[k]),'Source control/environment transition differs');
     state=stepped.stateAfter;renderState=stepped.renderState;
    }else need(fields.every(k=>before[k]===after[k]),'Denied call changed source control');
    sourceStateReady=true;
   }
   const result={...call,mapId:entry.words[1]&65535,sourceStateReady,renderState:renderState?copy(renderState):null,stateAfter:sourceStateReady?copy(state):null,videoSynchronized:false,nativeFramebufferParity:false};
   calls.push(result);lastCompletedCall=result;active=null;
  }
  let frameState=null;
  if(state&&row.mapId===mapId&&row.layers.length&&!active){
   need(row.layers.length===state.layers.length,'Observed layer count differs from ROM profile');
   for(let i=0;i<state.layers.length;i++)need(row.layers[i].S===state.layers[i].offsetSFx&&row.layers[i].T===state.layers[i].offsetTFx,'Observed/source offsets differ at frame '+row.frame);
   // Ordinary external pause/control stores may happen after the last call.
   // At this boundary those bytes are directly observed, not interpolated.
   frameState=copy(state);Object.assign(frameState,{flags:row.control.flags,remaining:row.control.remaining,alpha:row.control.alpha,environmentByte:row.control.dayGate});verifiedFrameStates++;
  }
  samples.push({nativeFrame,relativeNativeFrame:row.frame,mapId:row.mapId,epochIndex:epoch?.index??null,exactSinceBuild:!!epoch?.exactSinceBuild,inFlight:!!active,sourceStateReady:!!frameState,stateAfter:frameState,lastCompletedCallSequence:lastCompletedCall?.completedAt.sequence??null,screenBlack:row.darkFraction>.97,currentPhaseCertified:false,videoSynchronized:false,nativeFramebufferParity:false});
 }
 need(cursor===events.length,'Unconsumed native events');
 return{kind:'observed-mse-epoch-render-clock-v1',history,calls,samples,verifiedFrameStates,outsideControlChanges,sourceNativeFrameBase:base,currentPhaseCertified:false,videoSynchronized:false,nativeFramebufferParity:false,minimumProvenATCalls:0};
}
export function sampleMseEpochNativeFrame(clock,nativeFrame){
 need(clock?.kind==='observed-mse-epoch-render-clock-v1','Epoch render clock required');need(Number.isSafeInteger(nativeFrame),'Exact native frame required');
 const sample=clock.samples[nativeFrame-clock.sourceNativeFrameBase-1];need(sample?.nativeFrame===nativeFrame,'Native frame outside observed recording');return sample;
}
/** Renderer input refers to one completed source invocation, not to whichever
 * framebuffer happens to be displayed when an observer row is captured. */
export function mseEpochCallRenderOptions(clock,completionSequence,options){
 need(clock?.kind==='observed-mse-epoch-render-clock-v1','Epoch render clock required');
 const call=clock.calls.find(c=>c.completedAt.sequence===completionSequence);need(call,'Observed completion sequence required');
 if(!call.sourceStateReady)return{ready:false,reason:'Source phase before the retained/unknown epoch is unobserved',call};
 if(call.reason!=='admitted')return{ready:false,reason:'This native invocation did not emit an MSE update',call};
 need(call.renderState,'Missing admitted-call render state');
 return{ready:true,renderOptions:buildMseStateRenderOptions(call.renderState,options),call,currentPhaseCertified:false,nativeFramebufferParity:false,videoSynchronized:false};
}
