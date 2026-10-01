import assert from 'node:assert/strict';
import {stepPickupUpdater,floatBits,floatFromBits} from '../web/pickup-updater.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const input={reached:true,networkBlocked:false,scaledDelta:33,motionCannotMutateATInputs:true},state=(word=0x80000001,cursor=1,acc=0)=>({cursor,accumulatorBits:floatBits(acc),words:{[cursor]:word>>>0}});
const run=(s,i=input)=>{const saved=structuredClone(s),r=stepPickupUpdater(s,i);eq(s,saved);return r;};
for(const cursor of [97,98,99])for(let mask=0;mask<256;mask++)for(const capacity of [0,1,3,8,15])for(const countdown of [1,511]){
 const word=(0xa0000000|(mask<<17)|(capacity<<9)|countdown)>>>0,r=run(state(word,cursor));const pop=mask.toString(2).replaceAll('0','').length;
 eq(r.resolved,true);eq(r.consumed,0);eq(r.state.words[cursor],(pop!==capacity||cursor>=98)?((word&0xfffffe00)|countdown-1)>>>0:word);eq(r.state.cursor,(cursor+1)%100);
}
for(const cursor of [0,1,99]){const s=state(0,cursor,60),r=run(s,{...input,scaledDelta:0});eq(r.state.accumulatorBits,0);eq(r.state.cursor,(cursor+1)%100);eq(r.reason,'inactive or gated group');}
{const r=run({cursor:0,accumulatorBits:0,words:{}});eq(r.resolved,true);eq(r.reason,'minute not due');eq(r.state.accumulatorBits,floatBits(Math.fround(.033)));}
{const r=run(state(0xa0000000));eq(r.resolved,false);eq(r.group,1);eq(r.state.cursor,1);eq(r.state.accumulatorBits,floatBits(Math.fround(.033)));}
for(const type of [2,3])for(const active of [0,1])for(const flag of [false,true]){const word=((type<<29)|(active<<31)|1)>>>0,r=run(state(word),{...input,eventFlags:{[type===2?1944:1942]:flag}});eq(r.resolved,true);eq(r.reason,active&&flag?'positive countdown group':'inactive or gated group');}
for(const type of [2,3]){const r=run(state(((type<<29)|0x80000001)>>>0));eq(r.resolved,false);eq(r.state.cursor,1);}
for(const cursor of [-1,100,1.5,null])eq(run({...state(),cursor}).resolved,false);
for(const bits of [floatBits(-1),floatBits(Infinity),floatBits(NaN),floatBits(61),-1,2**32])eq(run({...state(),accumulatorBits:bits}).resolved,false);
for(const delta of [-1,51,1.5,undefined,NaN])eq(run(state(),{...input,scaledDelta:delta}).resolved,false);
for(const key of ['reached','motionCannotMutateATInputs'])eq(run(state(),{...input,[key]:false}).resolved,false);
{const s=state(),r=run(s,{...input,networkBlocked:true,scaledDelta:undefined});eq(r.state,s);eq(r.resolved,true);}
{const r=run(state(),{...input,networkBlocked:undefined});eq(r.resolved,false);eq(r.state.accumulatorBits,0);}
{const s={cursor:2,accumulatorBits:0,words:{1:0}},r=run(s);eq(r.resolved,false);eq(r.state.cursor,2);eq(r.state.accumulatorBits,floatBits(Math.fround(.033)));}
// Reachable group words are read in source cursor order and known prefix survives.
{let s={cursor:0,accumulatorBits:floatBits(60),words:{0:0,1:0xa0000202}};for(let n=0;n<2;n++){const r=run(s);eq(r.resolved,true);s=r.state;}const r=run(s);eq(r.resolved,false);eq(r.state.words[1],0xa0000201);eq(r.state.cursor,2);}
let s={cursor:0,accumulatorBits:floatBits(60),words:Object.fromEntries(Array.from({length:100},(_,i)=>[i,[3,91].includes(i)?0xa0000202:0]))};const original=structuredClone(s);for(let n=0;n<100;n++){const r=run(s);eq(r.resolved,true);eq(r.group,n);s=r.state;}eq(s.cursor,0);eq(Object.keys(s.words).filter(k=>s.words[k]!==original.words[k]).length,2);
console.log(JSON.stringify({passed:true,checks,scope:'Bounded recurring pickup AT/countdown slice; refill branches remain unresolved before their draws'},null,2));
