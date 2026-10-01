import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ATKernel} from '../web/at-core.mjs';
import {projectPickupMaterialization as project,decodePickupRows,projectNpcModeZeroGate} from '../web/pickup-materialization.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url));
const {instance}=await WebAssembly.instantiate(read('../web/wasm/map_render.wasm'),{});
const kernel=new ATKernel(instance), packet={records:[{groupId:15},{groupId:16},{groupId:17}],runtimeWords:{15:(0x80000000|(5<<9)|(31<<17))>>>0,16:(0x80000000|(3<<9)|(7<<17))>>>0,17:(0x80000000|(3<<9)|(7<<17))>>>0},phaseRange:{lower:4096,upper:49152},conditions:Object.fromEntries(['recordLoopReached','completeSourceOrderedRows','runtimeWordsStableUntilRead','sourceRowsBoundToLoadedList','phaseRangeBoundToLoadedDescriptor','noInterveningATConsumers','noSeedSetter','allRequiredAllocationsSucceed'].map(k=>[k,true]))};
let checks=0;const check=(p,m)=>{assert.ok(p,m);checks++;};
const clone=()=>structuredClone(packet), run=(p,seed=2820672266)=>project(p,seed,kernel);
let r=run(clone());check(r.resolved&&r.consumed===11&&r.seed===383961641,'synthetic enabled-slot sequence');
check(JSON.stringify(r.events.map(e=>e.nativeItemIndex))===JSON.stringify([0,1,2,3,4,8,9,10,16,17,18]),'source enumeration order');
for(const seed of [0,1,0x7fffffff,0x80000000,0xffffffff,2820672266,...Array.from({length:128},(_,i)=>(Math.imul(i+1,0x9e3779b9))>>>0)]){
 const actual=run(clone(),seed);let next=BigInt(seed);
 for(const event of actual.events){next=(next*1103515245n+12345n)&0xffffffffn;const random=Number((next>>16n)&32767n);check(event.after===Number(next)&&event.random===random&&event.phase===4096+random%(49152-4096),'independent BigInt LCG and phase');}
}
for(const condition of Object.keys(packet.conditions).filter(x=>x!=='allRequiredAllocationsSucceed')){
 const p=clone();delete p.conditions[condition];r=run(p);check(!r.resolved&&r.consumed===0,'missing condition '+condition);
}
for(const invalid of [undefined,0,-1,NaN,1.5]){const p=clone();p.phaseRange={lower:0,upper:invalid};r=run(p);check(!r.resolved&&r.consumed===0,'invalid phase range');}
for(let failure=0;failure<11;failure++){
 const p=clone();delete p.conditions.allRequiredAllocationsSucceed;p.allocationResults=Array(failure).fill(true).concat(false);r=run(p);
 check(r.resolved&&r.returnedEarly&&r.consumed===failure,'source allocation failure prefix '+failure);
}
for(let missing=0;missing<11;missing++){
 const p=clone();delete p.conditions.allRequiredAllocationsSucceed;p.allocationResults=Array(missing).fill(true);r=run(p);
 check(!r.resolved&&r.consumed===missing,'unknown allocation prefix '+missing);
}
{const p=clone();delete p.runtimeWords[16];r=run(p);check(!r.resolved&&r.consumed===5,'late missing word preserves five draws');}
{const p=clone();p.runtimeWords[15]&=0x7fffffff;r=run(p);check(r.resolved&&r.consumed===6&&r.events[0].nativeItemIndex===8,'inactive row skipped but ordinal remains');}
{const p=clone();p.runtimeWords[15]=(0x80000000|(5<<9)|(0x12<<17))>>>0;r=run(p);check(r.resolved&&r.consumed===8&&r.events[0].slot===1&&r.events[1].slot===4,'sparse bitmap order');}
{const p=clone();p.runtimeWords[15]=(0x80000000|(1<<9)|(0xff<<17))>>>0;r=run(p);check(r.resolved&&r.consumed===7,'bits beyond dynamic count ignored');}
{const p=clone();p.records=[{groupId:98}];p.runtimeWords={98:(0x80000000|(1<<9)|(0x81<<17))>>>0};r=run(p);check(r.resolved&&r.consumed===2&&r.events[1].slot===7,'group98 forces eight slots');}
{const p=clone();p.records=[{groupId:97}];p.runtimeWords={97:(0x80000000|(1<<9)|(0x81<<17))>>>0};r=run(p);check(r.resolved&&r.consumed===1,'group97 uses dynamic count');}
{const p=clone();p.records=[];p.phaseRange=undefined;r=run(p);check(r.resolved&&r.consumed===0,'empty reached list is zero without range');}
{const p=clone();p.records=Array(1);r=run(p);check(!r.resolved&&r.consumed===0,'sparse row array rejected');}
{const p=clone();p.records[1]=null;r=run(p);check(!r.resolved&&r.consumed===5,'null later row stops after prefix');}
{const p=clone(),frozen=JSON.stringify(p);run(p);check(JSON.stringify(p)===frozen,'input is not mutated');}
{const p=clone();p.phaseRange={lower:123,upper:124};r=run(p);check(r.events.every(e=>e.phase===123)&&r.consumed===11,'span1 still draws once per enabled slot');}
{const p=clone();p.phaseRange={lower:100,upper:107};r=run(p);check(r.events.every(e=>e.phase>=100&&e.phase<107),'exclusive upper bound and actual modulo');}
for(const input of [{},{descriptorGateReached:true},{descriptorGateReached:true,descriptorPresent:true,mode:null},{descriptorGateReached:true,descriptorPresent:true,mode:8}])check(!projectNpcModeZeroGate(input).resolved,'unknown/nonzero NPC mode remains unresolved');
for(const input of [{descriptorGateReached:true,descriptorPresent:true,mode:0},{descriptorGateReached:true,descriptorPresent:false}])check(projectNpcModeZeroGate(input).skipsTimer,'zero/null descriptor skips timer');
const c={index:0,opcode:102,argumentCount:32,args:Array.from({length:32},()=>({type:1,raw:0}))};c.args[0].raw=143;c.args[1].raw=0x10001;c.args[8].raw=0xfffffff0;
const decoded=decodePickupRows([c]);check(decoded[0].groupId===15&&decoded[0].itemId===1&&decoded[0].sourceXYZ[0][0]===-65536,'record parser native masks and signed fixed-point');
for(const mutation of [x=>x.opcode=103,x=>x.args[0].type=2,x=>x.argumentCount=31]){const bad=structuredClone(c);mutation(bad);let failed=false;try{decodePickupRows([bad])}catch{failed=true}check(failed,'unknown parser input rejected');}

