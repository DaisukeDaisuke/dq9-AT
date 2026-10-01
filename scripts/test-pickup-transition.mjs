import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateMapTransitionInputs,deriveEmptyF06NpcList,advanceMapTransition} from '../web/map-transition.mjs';
import {ATKernel} from '../web/at-core.mjs';
import {FieldATKernel} from '../web/field-at.mjs';
import {MapProject} from '../web/map-core.mjs';
import {MonsterMovementKernel} from '../web/monster-movement.mjs';
import {preferredNodeTrigFromRom} from '../web/field-preferred-node.mjs';
import {createFirstSpawnReplay} from '../web/first-spawn-replay.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=f=>{assert.throws(f);checks++;},copy=structuredClone;
const context={primitive:{story:[4,3,3],networkWord:2,quest185:0,eventFlags:{89:false,90:false}},conditions:Object.fromEntries(['ordinarySingleParty','stablePlacementConditions','successfulDestinationLoads','successfulNpcAllocations','noAdditionalFieldSpecies','noInterveningOtherAT','noSeedSetter','stablePickupWords','pickupDescriptorBound','successfulPickupAllocations'].map(k=>[k,true])),pickup:{stateWords:{15:0x80020400},phaseRange:{lower:10,upper:30}}};
const kinds=['exit-request','field-cleanup','map-changed','destination-placement','pool-initialization','destination-load'];
const phases=Array.from({length:18},(_,i)=>({phase:i===17?'pickup-materialization':kinds[i%6],sourceFrame:10+i,...(i%6===0?{heroXYZ:[0,0,0]}:{}),...(i%6===4?{allocationPointer:0x022f0e58}:{})}));
eq(validateMapTransitionInputs(context,phases,9),{context,phases});
for(const key of ['stablePickupWords','pickupDescriptorBound','successfulPickupAllocations']){const c=copy(context);delete c.conditions[key];reject(()=>validateMapTransitionInputs(c,phases,9));}
for(const mutate of [c=>delete c.pickup,c=>c.pickup.seed=123,c=>c.pickup.phaseRange.upper=10,c=>c.pickup.stateWords=[],c=>c.pickup.phaseRange.futurePhase=1]){const c=copy(context);mutate(c);reject(()=>validateMapTransitionInputs(c,phases,9));}
for(const mutate of [p=>p[17].seed=1,p=>p[17].phase='destination-load',p=>p[17].count=11,p=>p.push(copy(p[17])),p=>p[12].heroXYZ=null]){const p=copy(phases);mutate(p);reject(()=>validateMapTransitionInputs(context,p,9));}
const arg=raw=>({type:1,raw}),call=(opcode,args)=>({opcode,argumentCount:args.length,args:args.map(arg)});
const empty=[{name:'Fplace.bin',calls:[call(3,[20007,1]),call(17,[0x10001,0,2,20007,1,0,0,0,0]),call(17,[0x20001,0,0x20002,1,2,20025,1,0,0,0,0])]},{name:'Fnpc.bin',calls:[{opcode:3,argumentCount:5,args:[arg(1),arg(1),{type:0,raw:0xffffffff},{type:0,raw:0xffffffff},arg(0)]}]}];
eq(deriveEmptyF06NpcList(empty),[]);
for(const [index,argIndex] of [[0,0],[1,3],[2,5]]){const m=copy(empty);m[0].calls[index].args[argIndex].raw=20006;reject(()=>deriveEmptyF06NpcList(m));}
for(const mutate of [m=>m.push(copy(m[0])),m=>m[0].calls[0].opcode=99,m=>m[0].calls[0].args[0].type=3,m=>m[0].calls[1].args.pop(),m=>m[1].calls[0].opcode=4]){const m=copy(empty);mutate(m);reject(()=>deriveEmptyF06NpcList(m));}
let optional=null;
if(process.argv[2]){
 const b=fs.readFileSync(process.argv[2]),rom=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),runtime=JSON.parse(fs.readFileSync(process.argv[3])),trajectory=JSON.parse(fs.readFileSync(process.argv[4]));
 const atKernel=new ATKernel((await WebAssembly.instantiate(fs.readFileSync(new URL('../web/wasm/map_render.wasm',import.meta.url)),{})).instance),fieldKernel=new FieldATKernel(atKernel),kernel=new MonsterMovementKernel((await WebAssembly.instantiate(fs.readFileSync(new URL('../web/wasm/monster_movement.wasm',import.meta.url)),{})).instance,preferredNodeTrigFromRom(rom,{includeAtan:true})),project=new MapProject(rom,'');
 const make=(r=runtime,t=trajectory,seed=2663044269)=>createFirstSpawnReplay({project,rom,kernel,atKernel,fieldKernel,runtime:r,trajectory:t,seed,continueNewborn:true});const run=s=>{while(s.advance()){}return s;};
 const original=JSON.stringify({runtime,trajectory}),s=run(make());
 eq([s.status,s.events.length,s.currentMapId,s.seed,s.consumed],['transition-ended',124,20006,383961641,132]);
 eq([s.actor,s.currentCoordinate,s.timer,s.field.flags,s.field.active,s.field.resources,s.field.tables],[null,null,null,null,null,null,null]);
 eq(s.destinationWorld.resolved,false);eq(s.requestedPlacement,{mapId:20006,xyz:[-16220,9420,-152780],settledHeightKnown:false});
 eq(s.events[117].seed,2820672266);eq(s.events.at(-1).pickupResults.map(x=>x.nativeItemIndex),[0,1,2,3,4,8,9,10,16,17,18]);eq(s.events.at(-1).pickupResults.length,11);eq(s.mapTransitions.loads.get(20006).descriptorIds,[]);eq(s.closedActors.length,1);eq(s.context.serialContext.counter,2);eq(JSON.stringify({runtime,trajectory}),original);
 for(const key of ['stablePickupWords','pickupDescriptorBound','successfulPickupAllocations']){const r=copy(runtime);r.transitionContext.conditions[key]=false;reject(()=>make(r));}
 for(const mutate of [r=>delete r.transitionContext.pickup.stateWords[15],r=>r.transitionContext.pickup.stateWords[99]=1,r=>r.transitionContext.pickup.phaseRange.lower=NaN]){const r=copy(runtime);mutate(r);reject(()=>make(r));}
 {const tr=copy(trajectory);tr.transitionPhases[12].heroXYZ=[0,0,0];const bad=run(make(runtime,tr));eq([bad.status,bad.seed,bad.consumed,bad.currentMapId],['unresolved',2820672266,121,7400]);}
 {const tr=copy(trajectory);tr.transitionPhases.slice(12).forEach(e=>e.sourceFrame+=1000000);const later=run(make(runtime,tr));eq([later.seed,later.consumed],[s.seed,s.consumed]);}
 {const z=run(make(runtime,trajectory,1));eq(z.seed,atKernel.seedAt(1,BigInt(z.consumed)));assert.notEqual(z.seed,s.seed);checks++;}
 {const z=make();while(z.events.length<123)z.advance();z.atKernel={generate:atKernel.generate.bind(atKernel),e:{world_pickup_phase(){throw Error('injected phase failure')}}};eq(z.advance(),false);eq([z.status,z.seed,z.consumed,z.events.at(-1).consumed,z.events.at(-1).invocationResolved],['unresolved',1824386939,122,1,false]);eq([z.field.flags,z.field.resources,z.timer],[null,null,null]);eq(z.advance(),false);eq(z.consumed,122);}
 {const z=make();while(z.events.length<123)z.advance();z.mapTransitions.context.pickup.stateWords[15]=0;while(z.advance()){}eq(z.events.at(-1).pickupResults.length,6);eq(z.consumed,127);}
 optional={passed:true,phases:s.events.length,consumed:s.consumed,seed:s.seed,mapId:s.currentMapId,destinationWorldResolved:false};
}
console.log(JSON.stringify({passed:true,checks,optional,scope:'Reached third shrine exit and pickup materialization; destination world and frame timing remain unresolved'},null,2));
