import {sourceF06KeyboardAngles} from './f06-creator.mjs';
// Connected, conditional F06 motion/selection prefix. ROM placement and collision
// metadata plus original runtime primitives; never a future pose, seed or actor.
import {decodeCalls} from './map-core.mjs';
import {readBoundedNarcMembers} from './map-exits.mjs';
import {BufferReader,Compression} from './vendor/nitro-fs.mjs';
import {monsterCol2FromRom} from './monster-terrain.mjs';
import {fieldNativeDistance} from './field-preferred-node.mjs';
import {decodeEncounterStream} from './encounter-distribution.mjs';
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const i32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const i16=n=>Number.isInteger(n)&&n>=-32768&&n<=32767;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
const need=(p,m)=>{if(!p)throw Error(m);},copy=structuredClone,zero=[0,0,0];
export const F06_MOTION_CONDITIONS=['ordinarySuccessfulSceneLoad','successfulEncounterTableLoad','sceneModeWithin0to3','noSceneObjectWriters','noMapSaveStateSetter','noOtherHeroKinematicWriters','noSpecialMotionActivation','noTouchOverride','cameraYawRemainsInitial','ordinaryHeroEnvironmentGates','noAdditionalCollisionActors','noNodeFlagWriters','noOtherClockOrEnvironmentSetters','fixedClockScaleAndConstants','completeControllerAndFadeStream','ordinaryOfflineSelectedHero'];
export const F06_KEYBOARD_GATES=['ordinaryKeyboardControl','inputEnabledWhenUnlocked','ordinaryControlMode','directionLockAbsent','noTargetAngleOverride','noTouchOverride'];
export function validateF06KeyboardInput(input){
 need(exact(input,['heldDirection','gates'])&&['Down','Right','Up','Left','UpLeft','UpRight','DownLeft','DownRight','None'].includes(input.heldDirection),'Only explicit eight-direction/release keyboard inputs are supported');
 need(exact(input.gates,F06_KEYBOARD_GATES)&&F06_KEYBOARD_GATES.every(k=>input.gates[k]===true),'Complete ordinary keyboard gates required');return copy(input);
}
const heroKeys=['header','turnRate','targetSpeed','acceleration','e0','c1','c2','delayWord','gravity','verticalVelocity','verticalLimit','verticalCounter','width','height','groundFlags','specialMotionByte'];
const f32bits=n=>{need(uint(n),'float word must be u32');const a=new ArrayBuffer(4),v=new DataView(a);v.setUint32(0,n,true);const f=v.getFloat32(0,true);need(Number.isFinite(f),'nonfinite float word');return f;};

export function carryF06Lock(initial,operations,initialFrame,firstFrame){
 need(i32(initial)&&dense(operations)&&operations.length>0&&operations.length<=5000,'Original lock and bounded complete control stream required');
 let lock=initial,previous=initialFrame,ends=0,fades=0;
 for(const e of operations){need(e&&uint(e.sourceFrame)&&e.sourceFrame>=previous&&e.sourceFrame<firstFrame,'Ordered pre-world controller operation required');previous=e.sourceFrame;
  if(e.kind==='controller-end'){need(exact(e,['kind','sourceFrame','scaledDelta'])&&uint(e.scaledDelta,50),'Bounded source end-clock delta required');if(lock>0)lock=(lock-e.scaledDelta)|0;ends++;}
  else{need(exact(e,['kind','sourceFrame','duration','success'])&&e.kind==='ordinary-fade'&&e.duration===15&&e.success===true,'Reached successful ordinary duration15 fade required');
   // JP source literal0203abf0, float bits41855604, followed by f32 multiply/trunc.
   lock=Math.trunc(Math.fround(Math.fround(15)*Math.fround(16.66699981689453)));fades++;}
 }
 need(ends>0&&fades>0,'Incomplete lock producer stream');return {counter:lock,controllerEnds:ends,fades};
}
export function boundF06DayClock(clock,maximumCalls){
 need(exact(clock,['phaseBits','periodBits','rateBits','enabled','category','thresholdBits','environmentOverride','environmentPhaseBits','environmentCategory']),'Complete original day/environment clock words required');
 need(uint(maximumCalls,10000)&&dense(clock.thresholdBits)&&clock.thresholdBits.length===3&&clock.environmentOverride===0,'Bounded ordinary environment clock required');
 const phase=f32bits(clock.phaseBits),period=f32bits(clock.periodBits),rate=f32bits(clock.rateBits),thresholds=clock.thresholdBits.map(f32bits),environmentPhase=f32bits(clock.environmentPhaseBits);
 need(clock.enabled===1&&clock.category===2&&clock.environmentCategory===2&&period===420&&rate===Math.fround(1/60)&&JSON.stringify(thresholds)==='[390,210,180]','Unsupported original day-clock branch/constants');
 // At most one0201009c per reached controller pass;0200ffac clamps phase<=3.
 // 0.051 bounds f32(3*rate), plus addition rounding throughout this interval.
 const upper=Math.max(phase,environmentPhase)+maximumCalls*0.051;
 need(Math.min(phase,environmentPhase)>=210&&upper<386,'Day category or loader near-boundary reset unresolved');
 return {category:2,lower:Math.min(phase,environmentPhase),upper,maximumCalls,phaseMaximum:3,loaderResetThreshold:386,scope:'Category invariant under explicit fixed-clock/no-other-setter conditions'};
}

