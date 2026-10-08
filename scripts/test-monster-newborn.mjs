#!/usr/bin/env node
// Synthetic source/guard tests. No ROM table is exercised by stationary motion;
// native ROM/collision validation lives in replay-monster-newborn.mjs.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {MonsterMovementKernel} from '../web/monster-movement.mjs?v=motion-closure-20261008-89e290ef';import {stepNewbornState0} from '../web/monster-newborn.mjs';
const wasm=await readFile(process.argv[2]??new URL('../web/wasm/monster_movement.wasm',import.meta.url)),{instance}=await WebAssembly.instantiate(wasm,{}),kernel=new MonsterMovementKernel(instance,{divisor:25736,values:new Int16Array(8192)});
const initial={xyz:[-12000,0,1000],angle:1234,targetAngle:1234,header:35,actorFlags:4,state:0,previousState:1,stateTimer:0,activeElapsed:0,updateCounter:0,currentSeed:0x12345678,movementByte:5,previousMovementByte:0,e0:128,c1:0,c2:0,cooldownByte:0,delayWord:0,correctionSpeed:0,gravity:0,turnRate:804,speed:0,targetSpeed:450,acceleration:40,verticalVelocity:0,verticalLimit:0,verticalCounter:0,mapId:7402,animationEventIndex:65535};
const context={tickReached:true,globalWord:0,managerMapId:7402,clock:{phase:2,scaledDelta:33},visualBindingValidated:true,animationComponents:{complete:true,records:[{typeWord:1}]}};
let cases=0;for(let i=0;i<1000;i++){
 const a={...initial,angle:i*17%25736,targetAngle:i*17%25736,xyz:[i*7919,-200000+i*71,i*1543]};
 for(const mode of [0,5]){const r=kernel.kinematicPrefix({...a,movementByte:mode},context.clock,{reached:true});assert(r.resolved,r.reason);assert.deepEqual(r.kinematic.xyz,a.xyz);assert.equal(r.kinematic.angle,a.angle);assert.equal(r.kinematic.speed,0);}cases++;
}
for(const [timer,state,after]of [[967,0,1000],[968,1,0],[0xffffffff,0,32]]){const r=stepNewbornState0(kernel,{...initial,stateTimer:timer},context);assert(r.resolved,r.reason);assert.equal(r.nextState.state,state);assert.equal(r.nextState.stateTimer,after);assert.equal(r.nextState.activeElapsed,0);cases++;}
for(const change of [a=>a.speed=1,a=>a.movementModeFamily=[1],a=>a.movementModeFamily=[0],a=>a.e0=64,a=>a.gravity=1,a=>a.animationEventIndex=0,a=>a.currentSeed=undefined,a=>delete a.xyz[1]]){const a=structuredClone(initial);change(a);assert.equal(stepNewbornState0(kernel,a,context).resolved,false);cases++;}
const snapshot=JSON.stringify({initial,context});let state=initial;for(let i=0;i<31;i++){const r=stepNewbornState0(kernel,state,context);assert(r.resolved,r.reason);assert.equal(r.atConsumed,0);state=r.nextState;}assert.equal(state.state,1);assert.equal(state.updateCounter,31);assert.equal(state.stateTimer,0);assert.equal(state.movementByte,0);assert.equal(state.previousMovementByte,0);assert.equal(JSON.stringify({initial,context}),snapshot);cases++;
console.log(JSON.stringify({scope:'synthetic stationary newborn source/guard tests',cases,passed:true,nativeCoverageAdded:0,fullWorldResolved:false},null,2));
