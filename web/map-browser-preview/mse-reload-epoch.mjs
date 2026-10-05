/** Count actual completed MSE updates by observed native load epochs.
 * No elapsed-seconds estimate, visual-blackout inference, or video phase input.
 * A retained layer pointer (including one reused after allocation) is not an epoch.
 */
const SOURCE = 'verified-rom-observed-mse-epochs-v1';
const SDK = [
 [0x02013604,0xe92d43f8], [0x02013658,0xebffffae],
 [0x0201359c,0xe2840f45], [0x020135a0,0xeb019f92],
 [0x02013700,0xe2840f45], [0x02013708,0xeb019f38],
 [0x020146b4,0xeb019b64], [0x02014784,0xeb019b78],
 [0x0207ae98,0xe92d4010], [0x0207aea4,0xe3a01000],
 [0x0207aeb4,0xe58410d0], [0x0207aeb8,0xe58410d4],
 [0x0207b3f0,0xe3a02000], [0x0207b3f4,0xe5802000],
 [0x0207b410,0xe5c02011], [0x0207b448,0xe12fff1e],
 [0x0207b488,0xe3a00001], [0x0207b48c,0xe5c40010],
 [0x0207b4d0,0xe28dd050], [0x0207b56c,0xe92d4ff0],
 [0x0207b578,0xe1a08000], [0x0207b588,0xe3500000],
 [0x0207b58c,0x0a000135], [0x0207b670,0xebfffe08],
 [0x0207b674,0xe5980000], [0x0207b67c,0x05889000],
 [0x0207b68c,0x15849100], [0x0207ba68,0xe28ddf7d],
 [0x0207ba90,0xe92d4ff8], [0x0207ba9c,0xe5941000],
 [0x0207baa8,0x0a0000be], [0x0207baac,0xe5d41011],
 [0x0207bab0,0xe3110001], [0x0207bab8,0x1a0000ba],
 [0x0207bda8,0xe28dd048],
];
const OVERLAY = [
 [0x0219dd44,0xe92d4ff0], [0x0219e49c,0xebf9d458],
 [0x0219f390,0xebfffa6b], [0x021b83d4,0xe3110b01],
 [0x021b83d8,0x0a00000d], [0x021b83f0,0xebf96c83],
];
const OBSERVED = new Map([...SDK,...OVERLAY].filter(([a])=>[
 0x0207ba90,0x0207bda8,0x0207b448,0x0207b4d0,
 0x0207b56c,0x0207ba68,0x02013604,0x0219dd44,
].includes(a)));
function need(ok,message){if(!ok)throw new Error(message);}
function uint(n,label){need(Number.isInteger(n)&&n>=0&&n<=0xffffffff,`Invalid ${label}`);return n;}
export function bindMseReloadEpochSource({sdk,overlay17}){
 for(const[reader,sites]of[[sdk,SDK],[overlay17,OVERLAY]])for(const[a,w]of sites){
  const b=reader.read(a,4);need(b.byteLength===4&&new DataView(b.buffer,b.byteOffset,4).getUint32(0,true)===w,`MSE epoch source mismatch at 0x${a.toString(16)}`);
 }
 return Object.freeze({source:SOURCE,instructionCount:SDK.length+OVERLAY.length,mseOffset:0x114,sites:Object.freeze([...OBSERVED.keys()])});
}
/** events/drains are the complete sequence from the read-only eight-site observer.
 * The last two observer words must be manager+16 and manager (control/head).
 * Events use pre-instruction observations. Constructor/request/build endpoints
 * precede only stack restoration or BX and follow their semantic stores.
 */