function callsFromArchive(project,path,name){
 const arc=readBoundedNarcMembers(new Uint8Array(project.nitro.readFile(path))).archive;
 const matches=arc.files.map((b,i)=>({name:arc.fnt.getFilenameOf(i),bytes:b})).filter(r=>r.name===name);need(matches.length===1,'Unique ROM scene member required');let b=matches[0].bytes;
 if(b[0]===16)b=Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength));
 need(b.length>=16&&b.length<=2*1024*1024,'Bounded scene stream required');const v=new DataView(b.buffer,b.byteOffset,b.byteLength),count=v.getUint32(0,true),pool=v.getUint32(4,true),size=v.getUint32(8,true);need(count<=1000&&pool>=16&&pool<=b.length&&size<=b.length-pool,'Scene header bounds');
 let at=16;for(let i=0;i<count;i++){need(at+3<=pool,'Truncated scene command');const n=b[at+2],h=(3+Math.ceil(n/4)+3)&~3;need(at+h+4*n<=pool,'Scene arguments cross pool');for(let j=0;j<n;j++){const type=(b[at+3+(j>>2)]>>((j&3)*2))&3,raw=v.getUint32(at+h+j*4,true);need(type<=2,'Unknown scene argument type');if(type===0&&raw!==0xffffffff){need(raw<size,'Scene string outside pool');let end=pool+raw;while(end<pool+size&&b[end])end++;need(end<pool+size,'Unterminated scene string');}if(type===2)need(Number.isFinite(v.getFloat32(at+h+j*4,true)),'Nonfinite scene argument');}at+=h+4*n;}
 need(pool-at<16&&b.subarray(at,pool).every(x=>x===255),'Unsupported scene command padding');return decodeCalls(b);
}
/** Small ordinary identity scene only; not a generic BMDJ interpreter. */
export function deriveF06Scene(bmbl,bmdj){
 for(const calls of [bmbl,bmdj])need(dense(calls)&&calls.length<=1000&&calls.every(c=>c&&uint(c.opcode,65535)&&dense(c.values)&&c.values.length===c.argumentCount),'Malformed decoded scene calls');
 need(bmbl.every(c=>[100,101,102,104,106,108,110,112,114,115,116,123].includes(c.opcode))&&bmdj.every(c=>[106,107,108,109,110,111,112,113].includes(c.opcode)),'Unsupported scene opcode');
 const placements=bmbl.filter(c=>c.opcode===101),resources=bmdj.filter(c=>c.opcode===108),instances=bmdj.filter(c=>c.opcode===111),resourceCaps=bmdj.filter(c=>c.opcode===106),instanceCaps=bmdj.filter(c=>c.opcode===109),directions=bmbl.filter(c=>c.opcode===123),areas=bmbl.filter(c=>c.opcode===115);
 need(placements.length===1&&placements[0].values.length===5&&placements[0].values[0]===0&&placements[0].values[4]==='F06M0000'&&placements[0].values.slice(1,4).every(v=>v===0),'Single identity F06 scene placement required');
 need(resourceCaps.length===1&&instanceCaps.length===1&&resourceCaps[0].values.length===1&&instanceCaps[0].values.length===1&&uint(resourceCaps[0].values[0],64)&&resourceCaps[0].values[0]===resources.length&&instanceCaps[0].values[0]===instances.length&&resources.length>0&&instances.length>0&&instances.length<=64,'Complete bounded resource/instance capacities required');
 need(directions.length===1&&directions[0].values.length===1&&directions[0].values[0]===0&&areas.every(c=>c.values.length===9&&[10,11].includes(c.values[0])),'Direction/area override outside supported empty lock/type2 lists');
 const sceneCaps=bmbl.filter(c=>c.opcode===100),areaCaps=bmbl.filter(c=>c.opcode===106);
 need(sceneCaps.length===1&&sceneCaps[0].values.length===1&&sceneCaps[0].values[0]===placements.length&&bmbl.indexOf(sceneCaps[0])<bmbl.indexOf(placements[0]),'Scene placement capacity/order mismatch');
 need(areaCaps.length===1&&areaCaps[0].values.length===1&&areaCaps[0].values[0]===areas.length&&areas.every(c=>bmbl.indexOf(c)>bmbl.indexOf(areaCaps[0])),'Area capacity/order mismatch');
 need(resources.every(c=>bmdj.indexOf(c)>bmdj.indexOf(resourceCaps[0]))&&instances.every(c=>bmdj.indexOf(c)>bmdj.indexOf(instanceCaps[0])),'Scene append before capacity');
 need(new Set(resources.map(c=>c.values[0])).size===resources.length&&new Set(instances.map(c=>c.values[0])).size===instances.length,'Duplicate scene IDs');
 for(const c of resources)need(c.values.length===4&&uint(c.values[0],32767)&&typeof c.values[1]==='string'&&/^F06[AM][0-9]{4}\.imd$/.test(c.values[1])&&uint(c.values[2],63)&&uint(c.values[3],255),'Unsupported scene resource');
 const rows=instances.map(c=>{const v=c.values,r=resources.find(r=>r.values[0]===v[1]);need(v.length===14&&uint(v[0],65535)&&r&&Number.isInteger(v[5])&&v[5]>=-1&&v[5]<=65535&&v.slice(2,5).every(x=>x===0)&&v.slice(7,10).every(x=>x===1)&&v.slice(10,13).every(x=>x===0)&&v[13]===63,'Only complete identity instances with ordinary all-mode flags are supported');return {id:v[0],resourceId:v[1],name:r.values[1],parentId:v[5],flags:v[13]^0x30,collision:r.values[1][3]==='A'};});
 for(const r of rows){const seen=new Set([r.id]);let parent=r.parentId;while(parent!==-1){need(!seen.has(parent),'Cyclic scene ancestor chain');seen.add(parent);const p=rows.find(r=>r.id===parent);need(p,'Missing scene ancestor');parent=p.parentId;}}
 const collision=rows.filter(r=>r.collision);need(collision.length===1,'Single COL2 instance required');const r=collision[0],ancestors=[];let parent=r.parentId;while(parent!==-1){ancestors.push(0);parent=rows.find(r=>r.id===parent).parentId;}
 return {resourceName:r.name.replace(/\.imd$/,'.col2'),resourceRows:resources.length,instanceRows:instances.length,collisionInstanceId:r.id,ancestorFlags:ancestors,directionLockCount:0,type2AreaCount:0,position:[...zero],extraMin:[...zero],extraMax:[...zero],resourceOrigin:[...zero],transformShort06:0,flags:0};
}
function nearest(graph,xyz,manhattan){
 const q=manhattan?xyz.map(v=>(v<<4)>>16):xyz;let best=null;
 for(let index=0;index<graph.nodes.length;index++){const n=graph.nodes[index];need(dense(n.position)&&n.position.length===3&&n.position.every(i16),'Graph coordinate domain');const distance=manhattan?n.position.reduce((s,v,k)=>s+Math.abs(v-q[k]),0):fieldNativeDistance(n.position.map(v=>v<<12),q);need(distance!==null,'Entry-node distance overflow');if(best===null||distance<best.distance)best={index,distance};}return best.index;
}
export function validateF06HeroPrimitive(hero,cameraYaw,mapSaveStateByte){
 const h=hero;need(exact(h,heroKeys)&&uint(h.header,65535)&&(h.header&0x1200)!==0&&[h.turnRate,h.targetSpeed,h.acceleration,h.gravity].every(i16)&&[h.e0,h.c1,h.c2,h.specialMotionByte].every(x=>uint(x,255))&&uint(h.delayWord,65535)&&uint(h.verticalCounter,65535)&&[h.verticalVelocity,h.verticalLimit,h.width,h.height].every(i32)&&uint(h.groundFlags),'Complete original hero motion words required');
 need(h.width>0&&h.height>0&&h.width<=65536&&h.height<=65536&&h.delayWord===0&&h.gravity===0&&h.verticalVelocity===0&&h.verticalLimit===0&&h.verticalCounter===0&&h.specialMotionByte===0&&(h.e0&5)===0&&(h.c1&4)===0&&(h.c2&32)===0&&(h.c2&64)!==0&&(h.groundFlags&0x0c000100)===0&&cameraYaw===0&&mapSaveStateByte===0,'Hero correction/special/ground/camera branch unsupported');
 return copy(h);
}
export function validateF06MotionInputs(packet,stream,initialSourceFrame,ticks){
 need(uint(initialSourceFrame)&&dense(ticks)&&ticks.length>0&&ticks.length<=2000&&ticks.every(t=>t&&uint(t.sourceFrame)&&uint(t.delta,50)),'Bounded destination clock stream required');
 need(exact(packet,['schema','initialSourceFrame','hero','initialLock','cameraYaw','mapSaveStateByte','dayClock','conditions','provenance'])&&packet.schema==='dq9-f06-hero-motion-v1'&&packet.initialSourceFrame===initialSourceFrame,'Original-frame F06 motion packet required');
 need(exact(packet.provenance,['kind','sourceFrame'])&&packet.provenance.kind==='original-runtime-primitives'&&packet.provenance.sourceFrame===initialSourceFrame,'Original-state provenance required');
 need(exact(packet.conditions,F06_MOTION_CONDITIONS)&&F06_MOTION_CONDITIONS.every(k=>packet.conditions[k]===true),'Conditional camera/scene/clock/writer declarations required');
 const h=validateF06HeroPrimitive(packet.hero,packet.cameraYaw,packet.mapSaveStateByte);
 const keyboard=Object.hasOwn(stream??{},'keyboardGates');
 need(exact(stream,['prefixLockOperations','controllerPhases','heldDirections',...(keyboard?['keyboardGates']:[])])&&dense(stream.controllerPhases)&&stream.controllerPhases.length===ticks.length&&stream.controllerPhases.every(p=>uint(p,3))&&dense(stream.heldDirections)&&stream.heldDirections.length===ticks.length,'Explicit ordered controller phases and held inputs required');
 if(keyboard){need(dense(stream.keyboardGates)&&stream.keyboardGates.length===ticks.length,'Per-tick keyboard gate stream required');stream.heldDirections.forEach((heldDirection,i)=>validateF06KeyboardInput({heldDirection,gates:stream.keyboardGates[i]}));}
 else need(stream.heldDirections.every(x=>x==='Down'),'Legacy stream requires held Down');
 const lock=carryF06Lock(packet.initialLock,stream.prefixLockOperations,initialSourceFrame,ticks[0].sourceFrame),day=boundF06DayClock(packet.dayClock,lock.controllerEnds+ticks.length+2);
 return {hero:copy(h),lock,day,keyboard};
}
export function prepareF06MotionResources(project,rom){
 const record=project.records.find(r=>r.mapId===20006),graph=project.fieldGraphs.graphs.find(g=>g.key===record?.fieldGraph?.key);need(graph?.nodes?.length>0&&graph.nodes.length<=255,'Successful bounded F06 graph required');
 const scene=deriveF06Scene(callsFromArchive(project,'data/map/F06.ambl','F06M0000.bmbl'),callsFromArchive(project,'data/map/F06.amdj','F06M0000.bmdj')),resource=monsterCol2FromRom(rom,{archivePath:'data/map/F06.amdj',memberName:scene.resourceName}),terrain={mapId:20006,mapAux444:0,nonTiledMode:0,objectListComplete:true,objects:[{index:0,...scene,ancestorChainComplete:true,resourcePresent:true,resourceBindingVerified:true,resource}]};
 const decoded=decodeEncounterStream(new Uint8Array(project.nitro.readFile('data/prm/encfld.bin'))),groups=decoded.groups.filter(g=>g.mapId===20006);need(groups.length===1&&groups[0].conditions.every(n=>n===0),'Unconditional ROM F06 encounter group required');
 const rows=[],distributions={};for(const id of groups[0].tableIds){const t=decoded.tables.find(t=>t.tableId===id);need(t&&t.totalWeight>0&&t.rows.every(r=>(r.packedRaw&0x8000)===0&&!r.isTrapSpecies),'Unsupported F06 weighted table');rows.push({tableId:id,flags:t.flagsRaw});distributions[id]={maxRand:t.totalWeight,data:t.rows.map(r=>({monsterId:r.speciesId,start:r.start,end:r.end}))};}
 return {graph,terrain,scene,rows,distributions};
}
export function prepareF06HeroMotion({project,rom,packet,stream,transitions,ticks,initialSourceFrame}){
 const validated=validateF06MotionInputs(packet,stream,initialSourceFrame,ticks),h=validated.hero,lock=validated.lock,day=validated.day;
 const exit=transitions.exits.get(7400),load=transitions.loads.get(20006);need(exit?.target?.firstMapId===20006&&exit.destination.facingRaw16===0&&load?.descriptorIds?.length===0,'Reached ordinary F06 placement and empty NPC descriptors required');
 const {graph,terrain,scene,rows,distributions}=prepareF06MotionResources(project,rom);
 const state={xyz:[...exit.destination.xyzFixed],angle:exit.destination.facingRaw16,targetAngle:exit.destination.facingRaw16,speed:0,movementByte:0,...copy(h)};delete state.width;delete state.height;delete state.groundFlags;delete state.specialMotionByte;
 return {keyboardInputs:validated.keyboard?stream.heldDirections.map((heldDirection,i)=>validateF06KeyboardInput({heldDirection,gates:stream.keyboardGates[i]})):null,keyboardAngles:validated.keyboard?sourceF06KeyboardAngles(rom):null,state,node:nearest(graph,state.xyz,false),lock:lock.counter,lockProjection:lock,day,phases:[...stream.controllerPhases],directions:[...stream.heldDirections],hero:copy(h),graph,terrain,scene,rows,distributions,nodeFlags:graph.nodes.map(()=>0),assumptions:[...F06_MOTION_CONDITIONS],provenance:copy(packet.provenance),worldResolved:false};
}
export function advanceF06HeroMotion(plan,kernel,clock,keyboardInput=null){
 let keyboard=null;try{if(keyboardInput!==null){keyboard=validateF06KeyboardInput(keyboardInput);need(plan.keyboardAngles?.Down===0&&plan.keyboardAngles?.Right===6434&&plan.keyboardAngles?.Up===12868&&plan.keyboardAngles?.Left===19302,'ROM-bound keyboard angles required');if(['UpLeft','UpRight','DownLeft','DownRight'].includes(keyboard.heldDirection))need(plan.keyboardAngles?.UpLeft===16085&&plan.keyboardAngles?.UpRight===9651&&plan.keyboardAngles?.DownLeft===22519&&plan.keyboardAngles?.DownRight===3217,'ROM-bound diagonal keyboard angles required');}}catch(error){return {resolved:false,reason:error.message};}
 const before=copy(plan.state),r=kernel.kinematicPrefix(before,clock,{reached:true});if(!r.resolved)return {resolved:false,reason:r.reason};
 const displacement=fieldNativeDistance(before.xyz,r.kinematic.xyz);if(displacement===null||displacement>819)return {resolved:false,reason:'Hero multi-substep/correction branch unresolved'};
 const delta=r.kinematic.xyz.map((v,i)=>Math.abs(v-before.xyz[i]));if(delta.some(d=>d!==0)&&delta.every(d=>d<5))return {resolved:false,reason:'Hero small-motion rollback branch unresolved'};
 const g=kernel.walkingGround(r.kinematic.xyz,plan.hero.width,plan.hero.height,plan.hero.groundFlags,plan.terrain);
 if(!g.resolved||!g.horizontalExclusionDerived||!g.objects?.some(o=>o.accepted===true))return {resolved:false,reason:g.reason||'Hero wall response unresolved'};
 // Only the source no-correction branch is composed. Snapped height, deep drop,
 // dynamic collisions and movement rollback require their own outer proof.
 if(g.nextXYZ.some((v,i)=>v!==r.kinematic.xyz[i]))return {resolved:false,reason:'Hero corrected-height outer branch unresolved'};
 const state={...r.kinematic,xyz:[...g.nextXYZ],gravity:0,e0:r.kinematic.e0&63};
 if(plan.lock>0)state.movementByte=0;
 else if(keyboard?.heldDirection==='None'){if(state.movementByte===1)state.movementByte=0;}
 else{state.movementByte=1;state.targetAngle=keyboard?plan.keyboardAngles[keyboard.heldDirection]:0;}
 const nextLock=plan.lock>0?(plan.lock-clock.scaledDelta)|0:plan.lock,node=nearest(plan.graph,state.xyz,true);
 return {resolved:true,state,node,lock:nextLock,ground:{bestY:g.bestY,height:g.height,selectedId:g.objects?.[0]?.selectedId},conditional:true,worldResolved:false};
}
