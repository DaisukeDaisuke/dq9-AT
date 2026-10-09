import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {createNpcReplayInput,replayNpcContinuation,replayNpcFiles} from '../web/npc-at-replay.mjs';
import {ACTOR_ROM_SHA256} from '../web/actor-rom-mining.mjs';
const resources={fullAngle:25736,positiveHalf:12868,negativeHalf:-12868,angleLimits:[6430,12861,19292],vectors:[[4096,0,0],[0,0,4096],[-4096,0,0],[0,0,-4096]],trig:Array.from({length:8192},(_,i)=>i%2?4096:2048),atan:Array.from({length:129},(_,i)=>Math.trunc(3217*i/128))};
const origin={schema:'dq9-npc-origin-v1',epoch:'synthetic-origin',originFrame:10,seed:1,globalMode:0,controllers:[{slot:0,pointer:0x02010000,flags:0,threshold:100,descriptor:0x02010200,attachment:0,fallbackActor:0,placement:{pointer:0x02010300,mode:7,angle:0,maxX:100,maxZ:100,minX:-100,minZ:-100},actor:{pointer:0x02010100,xyz:[0,0,0],flags:0,angle:0,targetAngle:0,turnRate:804,previousXYZ:[0,0,0],targetXYZ:[0,0,0],elapsed:100,stepSpeed:122}}]};
const clocks={schema:'work5-external-clock-v1',originFrame:10,ticks:[{sourceFrame:11,delta:1,scaledDelta:1,phase:0}]};
const mined={schema:'dq9-actor-rom-mining-v1',staticOnly:true,rom:{sha256:ACTOR_ROM_SHA256,gameCode:'YDQJ',revision:0},predictionResources:resources};
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=f=>{assert.throws(f);checks++;};
const input=createNpcReplayInput(origin,clocks,mined),before=structuredClone(input),result=replayNpcContinuation(input);
eq(result.conditionalConsumed,2);eq(result.provedMinimumAT,0);eq(result.sessionUnchanged,true);eq(input,before);
reject(()=>createNpcReplayInput(origin,clocks,{...mined,staticOnly:false}));
reject(()=>createNpcReplayInput(origin,clocks,{...mined,rom:{...mined.rom,sha256:'wrong'}}));
reject(()=>createNpcReplayInput(origin,{...clocks,originFrame:11},mined));
eq(replayNpcContinuation({...input,expectedEpoch:'different'}).resolved,false);
const future=structuredClone(input);future.clocks.ticks[0].seed=5;eq(replayNpcContinuation(future).resolved,false);
const unknown=structuredClone(input);unknown.origin.controllers[0].placement.mode=9;eq(replayNpcContinuation(unknown).resolved,false);
const files={origin:new File([JSON.stringify(origin)],'origin.json'),clocks:new File([JSON.stringify(clocks)],'clocks.json'),romData:new File([JSON.stringify(mined)],'actor-rom-data.json')};
eq((await replayNpcFiles(files)).conditionalConsumed,2);
await assert.rejects(replayNpcFiles({...files,origin:new File(['{'],'broken.json')}));checks++;
// Execute the actual production Worker, adapting only its browser transport/fetch.
const workerURL=new URL('../web/at-worker.mjs?v=symbolic-clock-20261009-e604633f',import.meta.url).href,web=new URL('../web/',import.meta.url).href;
const worker=new Worker(`import {parentPort} from 'node:worker_threads';import {readFile} from 'node:fs/promises';globalThis.self=globalThis;globalThis.postMessage=m=>parentPort.postMessage(m);globalThis.fetch=async p=>new Response(await readFile(new URL(p,${JSON.stringify(web)})));await import(${JSON.stringify(workerURL)});parentPort.on('message',data=>self.onmessage({data}));`,{eval:true,type:'module'});
let id=0;const pending=new Map();worker.on('message',m=>{const p=pending.get(m.id);pending.delete(m.id);m.ok?p.resolve(m.value):p.reject(Error(m.error));});
worker.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear();});
const send=(type,args={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});worker.postMessage({type,id,...args});});
try{
 const initial=await send('start',{seed:'1'});
 // Synthetic numerical replay above remains valid in isolation. The same
 // snapshot/clock packets must now be rejected by the production Worker.
 for(const [type,args] of [['npc-continuation',{input}],['replay',{trace:input}],['npc-continuation',{input:unknown}],['npc-continuation-files',files]]){
  await assert.rejects(send(type,args),/DST・メモリ/);checks++;eq(await send('export'),initial);
 }
 const panel=await readFile(new URL('../web/at-panel.mjs?v=symbolic-clock-20261009-e604633f',import.meta.url),'utf8');
 assert(panel.includes('PRODUCTION_AT_INPUT_NOTICE'));checks++;
 assert(!panel.includes("trace.format==='dq9-npc-replay-v1'"));checks++;
 assert(panel.includes('attachNpcReplayPanel'));checks++;

}finally{await worker.terminate();}
console.log(JSON.stringify({suite:'npc-replay-production-worker',checks,passed:true,scope:'Portable synthetic arithmetic and actual Worker rejection; no native state accepted as production input'}));
