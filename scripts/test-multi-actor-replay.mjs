#!/usr/bin/env node
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createFirstSpawnReplay,validateSpawnTrajectory} from '../web/first-spawn-replay.mjs?v=symbolic-clock-20261009-e604633f';
import {MapProject} from '../web/map-core.mjs';import {MonsterMovementKernel} from '../web/monster-movement.mjs?v=symbolic-clock-20261009-e604633f';import {preferredNodeTrigFromRom} from '../web/field-preferred-node.mjs';import {ATKernel} from '../web/at-core.mjs';import {FieldATKernel} from '../web/field-at.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=f=>{assert.throws(f);checks++;};
const point={xyz:[0,0,0],angle:0,nodeIndex:0,graphEnabled:true},t={schema:'dq9-pre-spawn-trajectory-v2',phase:'pre-spawn-and-post-hero-effective',mapId:7402,steps:[{index:0,sourceFrame:null,delta:33,timeValue:0,hero:point,postHero:structuredClone(point),actorClock:{phase:2,scaledDelta:33}}]};
const graph={nodes:[{id:0}]};eq(validateSpawnTrajectory(t,7402,graph,true),t.steps);const actorInjected=structuredClone(t);actorInjected.steps[0].actors=[{xyz:[1,2,3]}];reject(()=>validateSpawnTrajectory(actorInjected,7402,graph,true));const seedInjected=structuredClone(t);seedInjected.steps[0].nextSeed=123;reject(()=>validateSpawnTrajectory(seedInjected,7402,graph,true));
let optional=null;
if(process.argv[2]){
 const [b,r,t,m,a]=await Promise.all([readFile(process.argv[2]),readFile(process.argv[3],'utf8'),readFile(process.argv[4],'utf8'),readFile(new URL('../web/wasm/monster_movement.wasm',import.meta.url)),readFile(new URL('../web/wasm/map_render.wasm',import.meta.url))]);
 const rom=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),runtime=JSON.parse(r),trajectory=JSON.parse(t),project=new MapProject(rom,''),kernel=new MonsterMovementKernel((await WebAssembly.instantiate(m,{})).instance,preferredNodeTrigFromRom(rom,{includeAtan:true})),atKernel=new ATKernel((await WebAssembly.instantiate(a,{})).instance),fieldKernel=new FieldATKernel(atKernel);
 const make=(rt=runtime,tr=trajectory,continued=true)=>createFirstSpawnReplay({project,rom,kernel,atKernel,fieldKernel,runtime:rt,trajectory:tr,seed:2663044269,continueNewborn:continued}),run=s=>{while(s.advance()){}return s;};
 const immutable=JSON.stringify({runtime,trajectory}),s=run(make());eq(s.status,'trajectory-ended');eq(s.events.length,429);eq(s.consumed,343);eq(s.seed,560534860);eq(s.timer,1947);eq(s.actors.size,3);eq(s.field.creationCounter,3);eq(s.context.serialContext.counter,4);
 eq(s.births.map(b=>[b.index+1,b.slot,b.species,b.serial]),[[90,112,83,1],[279,113,31,2],[370,114,83,3]]);
 eq([...s.actors.values()].map(e=>[e.actor.registryIndex,e.actor.xyz,e.actor.stateTimer,e.actor.updateCounter]),[[112,[-94304,-3356,-94],3036,340],[113,[0,1066,16384],3960,151],[114,[-16384,1066,-4096],957,60]]);
 eq(new Set([...s.actors.values()].map(e=>e.identity.generationId)).size,3);
 for(const e of s.actors.values()){const slot=s.context.inventory.slots.find(x=>x.slot===e.identity.slot),serial=s.context.serialContext.slots.find(x=>x.slot===e.identity.slot);eq([slot.pointer,slot.generationId,slot.monsterIdRaw,slot.nativeSerial,serial.serial],[e.identity.pointer,e.identity.generationId,e.actor.species,e.actor.serial,e.actor.serial]);}
 eq(JSON.stringify({runtime,trajectory}),immutable);eq(s.events.filter(e=>e.bodies?.length===3).length,60);eq(s.events.reduce((n,e)=>n+(e.bodies?.length??0),0),551);
 eq(s.events.at(-1).phaseOrder,['spawn','body:112','lifetime:112','body:113','lifetime:113','body:114','lifetime:114','walking:112','walking:113','walking:114']);
 // Observe actual method order at a three-actor phase, not only its log labels.
 const ordered=make();while(ordered.events.length<428)ordered.advance();const calls=[],body=kernel.step,walk=kernel.walkingPass;
 kernel.step=function(actor,...args){calls.push(`body:${actor.registryIndex}`);return body.call(this,actor,...args);};kernel.walkingPass=function(actor,...args){calls.push(`walking:${actor.registryIndex}`);return walk.call(this,actor,...args);};
 try{ordered.advance();}finally{kernel.step=body;kernel.walkingPass=walk;}
 eq(calls,['body:112','body:113','body:114','walking:112','walking:113','walking:114']);eq(ordered.events,s.events);
 const old=run(make(runtime,trajectory,false));eq(old.events.length,90);eq(old.consumed,63);eq(old.status,'created');eq(old.births.length,1);
 // Current creator reads are safe, but its alpha store would change the width
 // of the later species31 descriptor. First-only projection remains valid;
 // continuation must not reuse the stale later descriptor.
 const alias=structuredClone(runtime),models=alias.creatorContext.fields[0].resources.models,template=alias.creatorContext.templates.find(t=>t.species===83),futureIndex=models.entries.findIndex(m=>m.speciesKey===31),alpha=template.modelPointer+0xa2;
 models.basePointer=alpha-futureIndex*20-12;models.entries.forEach((m,i)=>m.pointer=models.basePointer+i*20);const currentModel=models.entries.find(m=>m.speciesKey===83);for(const t of alias.creatorContext.templates)if(t.pointer)t.visualContext.protectedRanges.push({start:currentModel.pointer,size:20});
 const one=run(make(alias,trajectory,false));eq(one.status,'created');const unsafe=run(make(alias));eq(unsafe.status,'unresolved');assert.match(unsafe.reason,/alias a later runtime dependency/);checks++;eq(unsafe.actors.size,0);eq(unsafe.consumed,63);
 const hidden=structuredClone(runtime);hidden.creatorContext.inventory.slots[2].actorFlags=4;hidden.creatorContext.inventory.slots[2].monsterIdRaw=83;reject(()=>make(hidden));const future=structuredClone(runtime);future.actors=[{slot:112}];reject(()=>make(future));
 const zero=make();while(zero.events.length<279)zero.advance();eq(zero.actors.size,2);eq(zero.births[1].serial,2);eq(zero.context.serialContext.slots.find(x=>x.slot===112).serial,1);eq(zero.context.serialContext.slots.find(x=>x.slot===113).serial,2);
 // Explicit synthetic next phase: all three modeled actors are in the native
 // asymmetric proximity box, so no selected-member attempt or draw is invented.
 const cap=structuredClone(trajectory),last=structuredClone(cap.steps.at(-1));last.index=429;last.sourceFrame=null;last.hero.xyz=[-49152,-3313,0];last.postHero.xyz=[-49152,-3313,0];cap.steps.push(last);const limited=run(make(runtime,cap));eq(limited.events.at(-1).nearbyActorSlots,[112,113,114]);eq(limited.events.at(-1).consumed,0);eq(limited.consumed,s.consumed);
 const inputPhase=structuredClone(trajectory);inputPhase.steps[278].postHero.xyz=[1000000,0,1000000];const reset=run(make(runtime,inputPhase));eq(reset.status,'reset');eq(reset.events.length,279);eq(reset.events.at(-1).environments.length,0);eq(reset.events.at(-1).bodies.length,1);eq(reset.actors.size,2);
 // Three explicitly hypothetical held-pose phases exercise a derived actor's
 // route-choice draw. They are not claimed native/video continuation inputs.
 const extra=structuredClone(trajectory);for(let n=0;n<3;n++){const step=structuredClone(extra.steps.at(-1));step.index=extra.steps.length;step.sourceFrame=null;extra.steps.push(step);}const ownDraw=run(make(runtime,extra));eq(ownDraw.status,'trajectory-ended');eq(ownDraw.events.at(-1).bodies.map(b=>[b.slot,b.atConsumed]),[[112,0],[113,1],[114,0]]);eq(ownDraw.events.at(-1).consumed,2);eq(ownDraw.seed,atKernel.seedAt(s.seed,4n));eq(ownDraw.actors.get(114).actor.currentSeed,ownDraw.seed);
 // A later actor failure must expose the seed after earlier owned draws as a
 // known prefix, without marking this partial phase complete.
 const partial=make(runtime,extra);while(partial.events.length<431)partial.advance();kernel.step=function(actor,...args){if(actor.registryIndex===114)throw Error('synthetic later-body failure');return body.call(this,actor,...args);};
 try{partial.advance();}finally{kernel.step=body;}
 eq(partial.status,'unresolved');eq(partial.events.at(-1).invocationResolved,false);eq(partial.events.at(-1).seed,partial.seed);eq(partial.events.at(-1).consumed,2);eq(partial.seed,ownDraw.seed);eq(partial.events.at(-1).environments.length,0);
 optional={passed:true,completeInputs:429,actorUpdates:551,births:s.births,seed:s.seed,consumed:s.consumed,fieldTimer:s.timer,actors:[...s.actors.values()].map(e=>({slot:e.identity.slot,xyz:e.actor.xyz,timer:e.actor.stateTimer,counter:e.actor.updateCounter})),actualAllBodyBeforeWalkingOrder:true,initialHiddenActorRejected:true,thirdActorProximityCapDerived:true,noLaterStateOrSeedInputs:true};
}
console.log(JSON.stringify({passed:true,checks,optional,scope:'derived multi-actor continuation under the supplied phase/context hypotheses'},null,2));
