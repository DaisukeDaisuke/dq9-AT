// Narrow fresh F06 pre-scheduler entry. This does not invent or replay a loader,
// D04 trajectory, allocator history, creator result or later native pose.
import {prepareF06MotionResources,validateF06HeroPrimitive,validateF06KeyboardInput,boundF06DayClock,F06_MOTION_CONDITIONS} from './f06-hero-motion.mjs';
import {sourceF06KeyboardAngles} from './f06-creator.mjs';
import {describeInventorySlot} from './field-inventory.mjs';
const need=(p,m)=>{if(!p)throw Error(m);},uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max,i32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean),exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(n=>Object.hasOwn(o,n)),xyz=a=>dense(a)&&a.length===3&&a.every(i32),copy=structuredClone;
export const F06_ORIGIN_RUNTIME_SCHEMA='dq9-f06-origin-runtime-v1';
export const F06_ORIGIN_CONTROL_SCHEMA='dq9-f06-origin-controls-v1';
export const F06_ORIGIN_CONDITIONS=['active','storyAllowed','ordinaryFreshF06SceneMatchesROM','emptyNPCDescriptors','noOtherATConsumers','completeOrderedSchedulerClockStream','noOtherFieldOrPoolWriters','noOtherPartyOrActorWriters'];
/** Validate the original-state/control boundary before ROM resource allocation. */
export function validateF06OriginInputs(runtime,trajectory){
 need(exact(runtime,['schema','originKind','initialSourceFrame','mapId','initialTimer','fieldFlags','globalWord','parties','inventory','runtimeNodeFlags','motion','conditions','provenance'])&&runtime.schema===F06_ORIGIN_RUNTIME_SCHEMA&&runtime.originKind==='fresh-f06-pre-scheduler'&&runtime.mapId===20006&&uint(runtime.initialSourceFrame),'Fresh F06 original runtime packet required');
 need(runtime.initialTimer===0&&runtime.fieldFlags===12&&runtime.globalWord===0,'Only the fresh empty F06 field0 before its first scheduler is supported');
 need(exact(runtime.provenance,['kind','sourceFrame'])&&runtime.provenance.kind==='original-runtime-primitives'&&runtime.provenance.sourceFrame===runtime.initialSourceFrame,'Fresh origin provenance mismatch');
 need(exact(runtime.conditions,F06_ORIGIN_CONDITIONS)&&F06_ORIGIN_CONDITIONS.every(k=>runtime.conditions[k]===true),'All ordinary origin/consumer/clock conditions must be explicit');
 const m=runtime.motion;need(exact(m,['hero','pose','initialLock','cameraYaw','mapSaveStateByte','dayClock','conditions']),'Complete original HERO motion packet required');
 const h=validateF06HeroPrimitive(m.hero,m.cameraYaw,m.mapSaveStateByte),p=m.pose;
 need(exact(p,['xyz','angle','targetAngle','speed','movementByte','nodeIndex'])&&xyz(p.xyz)&&p.angle===0&&p.targetAngle===0&&p.speed===0&&p.movementByte===0&&uint(p.nodeIndex,255),'Only stationary initial F06 load pose before commanded movement is supported');
 need(i32(m.initialLock)&&m.initialLock>0&&m.initialLock<=250,'Original positive ordinary load lock required');
 need(exact(m.conditions,F06_MOTION_CONDITIONS)&&F06_MOTION_CONDITIONS.every(k=>m.conditions[k]===true),'Source motion/camera conditions must be explicit');
 need(dense(runtime.parties)&&runtime.parties.length===4,'Complete party0..3 original registry required');
 runtime.parties.forEach((p,i)=>{need(exact(p,i===0?['slot','registryKnown','pointer','headerFlags','mapId','alternateMap']:['slot','registryKnown','pointer'])&&p.slot===i&&p.registryKnown===true&&uint(p.pointer),'Original party slot shape');if(i===0)need(p.pointer>=0x02000000&&p.pointer+0x250<=0x02400000&&p.headerFlags===h.header&&(p.headerFlags&0x200)!==0&&p.mapId===20006&&p.alternateMap===0xffffffff,'Ordinary selected HERO identity required');else need(p.pointer===0,'Only one selected HERO without other party actors is supported');});
 const inventory=runtime.inventory;need(exact(inventory,['group','slots'])&&inventory.group===0&&dense(inventory.slots)&&inventory.slots.length===12,'Complete empty natural group0 required');
 const pointers=new Set();inventory.slots.forEach((r,i)=>{need(exact(r,['slot','registryKnown','pointer','headerFlags','monsterIdRaw','actorFlags','nodeIndex','xyz'])&&r.slot===112+i&&r.registryKnown===true&&uint(r.pointer)&&r.pointer>=0x02000000&&r.pointer+0x198<=0x02400000&&uint(r.headerFlags,65535)&&uint(r.monsterIdRaw,65535)&&uint(r.actorFlags)&&uint(r.nodeIndex,65535)&&xyz(r.xyz),'Original natural slot shape');const d=describeInventorySlot(r);need(d.allocated===true&&d.allocatorFree===true&&d.active===false&&!pointers.has(r.pointer),'Natural slots must be distinct registered free/inactive objects');pointers.add(r.pointer);need(r.pointer+0x198<=runtime.parties[0].pointer||runtime.parties[0].pointer+0x250<=r.pointer,'HERO/pool alias is unsupported');});
 need(dense(runtime.runtimeNodeFlags)&&runtime.runtimeNodeFlags.length>0&&runtime.runtimeNodeFlags.length<=255&&runtime.runtimeNodeFlags.every(n=>uint(n,255)),'Original complete node flags required');
 need(exact(trajectory,['schema','initialSourceFrame','mapId','ticks'])&&trajectory.schema===F06_ORIGIN_CONTROL_SCHEMA&&trajectory.initialSourceFrame===runtime.initialSourceFrame&&trajectory.mapId===20006&&dense(trajectory.ticks)&&trajectory.ticks.length>0&&trajectory.ticks.length<=2000,'Bounded matched fresh-origin controls required');
 let previous=runtime.initialSourceFrame-1;const ticks=trajectory.ticks.map(t=>{need(exact(t,['sourceFrame','delta','scaledDelta','phase','heldDirection','gates'])&&uint(t.sourceFrame)&&t.sourceFrame>previous&&uint(t.delta,50)&&uint(t.scaledDelta,50)&&uint(t.phase,3),'Strict ordered reached scheduler/controller clocks required');previous=t.sourceFrame;validateF06KeyboardInput({heldDirection:t.heldDirection,gates:t.gates});return copy(t);});
 need(ticks[0].sourceFrame===runtime.initialSourceFrame,'Fresh origin must be immediately before the first supplied scheduler');
 const day=boundF06DayClock(m.dayClock,ticks.length+2);return {hero:h,pose:copy(p),ticks,day};
}
export function prepareF06OriginReplay(project,rom,runtime,trajectory){
 const v=validateF06OriginInputs(runtime,trajectory),resources=prepareF06MotionResources(project,rom),{graph,rows,distributions}=resources;
 need(runtime.runtimeNodeFlags.length===graph.nodes.length&&!!graph.nodes[v.pose.nodeIndex],'Origin node/flag count differs from ROM graph');
 const state={...v.hero,...v.pose};for(const key of ['width','height','groundFlags','specialMotionByte','nodeIndex'])delete state[key];
 const motion={...resources,state,node:v.pose.nodeIndex,lock:runtime.motion.initialLock,hero:v.hero,day:v.day,nodeFlags:[...runtime.runtimeNodeFlags],phases:v.ticks.map(t=>t.phase),directions:v.ticks.map(t=>t.heldDirection),keyboardInputs:v.ticks.map(t=>validateF06KeyboardInput({heldDirection:t.heldDirection,gates:t.gates})),keyboardAngles:sourceF06KeyboardAngles(rom),assumptions:[...F06_MOTION_CONDITIONS,...F06_ORIGIN_CONDITIONS],provenance:copy(runtime.provenance),worldResolved:false};
 const parties=copy(runtime.parties),hero=parties[0];Object.assign(hero,{xyz:[...state.xyz],angle:state.angle,nodeIndex:motion.node});
 const field={index:0,mapId:20006,flags:runtime.fieldFlags,active:1,resources:null,tables:null},context={globalWord:runtime.globalWord,managerMapId:20006,inventory:copy(runtime.inventory),fields:[field]};
 return {f06Origin:true,context,parties,hero,field,group:0,graph,steps:[],rows,distributions,timer:runtime.initialTimer,runtimeNodeFlags:[...runtime.runtimeNodeFlags],continueNewborn:false,mapTransitions:null,f06Continuation:{origin:true,creator:null,motion,ticks:v.ticks.map(({sourceFrame,delta,scaledDelta})=>({sourceFrame,delta,scaledDelta})),scope:'Fresh F06 original-state conditional keyboard/scheduler; other AT consumers excluded explicitly',worldResolved:false}};
}
