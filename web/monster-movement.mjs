// Partial source-derived native motion arithmetic. No renderer, tween, recorded
// next position, collision result or full-FSM completion is hidden in this API.
import {fieldNodeOccupied} from './field-preferred-node.mjs';
import {unarmedCurrentNodeTransition} from './monster-unarmed.mjs';
const i32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const i16=n=>Number.isInteger(n)&&n>=-32768&&n<=32767;
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
const dense=a=>{if(!Array.isArray(a))return false;for(let i=0;i<a.length;i++)if(!Object.hasOwn(a,i))return false;return true;};
const xyz=p=>Array.isArray(p)&&p.length===3&&dense(p)&&p.every(i32);
const fields=['angle','targetAngle','turnRate','speed','targetSpeed','acceleration','movementByte','header','e0','c1','c2','delayWord','gravity','verticalVelocity','verticalLimit','verticalCounter'];
function boundDerivedFamily(actor,context){
 const family=actor.selectedComponentFamily,c=context.animationComponents,proof=context.derivedCreationProof;
 if(actor.animationClass!==undefined||actor.animationClassPointer!==undefined||!dense(family)||family.length!==2||family[0]!=='null'||family[1]!=='bound-type1'||proof?.created!==true||proof.creationProjectionResolved!==true||!proof.actor||proof.actor.registryIndex!==actor.registryIndex||proof.actor.species!==actor.species||!dense(c?.records)||!c.records.length||c.complete!==true||!u32(c.headPointer)||!c.headPointer)return false;
 const binding=proof.animationBinding;if(!binding||binding.templatePointer!==proof.templatePointer||binding.componentListPointer!==c.headPointer||!dense(binding.records)||binding.records.length!==c.records.length||proof.actor.serial!==actor.serial)return false;
 for(let i=0;i<c.records.length;i++){const r=c.records[i],b=binding.records[i];if(!r||!b||b.pointer!==r.pointer||b.typeWord!==r.typeWord||b.nextPointer!==r.nextPointer)return false;}
 let pointer=c.headPointer;const seen=new Set();for(const r of c.records){if(!r||r.pointer!==pointer||!u32(r.pointer)||seen.has(pointer)||r.typeWord!==1||!u32(r.nextPointer))return false;seen.add(pointer);pointer=r.nextPointer;}return pointer===0;
}
export class MonsterMovementKernel {
 constructor(instance,trig){this.e=instance.exports;if(typeof this.e.monster_motion_prefix!=='function')throw Error('Monster motion WASM export missing');if(trig?.divisor!==25736||!(trig.values instanceof Int16Array)||trig.values.length!==8192)throw Error('Verified ROM trig resource required');new Int16Array(this.e.memory.buffer,this.e.monster_motion_trig(),8192).set(trig.values);this.atanReady=trig.atan?.values instanceof Int16Array&&trig.atan.values.length===129&&typeof this.e.monster_motion_atan_table==='function';if(this.atanReady)new Int16Array(this.e.memory.buffer,this.e.monster_motion_atan_table(),129).set(trig.atan.values);}
 state2Steering(currentXYZ,targetXYZ){return this.steering(currentXYZ,targetXYZ,true);}
 state2EntrySteering(currentXYZ,targetXYZ){return this.steering(currentXYZ,targetXYZ,false);}
 steering(currentXYZ,targetXYZ,flattenCurrentY){
  if(!this.atanReady||![currentXYZ,targetXYZ].every(xyz))return {resolved:false,reason:'ROM atan table and dense signed32 current/target XYZ required'};
  const input=new Int32Array(this.e.memory.buffer,this.e.monster_motion_input(),24);input.fill(0);input.set([...currentXYZ,...targetXYZ]);
  if(this.e.monster_motion_state2_steer(flattenCurrentY?1:0)!==1)return {resolved:false,reason:'zero/out-of-domain steering vector'};
  const out=new Int32Array(this.e.memory.buffer,this.e.monster_motion_output(),6);
  return {resolved:true,normalizedDelta:Array.from(out.slice(0,3)),targetAngle:out[3],steeringDistance:out[4],xzArrivalDistance:out[5],arrivalGateReached:out[5]<4096,scope:flattenCurrentY?'02078118 numeric steering; current Y flattened':'02077ef8 entry steering; full current XYZ',fullMonsterStepResolved:false};
 }
 step(before,context,fieldKernel){
  const unresolved=reason=>({resolved:false,reason,motionFSMProjectionResolved:false,fullMonsterStepResolved:false,worldStepResolved:false,inputUnchanged:true});
  if(context?.tickReached!==true||![1,2].includes(before?.state)||context.globalWord!==0)return unresolved('supported state1/2 tick and raw-position global context required');
  if(![before.stateTimer,before.activeElapsed,before.updateCounter,before.currentSeed].every(u32)||!u32(before.actorFlags)||!byte(before.detectionMode)||before.alertFlag!==0)return unresolved('complete pre-tick timers/flags/AT state with no prior alert required');
  // Source closure for this 3D animation family: both callback branches only
  // change animation fields. Mode0/1 next-mode bytes are -1; BE stays unchanged.
  // Do not return copied animation state as if it had been predicted.
  if(before.e0!==0||(before.c2&64)!==0||before.correctionSpeed!==0||before.cooldownByte!==0||(before.animationClass!==1&&!boundDerivedFamily(before,context))||before.animationEventIndex!==65535||(before.actorFlags&0x40000)!==0)return unresolved('base correction/path/animation projection outside supported guards');
  const selectable=context.animationComponents;
  if(selectable?.complete!==true||!dense(selectable.records)||!selectable.records.length||!selectable.records.every(c=>c&&c.typeWord===1))return unresolved('complete all-type1 selectable animation component list required');
  const prefix=this.kinematicPrefix(before,context.clock,{reached:true});if(!prefix.resolved)return unresolved(prefix.reason);
  const current={...prefix.kinematic,stateTimer:(before.stateTimer+context.clock.scaledDelta)>>>0,activeElapsed:(before.activeElapsed+context.clock.scaledDelta)>>>0,updateCounter:(before.updateCounter+1)>>>0};
  if(current.activeElapsed>1999&&current.alertFlag===0&&current.detectionMode!==0){
   if(![1,2,3].includes(current.detectionMode)||!dense(context.parties)||context.parties.some(p=>!p||typeof p!=='object'))return unresolved('alert detector mode/party pre-state unresolved');
   const parties=new Map(context.parties.map(p=>[p.slot,p]));if(parties.size!==context.parties.length)return unresolved('duplicate party records');
   const radius=current.detectionMode===2?0x7800:0x3800;
   for(let slot=0;slot<4;slot++){
    const p=parties.get(slot);if(p?.registryKnown!==true||!u32(p.pointer))return unresolved('party registry incomplete');
    if(p.pointer===0){if(slot===0)break;continue;}
    if(!Number.isInteger(p.headerFlags)||p.headerFlags<0||p.headerFlags>65535)return unresolved('typed-party header unknown');
    if((p.headerFlags&0x800)===0){if(slot===0)break;continue;}
    const distance=this.state2EntrySteering(current.xyz,p.xyz);
    if(!distance.resolved||(current.detectionMode===3?distance.steeringDistance<radius:distance.steeringDistance<=radius))return unresolved('near/unknown party requires unsupported alert/eligibility branch');
   }
  }
  let result;
  if(current.state===1)result=this.state1TargetTransition(current,{...context,handlerReached:true},fieldKernel);
  else{
   if(!xyz(current.targetXYZ)||!Number.isInteger(current.speedMode)||current.speedMode<0||current.speedMode>3)return unresolved('state2 target/speed pre-state unknown');
   const steering=this.state2Steering(current.xyz,current.targetXYZ);
   if(!steering.resolved||steering.steeringDistance<4096)return unresolved('early full-distance state2 transition not closed');
   const speed=[0,154,230,450][current.speedMode];
   const nextState={...current,targetAngle:steering.targetAngle,speed,targetSpeed:speed,movementByte:1,delayWord:current.delayWord&32767,actorFlags:(current.actorFlags&~0x40000)>>>0};
   let terrain;
   if(steering.xzArrivalDistance<4096){
    if(![current.mapId,context.fieldMapId,context.terrain?.mapId].every(v=>Number.isInteger(v)&&v>=0&&v<=65535)||context.graphBindingVerified!==true||context.fieldPresent!==true||context.fieldMapId!==current.mapId||context.terrain?.mapId!==current.mapId||context.terrain.mapAux444!==0||!byte(current.targetNodeId)||!dense(context.graph?.nodes)||context.graph.nodes.some(n=>!n||!byte(n.id)))return unresolved('arrival graph/manager/terrain reachability unresolved');
    const targets=context.graph.nodes.filter(n=>n&&n.id===current.targetNodeId);
    if(targets.length!==1||!xyz(targets[0].position)||!targets[0].position.every(i16))return unresolved('arrival target graph node unresolved');
    const query=[current.xyz[0],targets[0].position[1]*4096,current.xyz[2]];
    terrain=this.terrainHeight(query,context.terrain);if(!terrain.resolved)return unresolved(terrain.reason);
    Object.assign(nextState,{xyz:[query[0],terrain.height,query[2]],state:1,previousState:2,stateTimer:0,movementByte:0,previousMovementByte:1,turnRate:808,speed:0,targetSpeed:0,actorFlags:(nextState.actorFlags&~128)>>>0,field17a:0});
   }
   result={resolved:true,nextState,atConsumed:0,nextATSeed:current.currentSeed,steering,terrain};
  }
  if(!result.resolved)return {...result,motionFSMProjectionResolved:false,worldStepResolved:false};
  const next={...result.nextState};for(const key of ['animationFlags','animationTransition','animationFrame','animationResource'])delete next[key];
  const components=context.animationComponents;
  const stableClass=components?.complete===true&&dense(components.records)&&components.records.length>0&&components.records.every(c=>c&&c.typeWord===1);
  delete next.animationClassPointer; // Component selection is animation state, not predicted here.
  if(!stableClass)delete next.animationClass;
  if(!((before.state===1&&next.state===2)||(before.state===2&&next.state===1)))delete next.previousMovementByte; // Any base mode-completion branch may recopy BE→BF; only entry2 determines BF for this projection.
  return {...result,nextState:next,scope:'one supported02077a74 motion/FSM projection',motionFSMProjectionResolved:true,fullMonsterStepResolved:false,animationFieldsResolved:false,worldStepResolved:false,inputUnchanged:true,excludedProjectionFields:['animation runtime fields','BF animation recopy except deterministic state entry'],remaining:['other terrain/transform branches','alert/chase and other FSM states','outer lifetime and world invocation/consumer schedule']};
 }
 walkingPass(before,context){
  const no=reason=>({resolved:false,reason,walkingPassProjectionResolved:false,environmentStepResolved:false,worldStepResolved:false,atConsumed:null,minimumATConsumed:0});
  const hero=context?.selectedHero,id=context?.identity,lookup=context?.typedMonsterLookup;
  if(context?.ordinaryPassReached!==true||context.globalWord!==0||!u32(context.controllerFlags)||(context.controllerFlags&0x2420)!==0||!i32(context.worldKind))return no('ordinary walking controller/global context unresolved');
  if(!id||typeof id.generationId!=='string'||!id.generationId||!u32(id.pointer)||!id.pointer||!Number.isInteger(id.slot)||id.slot<112||id.slot>=160||before?.registryIndex!==id.slot||lookup?.known!==true||lookup.pointer!==id.pointer||lookup.generationId!==id.generationId)return no('ordinary typed-monster generation/slot binding unresolved');
  const map=n=>Number.isInteger(n)&&n>=0&&n<=65535;
  if(!map(before.header)||(before.header&0x20)===0||(before.header&0x100)!==0||!map(before.species)||before.species>=32768||!map(before.mapId)||!xyz(before.xyz)||before.xyz[1]<-122880||before.gravity!==0||!byte(before.e0)||!byte(before.c1))return no('walking species/header/gravity/clamp branch unsupported');
  if(hero?.registryKnown!==true||!u32(hero.pointer)||!hero.pointer||!map(hero.mapId)||hero.mapId!==before.mapId||!u32(hero.flagsKnownMask)||!(hero.flagsKnownMask&0x08000000)||!u32(hero.flagsKnownValue)||(hero.flagsKnownValue&0x08000000)!==0)return no('selected generic hero/map/ground override unresolved');
  if(!map(context.managerMapId)||context.managerMapId!==before.mapId||context.terrain?.mapId!==context.managerMapId)return no('walking manager/actor/terrain map binding unresolved');
  if(!dense(context.callParameters)||context.callParameters.length!==5||context.callParameters.some(v=>v!==0))return no('only the ordinary zero-argument walking pass is supported');
  if(context.anchorsComplete!==true||!Number.isInteger(context.anchorCount)||context.anchorCount<0||context.anchorCount>4||!dense(context.anchors)||context.anchors.length!==context.anchorCount||context.anchors.some((a,i)=>!a||a.index!==i||!xyz(a.xyz))||typeof this.e.monster_walking_anchor_test!=='function')return no('complete bounded dynamic-anchor inputs required');
  const anchorChecks=[];
  for(const anchor of context.anchors){const input=new Int32Array(this.e.memory.buffer,this.e.monster_motion_input(),24);input.fill(0);input.set([...before.xyz,...anchor.xyz]);this.e.monster_walking_anchor_test();const out=new Int32Array(this.e.memory.buffer,this.e.monster_motion_output(),6);if(out[3]<0)return no('dynamic-anchor abs overflow outside supported domain');anchorChecks.push({index:anchor.index,absY:out[3],squareXZ:out[4],near:out[5]!==0});if(out[5])return no('near dynamic anchor requires an unsupported collision branch');}
  const ground=this.walkingGround(before.xyz,before.width,before.height,before.actorFlags,context.terrain);if(!ground.resolved)return no(ground.reason);
  const changed=ground.nextXYZ.some((v,i)=>v!==before.xyz[i]);
  if(changed&&(!byte(context.scriptMode)||context.scriptMode===2||context.scriptMode===5))return no('changed position requires a known non-dispatching script mode');
  const projectedWrites={xyz:[...ground.nextXYZ],gravity:0,e0:before.e0&0x3f,actorFlags:(before.actorFlags&~0x04000000)>>>0},nextState={...before,...projectedWrites};delete nextState.groundMaterialCache;
  return {resolved:true,scope:'conditional ordinary one-monster walking motion-state projection',nextState,projectedWrites,ground,anchorChecks,scriptModeRead:changed,atConsumed:0,walkingPassProjectionResolved:true,environmentStepResolved:false,worldStepResolved:false,materialCacheResolved:false,excludedProjectionFields:['ground material cache114..11b'],remaining:['invocation order/clock and other actors','general gravity, horizontal collision and dynamic-anchor hit branches']};
 }
 terrainHeight(queryXYZ,context){return this.#queryTerrain(queryXYZ,context,null);}
 walkingGround(beforeXYZ,width,height,actorFlags,context){
  const no=reason=>({resolved:false,reason,environmentStepResolved:false});
  if(!xyz(beforeXYZ)||!Number.isInteger(width)||width<=0||width>0x7fffffff||!Number.isInteger(height)||height<=0||height>0x7fffffff||!u32(actorFlags))return no('explicit signed-positive native dimensions and XYZ/flags required');
  if(!Number.isInteger(context?.mapId)||context.mapId<0||context.mapId>65535||context.mapId===4401||(actorFlags&0x4000100)!==0)return no('walking ground map/force branch outside supported domain');
  const result=this.#queryTerrain(beforeXYZ,context,{width,height});if(!result.resolved)return result;
  const horizontalChecks=[];
  if(!(actorFlags&128))for(let i=0;i<result.objects.length;i++){const q=result.objects[i];if(q.skipped)continue;const resource=context.objects[i].resource;for(const id of q.candidateIds){const normalY=resource.triangleWords[id*12+10];if(!Number.isInteger(normalY)||normalY<=2048)return no('horizontal triangle response outside bounded normal exclusion');horizontalChecks.push({object:i,id,normalY});}}
  return {...result,horizontalExclusionDerived:!(actorFlags&128),horizontalChecks,environmentStepResolved:false};
 }
 #queryTerrain(queryXYZ,context,walking){
  const no=reason=>({resolved:false,reason,atConsumedKnown:false});
  if(!xyz(queryXYZ)||context?.nonTiledMode!==0||context.objectListComplete!==true||!dense(context.objects)||typeof this.e.monster_terrain_query!=='function')return no('complete non-tiled terrain query context required');
  let height=queryXYZ[1],bestY=(queryXYZ[1]-40960)|0;const referenceY=queryXYZ[1],results=[];
  if(walking&&typeof this.e.monster_walking_terrain_query!=='function')return no('walking terrain WASM export missing');
  for(const object of context.objects){
   if(!object||!u32(object.flags)||object.ancestorChainComplete!==true||!dense(object.ancestorFlags)||!object.ancestorFlags.every(u32))return no('object flags/ancestor chain unknown');
   if((object.flags&5)||object.ancestorFlags.some(f=>f&4)){results.push({skipped:'native object/ancestor flags'});continue;}
   if(object.resourcePresent!==true||object.resourceBindingVerified!==true||![object.position,object.extraMin,object.extraMax,object.resourceOrigin].every(p=>xyz(p)&&p.every(v=>v===0)))return no('eligible resource binding or zero transform/bounds context unknown');
   if(walking&&object.transformShort06!==0)return no('walking object rotation must be explicitly zero');
   const r=object.resource,g=r?.grid;
   if(r?.format!=='dq9-monster-col2-v3'||!g||!(r.triangleWords instanceof Int16Array)||!(r.boundsIndices instanceof Uint8Array)||!(r.triangleFlags instanceof Uint8Array)||!(g.counts instanceof Uint8Array)||!(g.starts instanceof Uint16Array)||!(g.triangleIndices instanceof Uint16Array)||!xyz(g.min)||!xyz(r.resourceBounds?.max))return no('decoded ROM COL2 required');
   if(!Number.isInteger(r.coordinateShift)||r.coordinateShift<0||r.coordinateShift>16||!Number.isInteger(r.triangleCount)||r.triangleCount<0||r.triangleCount>65535||![g.columns,g.rows,g.cellSize,g.cellCount].every(v=>Number.isInteger(v)&&v>0)||g.cellSize>32767||g.cellCount>65536||g.columns*g.rows+Math.floor(g.rows/2)!==g.cellCount||!g.min.every(i16))return no('COL2 numerical header domain unsupported');
   const scale=2**r.coordinateShift,max=r.resourceBounds.max.map(v=>v/scale),words=16+r.triangleCount*19+g.cellCount*2+g.triangleIndices.length;
   if(!Number.isSafeInteger(words)||words>131072||r.triangleWords.length!==r.triangleCount*12||r.boundsIndices.length!==r.triangleCount*6||r.triangleFlags.length!==r.triangleCount||g.counts.length!==g.cellCount||g.starts.length!==g.cellCount||!xyz(max)||!max.every(i16)||max.some((v,i)=>v<g.min[i]))return no('COL2 shape/capacity unsupported');
   const input=new Int32Array(this.e.memory.buffer,this.e.monster_terrain_input(),words);input.set([...queryXYZ,r.coordinateShift,g.columns,g.rows,g.cellSize,r.triangleCount,g.cellCount,g.triangleIndices.length,...g.min,...max]);let at=16;
   for(let i=0;i<r.triangleCount;i++){input.set(r.triangleWords.subarray(i*12,i*12+12),at);at+=12;input.set(r.boundsIndices.subarray(i*6,i*6+6),at);at+=6;input[at++]=r.triangleFlags[i];}input.set(g.counts,at);at+=g.cellCount;input.set(g.starts,at);at+=g.cellCount;input.set(g.triangleIndices,at);
   const status=walking?this.e.monster_walking_terrain_query(words,walking.width,walking.height,height):this.e.monster_terrain_query(words);
   if(status!==1)return no('native query saturation or numerical domain unresolved');
   const o=new Int32Array(this.e.memory.buffer,this.e.monster_terrain_output(),256);let accepted=false,snapped=false;
   if(o[1]>=0){
    if(!walking)height=o[0];
    else if(o[0]>bestY){const drop=(referenceY-o[0])|0;if(drop>=2048)return no('walking eight-probe drop branch unresolved');if(drop===-2147483648)return no('walking abs overflow outside supported branch');const absolute=Math.abs(drop);if(o[0]<referenceY||absolute<4096){bestY=o[0];accepted=true;snapped=absolute>40;height=snapped?o[0]:referenceY;}}
   }
   results.push({height:o[0],selectedIndex:o[1],cells:Array.from(o.slice(8,8+o[2])),candidateIds:Array.from(o.slice(16,16+o[3])),visitedCount:o[4],planeTime:o[5],selectedId:o[1]>=0?o[6]:null,...(walking?{accepted,snapped,currentY:height,bestY}:{} )});
  }
  return {resolved:true,height,objects:results,atConsumed:0,scope:walking?'conditional static walking-ground numerical/snap leaf':'bounded zero-transform non-tiled terrain leaf',worldStepResolved:false,...(walking?{nextXYZ:[queryXYZ[0],height,queryXYZ[2]],bestY,environmentStepResolved:false,remaining:['controller/dynamic-anchor gates','outer gravity and scheduling']}:{} )};
 }
 state1TargetTransition(before,context,fieldKernel){
  const unknown=(reason,extra={})=>({resolved:false,reason,scope:'reached02077d10 handler only',fullMonsterStepResolved:false,inputUnchanged:true,...extra});
  if(context?.handlerReached!==true||before?.state!==1)return unknown('state1 handler reachability unknown');
  if(context.globalWord!==0||context.fieldPresent!==true||context.tableBindingVerified!==true||context.graphBindingVerified!==true||!Number.isInteger(before.mapId)||before.mapId<0||before.mapId>65535||context.fieldMapId!==before.mapId)return unknown('field/global/table/graph binding unresolved');
  if(!xyz(before.xyz)||!u32(before.currentSeed)||!u32(before.stateTimer)||!u32(before.actorFlags)||!Number.isInteger(before.delayWord)||before.delayWord<0||before.delayWord>65535||!byte(before.routeFlags)||!Number.isInteger(before.tableId)||!Number.isInteger(before.currentNodeIndex)||!Number.isInteger(before.previousState)||before.previousState<0||before.previousState>12)return unknown('complete handler-entry state required');
  if(before.alertFlag!==0||before.blockFlag!==0)return unknown('state1 upstream flag gate unresolved');
  if(before.stateTimer<4001)return {resolved:true,scope:'reached02077d10 handler only',nextState:structuredClone(before),atConsumed:0,nextATSeed:before.currentSeed,fullMonsterStepResolved:false,reason:'state1 timer below4001'};
  if((before.routeFlags&64)===0)return unarmedCurrentNodeTransition(this,before,context);
  if(before.routeMode!==1||before.movementByte!==0||before.e0!==0||(before.actorFlags&0x40000)!==0||![0,1,2,3,7,8,9,10,11,12].includes(before.previousState))return unknown('unsupported state1 route/path/target dependency');
  const {graph,inventory}=context,group=context.fieldFlags&3,current=graph?.nodes?.[before.currentNodeIndex];
  if(!dense(graph?.nodes)||graph.nodes.some(n=>!n||!byte(n.id))||!current||!dense(current.neighbors)||!current.neighbors.length||!Number.isInteger(context.fieldFlags)||context.fieldFlags<0||context.fieldFlags>65535||typeof fieldKernel?.movement!=='function'||!dense(inventory?.slots)||inventory.slots.some(r=>!r||typeof r!=='object'))return unknown('ordered graph/current node, inventory or natural group unresolved');
  if(!dense(context.tableRows)||context.tableRows.some(r=>!r||!Number.isInteger(r.tableId)||r.tableId<0||r.tableId>65535||!u32(r.flags)))return unknown('complete dense native table rows required');
  const rows=context.tableRows.filter(r=>r.tableId===before.tableId);
  if(!rows?.length||rows.some(r=>!u32(r.flags)))return unknown('actor table row not resolved from supplied ROM');
  const masks=[...new Set(rows.map(r=>(r.flags>>>13)&255))];if(masks.length!==1)return unknown('possible actor-table area masks disagree');
  const occupiedIndices={};for(const index of current.neighbors){const n=Number.isInteger(index)&&index>=0?graph.nodes[index]:null;if(!n||!byte(n.areaMask))return unknown('adjacent node or explicit native area mask missing');const test=fieldNodeOccupied(graph,inventory,group,n.id);if(!test.resolved)return unknown('typed-active neighbor occupancy unknown');occupiedIndices[index]=test.occupied;}
  const movement=fieldKernel.movement({graph,currentIndex:before.currentNodeIndex,armed:true,occupiedIndices,tableAreaMask:masks[0],seed:before.currentSeed,position:0n});
  if(!movement.resolved||movement.consumed!==1)return unknown('first transition contract requires a nonempty derived neighbor choice');
  const target=graph.nodes[movement.nextIndex];if(!xyz(target?.position)||!target.position.every(i16))return unknown('selected node position outside native domain',{minimumATConsumed:1,retryFromOriginal:true});
  const targetXYZ=target.position.map(x=>x*4096),steering=this.state2EntrySteering(before.xyz,targetXYZ);
  if(!steering.resolved||steering.steeringDistance<4096||!Number.isInteger(before.speedMode)||before.speedMode<0||before.speedMode>3)return unknown('state2 entry geometry/speed branch unresolved',{minimumATConsumed:1,retryFromOriginal:true});
  const speed=[0,154,230,450][before.speedMode],nextState={...structuredClone(before),state:2,previousState:1,stateTimer:0,currentNodeIndex:movement.nextIndex,targetNodeId:target.id,targetXYZ,targetAngle:steering.targetAngle,movementByte:1,previousMovementByte:0,speed,targetSpeed:speed,routeFlags:before.routeFlags|64,actorFlags:(before.actorFlags|128)>>>0,delayWord:before.delayWord&32767,currentSeed:movement.nextSeed};
  for(const key of ['animationFlags','animationTransition','animationFrame','animationResource'])delete nextState[key];
  return {resolved:true,scope:'02077d10 routeMode1 armed target selection plus02077ef8 state2 entry',nextState,atConsumed:1,nextATSeed:movement.nextSeed,random:movement.random,eligibleNodeIndices:movement.eligibleIndices,steering,fullMonsterStepResolved:false,animationFieldsResolved:false,inputUnchanged:true,remaining:['generic base callback and detection before handler','animation-only state fields outside output contract','global scheduling and other consumers']};
 }
 kinematicPrefix(before,clock,{reached=false}={}){
  const unresolved=reason=>({resolved:false,reason,fullMonsterStepResolved:false,atDeltaKnownForWholeTick:false,inputUnchanged:true});
  if(reached!==true)return unresolved('02033248 entry reachability unknown');
  if(!xyz(before?.xyz)||!fields.every(k=>i32(before[k]))||!u32(clock?.phase)||!u32(clock?.scaledDelta))return unresolved('complete dense pre-entry numeric state and clock required');
  if(!['targetAngle','turnRate','speed','targetSpeed','acceleration','gravity'].every(k=>i16(before[k]))||!['movementByte','e0','c1','c2'].every(k=>byte(before[k]))||before.header<0||before.header>65535||before.delayWord<0||before.delayWord>65535)return unresolved('native field width mismatch');
  const input=new Int32Array(this.e.memory.buffer,this.e.monster_motion_input(),24);input.fill(0);input.set([...before.xyz,...fields.map(k=>before[k])]);
  if(this.e.monster_motion_prefix(clock.phase,clock.scaledDelta)!==1)return unresolved('unsupported special motion/vertical/angle-completion dependency');
  const out=new Int32Array(this.e.memory.buffer,this.e.monster_motion_output(),24),kinematic={...before,xyz:Array.from(out.slice(0,3))};fields.forEach((k,i)=>kinematic[k]=out[i+3]);
  return {resolved:true,scope:'02033248 orientation then02032fc4 speed/XYZ only',kinematic,atConsumedInPrefix:0,fullMonsterStepResolved:false,atDeltaKnownForWholeTick:false,inputUnchanged:true,remaining:['post-prefix correction/graph/animation fields','02079fa0 detection and state dispatcher','terrain and arrival transitions','other actors and global consumer order']};
 }
}