export function analyzeObservedMseEpochs(binding,{events,drains,manager,mapObject}){
 need(binding?.source===SOURCE,'Verified ROM binding required');uint(manager,'manager');uint(mapObject,'mapObject');need(mapObject+binding.mseOffset===manager,'Map object and MSE manager disagree');
 need(Array.isArray(events)&&Array.isArray(drains)&&drains.length,'Complete observer events and drains required');
 let matched=0,serial=null;
 for(const d of drains){
  need(d.enabled===true&&d.dropped===0&&d.remaining===0&&d.phase==='pre-instruction'&&d.memoryView==='physical-main-ram-little-endian','Incomplete native observer drain');
  need(d.wordAddresses?.[2]===manager+16&&d.wordAddresses?.[3]===manager,'Wrong MSE observer word layout');
  need(d.sites?.length===OBSERVED.size&&new Set(d.sites.map(s=>`${s.cpu}:${s.address}`)).size===OBSERVED.size&&d.sites.every(s=>s.cpu===9&&OBSERVED.has(s.address)),'Wrong native observation sites');
  need(Number.isInteger(d.matched)&&d.matched>=matched,'Non-monotonic observer count');matched=d.matched;
  need(Number.isInteger(d.stateLoadSerial)&&d.stateLoadSerial>=0,'Missing state-load serial');
  if(serial===null)serial=d.stateLoadSerial;need(d.stateLoadSerial===serial,'State load changed within event history');
 }
 need(matched===events.length,'Incomplete event collection');
 const point=e=>({sequence:e.sequence,frameBucket:e.completedFrames});
 const epochs=[{index:0,kind:'retained-unknown',origin:null,completeUpdates:0,exactSinceBuild:false,closedAt:null}],calls=[],resets=[],requests=[],builds=[],mapReloads=[],fieldLifecycleEntries=[],boundaryReturns=[];
 let epoch=epochs[0],lastReset=null,request=null,build=null,flight=null,lastFrame=-1;
 for(let i=0;i<events.length;i++){
  const e=events[i];need(e.sequence===i,'Missing or out-of-order native event');
  need(e.cpu===9&&!(e.cpsr&32)&&OBSERVED.get(e.pc)===e.instruction,'Native event source mismatch');
  need(Number.isInteger(e.completedFrames)&&e.completedFrames>=lastFrame,'Non-monotonic native frame buckets');lastFrame=e.completedFrames;
  need(Array.isArray(e.regs)&&e.regs.length===16&&e.regs.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff)&&Array.isArray(e.words)&&e.words.length===4&&e.words.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff),'Invalid native event layout');
  const head=e.words[3]>>>0,control=e.words[2]>>>0,flags=control>>>8&255;
  if(e.pc===0x0219dd44){fieldLifecycleEntries.push({...point(e),caller:e.regs[14],fieldManager:e.regs[0]});continue;}
  if(e.pc===0x02013604){if(e.regs[0]===mapObject)mapReloads.push({...point(e),mapId:e.regs[1],caller:e.regs[14],origin:e.regs[14]===0x0219e4a0?'field-lifecycle':e.regs[14]===0x021b83f4?'state10-conditional':'other'});continue;}
  if(e.pc===0x0207b448){
   if(e.regs[0]!==manager)continue;
   need(!flight&&!build,'MSE reset interrupts an observed call');need(head===0&&flags===0,'Constructor endpoint did not clear head/pause');
   lastReset={...point(e),caller:e.regs[14]};resets.push(lastReset);request=null;
   if(epoch&&!epoch.closedAt)epoch.closedAt=point(e);epoch=null;continue;
  }
  if(e.pc===0x0207b4d0){
   if(e.regs[4]!==manager)continue;
   need((control&255)===1,'Load request endpoint is not pending');
   request={...point(e),headAtRequest:head,resetSequence:lastReset?.sequence??null};requests.push(request);continue;
  }
  if(e.pc===0x0207b56c){
   need(!build,'Overlapping MSE builds');build={...point(e),manager:e.regs[0],headAtStart:head,request:e.regs[0]===manager?request:null};continue;
  }
  if(e.pc===0x0207ba68){
   need(build&&build.manager===e.regs[8],'Unpaired MSE build completion');
   if(build.manager===manager){
    const fresh=!!(lastReset&&build.request&&build.request.sequence>lastReset.sequence&&build.headAtStart===0&&build.request.headAtRequest===0&&head!==0);
    const completed={...build,completedAt:point(e),headAfter:head,fresh};builds.push(completed);
    if(head){
     need(!flight,'MSE build completion interrupts an update');
     if(epoch&&!epoch.closedAt)epoch.closedAt=point(e);
     epoch={index:epochs.length,kind:fresh?'observed-fresh-build':'build-history-unknown',origin:point(e),headAtBuild:head,completeUpdates:0,exactSinceBuild:fresh,closedAt:null};epochs.push(epoch);
    }
    request=null;
   }
   build=null;continue;
  }
  if(e.pc===0x0207ba90){
   need(!flight,'Overlapping MSE updates');need(e.regs[0]===manager,'Unexpected MSE update manager');
   if(head&&!epoch){epoch={index:epochs.length,kind:'layer-history-unknown',origin:point(e),completeUpdates:0,exactSinceBuild:false,closedAt:null};epochs.push(epoch);}
   flight={...point(e),epoch:epoch?.index??null,head,flags,reason:!head?'no-layer':flags&1?'paused':'admitted'};continue;
  }
  if(e.pc===0x0207bda8){
   if(!flight){need(i===0,'Unpaired MSE update completion');boundaryReturns.push({...point(e),returnValue:e.regs[0]});continue;}
   need(e.regs[0]===(flight.reason==='admitted'?1:0),'MSE return disagrees with source admission');
   const call={...flight,completedAt:point(e),returnValue:e.regs[0],completedUpdateOrdinal:null};
   if(e.regs[0]){need(epoch&&epoch.index===flight.epoch,'Epoch changed during admitted update');epoch.completeUpdates++;call.completedUpdateOrdinal=epoch.completeUpdates;call.exactSinceBuild=epoch.exactSinceBuild;}
   calls.push(call);flight=null;
  }
 }
 return{source:SOURCE,epochs,calls,resets,requests,builds,mapReloads,fieldLifecycleEntries,boundaryReturns,inFlightUpdate:flight,inFlightBuild:build,pendingLoadRequest:request,currentPhaseCertified:false,counts:Object.fromEntries(['admitted','paused','no-layer'].map(r=>[r,calls.filter(c=>c.reason===r).length])),videoSynchronized:false,minimumProvenATCalls:0};
}
