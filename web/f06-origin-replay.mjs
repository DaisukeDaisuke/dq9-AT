// Narrow fresh F06 pre-scheduler entry. This does not invent or replay a loader,
// D04 trajectory, allocator history, creator result or later native pose.
import {prepareF06MotionResources,validateF06HeroPrimitive,validateF06KeyboardInput,boundF06DayClock,F06_MOTION_CONDITIONS} from './f06-hero-motion.mjs';
import {sourceF06KeyboardAngles,prepareF06Creator,validateF06CreatorPacket,bindF06CreatorOrigin} from './f06-creator.mjs';
import {describeInventorySlot} from './field-inventory.mjs';
const need=(p,m)=>{if(!p)throw Error(m);},uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max,i32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean),exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(n=>Object.hasOwn(o,n)),xyz=a=>dense(a)&&a.length===3&&a.every(i32),copy=structuredClone;
export const F06_ORIGIN_RUNTIME_SCHEMA='dq9-f06-origin-runtime-v1';
export const F06_ORIGIN_CONTROL_SCHEMA='dq9-f06-origin-controls-v1';
export const F06_ORIGIN_CONDITIONS=['active','storyAllowed','ordinaryFreshF06SceneMatchesROM','emptyNPCDescriptors','noOtherATConsumers','completeOrderedSchedulerClockStream','noOtherFieldOrPoolWriters','noOtherPartyOrActorWriters'];
/** Validate the original-state/control boundary before ROM resource allocation. */
export function validateF06OriginInputs(runtime,trajectory){
 const withCreator=Object.hasOwn(runtime??{},'creator');need(withCreator===Object.hasOwn(runtime??{},'creatorContext'),'Original creator packet and bindings must be supplied together');
 need(exact(runtime,['schema','originKind','initialSourceFrame','mapId','initialTimer','fieldFlags','globalWord','parties','inventory','runtimeNodeFlags','motion','conditions','provenance',...(withCreator?['creator','creatorContext']:[])])&&runtime.schema===F06_ORIGIN_RUNTIME_SCHEMA&&runtime.originKind==='fresh-f06-pre-scheduler'&&runtime.mapId===20006&&uint(runtime.initialSourceFrame),'Fresh F06 original runtime packet required');
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
 // Optional creator metadata is read at this same origin, never at birth. Keep
 // the existing constructor conditions; no extra success/preservation flag exists.
 if(withCreator){
  validateF06CreatorPacket(runtime.creator,runtime.initialSourceFrame);
  const c=runtime.creatorContext,ram=(p,n)=>uint(p)&&p>=0x02000000&&(p&3)===0&&p+n<=0x02400000;
  need(exact(c,['controllerPointer','fields','serialContext','poolE0Bytes'])&&ram(c.controllerPointer,0x41cc),'Original creator controller binding required');
  need(dense(c.fields)&&c.fields.length===4,'Four original field bindings required');
  c.fields.forEach((f,i)=>{need(exact(f,['index','pointer','mapId','flags','creationCounter'])&&f.index===i&&ram(f.pointer,0x314)&&f.pointer===c.fields[0].pointer+i*0x314&&f.mapId===(i===0?20006:0)&&f.flags===(i===0?runtime.fieldFlags:i)&&uint(f.creationCounter,65535),'Original fresh field identity mismatch');});
  need(dense(c.poolE0Bytes)&&c.poolE0Bytes.length===12&&c.poolE0Bytes.every(n=>uint(n,255)),'Twelve original pool e0 bytes required');
  const z=c.serialContext;need(exact(z,['counter','registryAddress','slots','external'])&&uint(z.counter,65535)&&ram(z.registryAddress,0x470)&&dense(z.slots)&&z.slots.length===48&&dense(z.external)&&z.external.length===4,'Complete original serial primitives required');
  z.slots.forEach((r,i)=>{need(exact(r,['slot','known','rawPointer','rawHeader','pointer','serial'])&&r.slot===112+i&&r.known===true&&uint(r.rawHeader,65535)&&uint(r.serial,65535),'Original serial slot shape');if(i<12){const a=inventory.slots[i];need(r.rawPointer===a.pointer&&r.rawHeader===a.headerFlags&&r.pointer===(r.rawPointer&&(r.rawHeader&32)?r.rawPointer:0),'Original serial/pool binding mismatch');}else need(r.rawPointer===0&&r.rawHeader===0&&r.pointer===0&&r.serial===0,'Other original natural groups must be absent');});
  z.external.forEach((r,i)=>need(exact(r,['index','pointer','serial'])&&r.index===i&&uint(r.pointer)&&r.pointer>=0x02000000&&(r.pointer&1)===0&&r.pointer+2<=0x02400000&&uint(r.serial,65535),'Original external serial record required'));
  const h=runtime.creator.initialHeap;for(const r of z.external)for(const [start,size] of [[h.descriptorPointer,16],[h.heapPointer,0x30]])need(r.pointer+2<=start||start+size<=r.pointer,'External serial aliases original creator heap metadata');
 }
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
 let creator=null;if(runtime.creator){const c=runtime.creatorContext;Object.assign(field,copy(c.fields[0]));Object.assign(context,{controllerPointer:c.controllerPointer,serialContext:copy(c.serialContext),fields:[field,...copy(c.fields.slice(1))]});for(let i=0;i<12;i++)Object.assign(context.inventory.slots[i],{e0Byte:c.poolE0Bytes[i],nativeSerial:c.serialContext.slots[i].serial});for(const r of c.serialContext.slots.slice(12))context.inventory.slots.push({slot:r.slot,registryKnown:true,pointer:r.rawPointer});creator=prepareF06Creator(project,rom,runtime.creator,runtime.initialSourceFrame);bindF06CreatorOrigin(creator,context);}
 return {f06Origin:true,context,parties,hero,field,group:0,graph,steps:[],rows,distributions,timer:runtime.initialTimer,runtimeNodeFlags:[...runtime.runtimeNodeFlags],continueNewborn:false,mapTransitions:null,f06Continuation:{origin:true,creator,motion,ticks:v.ticks.map(({sourceFrame,delta,scaledDelta})=>({sourceFrame,delta,scaledDelta})),scope:'Fresh F06 original-state conditional keyboard/scheduler; other AT consumers excluded explicitly',worldResolved:false}};
}