{const p=clone();for(const id of Object.keys(p.runtimeWords))p.runtimeWords[id]=(0x80000000|(5<<9))>>>0;p.phaseRange=undefined;r=run(p);check(r.resolved&&r.consumed===0&&r.allocations.length===0,'active rows with zero enabled masks need no allocation or range');}
{const p=clone();p.records[0].sourcePointCount=0;r=run(p);check(r.resolved&&r.consumed===11,'ROM coordinate count cannot override native runtime count');}
for(const bad of [{opcode:100,argumentCount:1,args:[{type:1,raw:0}]},{opcode:101,argumentCount:2,args:[{type:0,raw:0}]},{opcode:100,argumentCount:1,args:[]}]){let failed=false;try{decodePickupRows([bad])}catch{failed=true}check(failed,'malformed metadata rejected');}
{let failed=false;try{decodePickupRows(Array(1))}catch{failed=true}check(failed,'sparse script rejected');}
{const p=clone();delete p.conditions.allRequiredAllocationsSucceed;p.allocationResults=[false];r=run(p);check(r.resolved&&r.returnedEarly&&r.consumed===0&&r.worldResolved===false,'early failure resolution is only this function slice');}

{const failKernel={generate:kernel.generate.bind(kernel),e:{world_pickup_phase(){throw Error('injected phase projection error')}}};r=project(clone(),2820672266,failKernel);check(!r.resolved&&r.consumed===1&&r.seed===1824386939&&r.events[0].phase===null,'post-draw projection failure preserves the consumed prefix');}
console.log(JSON.stringify({passed:true,checks,scope:'Pure source slice, source ordering and fail-closed input tests; native comparison is separate'}));
