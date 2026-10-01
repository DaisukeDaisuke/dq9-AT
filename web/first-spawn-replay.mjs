// Browser composition of existing guarded source models. Optional continuation
// carries only internally created actors under explicit phase/runtime inputs.
import {decodeEncounterStream} from './encounter-distribution.mjs';
import {mineCreatorResources,bindCreatorResources} from './monster-creation-resources.mjs';
import {FieldScheduler} from './field-scheduler.mjs';
import {queryPreferredFieldNode,preferredNodeTrigFromRom} from './field-preferred-node.mjs';
import {evaluateFieldSpawnPoint} from './field-spawn-point.mjs';
import {deriveNaturalFreeSlot,describeInventorySlot} from './field-inventory.mjs';
import {projectMonsterCreation} from './monster-creation.mjs';
import {monsterCol2FromRom} from './monster-terrain.mjs';
import {stepNewbornState0} from './monster-newborn.mjs';
import {projectMonsterOuterReset} from './monster-lifecycle.mjs';

export const FIRST_SPAWN_RUNTIME_SCHEMA='dq9-first-spawn-runtime-v1';
export const FIRST_SPAWN_TRAJECTORY_SCHEMA='dq9-pre-spawn-trajectory-v1';
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const i32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const xyz=a=>dense(a)&&a.length===3&&a.every(i32);
const check=(ok,message)=>{if(!ok)throw Error(message);};
const copy=x=>structuredClone(x);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(x,k));
// A creator can safely project one birth while modifying a descriptor needed
// only by a later birth. Multi-actor continuation requires those known future
// reads to be disjoint from reset/visual/counter writes too.
function futureCreatorInputsRemainStable(context,field,parties,creation){
 const range=(start,size)=>{check(uint(start)&&Number.isInteger(size)&&size>0&&start+size<=0x100000000,'future creator metadata range is unknown');return {start,size};};
 const overlap=(a,b)=>a.start<b.start+b.size&&b.start<a.start+a.size;
 const deps=[];
 for(const r of field.resources.models.entries)deps.push(range(r.pointer,20));
 for(const r of field.resources.ai.records)deps.push(range(r.pointer,20));
 for(const t of context.templates){if(!t?.pointer)continue;const v=t.visualContext,l=v?.layout;check(v?.complete===true&&dense(v.components)&&l&&uint(l.geometryCount,255)&&uint(l.entryOffset,65535),'future template layout is unknown');deps.push(range(t.pointer,0xb0),range(t.modelPointer+0x54,4),range(l.geometryPointer,32),range(l.materialBlockPointer,8+l.entryOffset+4*l.geometryCount));for(const c of v.components)deps.push(range(c.pointer,44));}
 for(const p of parties)if(p.pointer)deps.push(range(p.pointer,0x198));
 const fields=context.fields.slice(0,field.index+1).map(f=>range(f.pointer,0x314));
 const pool=context.inventory.slots.find(s=>s.slot===creation.actor.registryIndex),reset=range(pool.pointer,0x198);
 const counterWrites=[range(field.pointer+6,2),range(0x021d7a94,2)];
 if([reset,...creation.animationBinding.visualWriteRanges].some(w=>[...deps,...fields].some(r=>overlap(w,r))))return false;
 if(counterWrites.some(w=>deps.some(r=>overlap(w,r))))return false;
 return !fields.slice(0,-1).some(r=>counterWrites.some(w=>overlap(w,r)));
}

export function validateSpawnTrajectory(input,mapId,graph,continueNewborn=false){
 const composed=input?.schema==='dq9-pre-spawn-trajectory-v2';
 check(exact(input,['schema','phase','mapId','steps'])&&(composed?input.phase==='pre-spawn-and-post-hero-effective':input.schema===FIRST_SPAWN_TRAJECTORY_SCHEMA&&input.phase==='pre-spawn-effective')&&input.mapId===mapId,'同じmapの明示的なpre-spawn軌跡が必要です');
 check(!continueNewborn||composed,'生成後の更新にはpost-hero poseとactor clockの明示が必要です');
 check(dense(input.steps)&&input.steps.length>0&&input.steps.length<=2000,'軌跡は連続した1..2000段階が必要です');
 return input.steps.map((s,index)=>{
  check(exact(s,['index','sourceFrame','delta','timeValue','hero',...(composed?['postHero','actorClock']:[])])&&s.index===index&&(s.sourceFrame===null||uint(s.sourceFrame))&&uint(s.delta,50)&&uint(s.timeValue),'段階index・delta0..50・timeValue・任意sourceFrameが必要です');
  check(exact(s.hero,['xyz','angle','nodeIndex','graphEnabled'])&&xyz(s.hero.xyz)&&Number.isInteger(s.hero.angle)&&s.hero.angle>=-32768&&s.hero.angle<=32767&&uint(s.hero.nodeIndex,255)&&!!graph.nodes[s.hero.nodeIndex]&&s.hero.graphEnabled===true,'各段階のXYZ・signed16実向き・現在node・graphEnabledが必要です');
  if(composed){check(exact(s.postHero,['xyz','angle','nodeIndex','graphEnabled'])&&xyz(s.postHero.xyz)&&Number.isInteger(s.postHero.angle)&&s.postHero.angle>=-32768&&s.postHero.angle<=32767&&uint(s.postHero.nodeIndex,255)&&!!graph.nodes[s.postHero.nodeIndex]&&s.postHero.graphEnabled===true,'post-hero poseをpre-spawn poseで代用できません');check(exact(s.actorClock,['phase','scaledDelta'])&&uint(s.actorClock.phase,65535)&&uint(s.actorClock.scaledDelta,50),'body clock phase/scaledDeltaが必要です');}
  return copy(s);
 });
}

/** Runtime facts cannot be mined from map/seed alone. They are a separate local
 * primitive input, declared stable within this conditional replay. */
export function createFirstSpawnReplay({project,rom,kernel,fieldKernel,atKernel,runtime,trajectory,seed,continueNewborn=false}){
 check(uint(seed),'開始seedはu32が必要です');
 const composed=runtime?.schema==='dq9-first-spawn-runtime-v2';
 check(exact(runtime,['schema','mapId','fieldIndex','initialTimer','selectedHeroSlot','conditions','parties','runtimeNodeFlags','creatorContext',...(composed?['continuation']:[])])&&(composed||runtime.schema===FIRST_SPAWN_RUNTIME_SCHEMA)&&runtime.mapId===7402,'7402の初期runtime primitive packetが必要です');
 check(typeof continueNewborn==='boolean'&&(!continueNewborn||(composed&&runtime.continuation?.phaseOrder==='spawn-hero-body-lifetime-walking'&&runtime.continuation.environmentStable===true&&runtime.continuation.environment)),'生成後はphase順・環境runtimeの明示が必要です');
 const conditions=runtime.conditions;
 check(exact(conditions,['active','storyAllowed','soleEligibleMember','noExternalAT','stableContext'])&&Object.values(conditions).every(x=>x===true),'active/story・単一eligible member・外部ATなし・固定runtime条件の明示が必要です');
 check(uint(runtime.fieldIndex,3)&&uint(runtime.initialTimer)&&uint(runtime.selectedHeroSlot,3),'field・timer・選択partyが不明です');
 const matches=project.records.filter(r=>r.mapId===runtime.mapId);check(matches.length===1,'ROM map bindingが一意ではありません');
 const record=matches[0],graph=project.fieldGraphs.graphs.find(g=>g.key===record.fieldGraph?.key);check(graph?.nodes?.length>0&&graph.nodes.length<=255,'ROM静的graphが必要です');
 const steps=validateSpawnTrajectory(trajectory,runtime.mapId,graph,continueNewborn);
 check(dense(runtime.runtimeNodeFlags)&&runtime.runtimeNodeFlags.length===graph.nodes.length&&runtime.runtimeNodeFlags.every(n=>uint(n)),'全nodeのruntime flagsが必要です');
 const parties=copy(runtime.parties);check(dense(parties)&&parties.length===4&&parties.every((p,i)=>p&&p.slot===i&&p.registryKnown===true&&uint(p.pointer)),'party0..3のregistry状態が必要です');
 const hero=parties[runtime.selectedHeroSlot];check(hero.pointer>0&&uint(hero.headerFlags,65535)&&(hero.headerFlags&0x200)!==0&&hero.mapId===runtime.mapId&&hero.alternateMap===0xffffffff,'選択heroの同map・typed/effective位置条件が必要です');
 check(parties.every((p,i)=>i===runtime.selectedHeroSlot||p.pointer===0),'このsliceは選択hero以外のparty不在のみ対応しています');
 const context=copy(runtime.creatorContext);check(context&&context.creatorReached===true&&context.globalWord===0&&context.managerMapId===runtime.mapId,'通常creator/runtime条件が不明です');
 // Graph/resources come only from this locally loaded ROM, not packet arrays.
 check(!Object.hasOwn(context,'graph')&&context.graphBindingVerified===true,'graphは投入ROMから取得します');
 check(dense(context.fields)&&context.fields.length===4&&context.fields.every((f,i)=>f&&f.index===i&&uint(f.mapId,65535)&&uint(f.flags,65535)),'4fieldの順序・map・flagsが必要です');
 const field=context.fields[runtime.fieldIndex];check(field.mapId===runtime.mapId&&context.fields.findIndex(f=>f.mapId===runtime.mapId)===runtime.fieldIndex,'最初に一致するfieldが必要です');
 // The ordinary source loader owns static model/AI values. Runtime allocation
 // counts/addresses/topology still have to match the selected ROM species.
 field.resources=bindCreatorResources(field.resources,field.pointer,mineCreatorResources(project.nitro,runtime.mapId));
 const group=field.flags&3,inventory=context.inventory;
 check(dense(inventory?.slots)&&inventory.slots.length===48&&inventory.slots.every((s,i)=>s&&s.slot===112+i),'48slotの初期registry順序が必要です');
 for(let slot=112+group*12;slot<124+group*12;slot++){
  const d=describeInventorySlot(inventory.slots[slot-112]);
  check(d.allocated===true&&d.allocatorFree===true&&d.active===false,'自然生成groupは既知の登録済み・未使用12objectが必要です（null slotは空きobjectではありません）');
 }
 if(continueNewborn){const pointers=[];for(const slot of inventory.slots){const d=describeInventorySlot(slot);check(d.allocated!==null&&(d.allocated===false||(d.allocatorFree===true&&d.active===false)),'継続の初期状態には他の自然actor不在が必要です');if(d.allocated)pointers.push(d.pointer);}check(new Set(pointers).size===pointers.length,'registry別slotの同一object aliasは継続区間で未対応です');}
 const decoded=decodeEncounterStream(new Uint8Array(project.nitro.readFile('data/prm/encfld.bin'))),groups=decoded.groups.filter(g=>g.mapId===runtime.mapId);
 check(groups.length===1&&groups[0].conditions.every(n=>n===0),'ROMのmap/table runtime条件は未対応です');
 const rows=[],distributions={},romTableRows=[];
 for(const id of groups[0].tableIds){
  const t=decoded.tables.find(t=>t.tableId===id);check(t&&t.totalWeight>0&&t.rows.every(r=>(r.packedRaw&0x8000)===0&&!r.isTrapSpecies),'special/trap/空tableは未対応です');
  rows.push({tableId:id,flags:t.flagsRaw});distributions[id]={maxRand:t.totalWeight,data:t.rows.map(r=>({monsterId:r.speciesId,start:r.start,end:r.end}))};
  // The reached7402 resource has unit scales. Its native opcode103 conversion
  // produces4096; other scale/constructor cases stay outside this small slice.
  check(t.rows.every(r=>r.scaleArgument.type===1&&r.scaleArgument.value===1),'ROM tableのinteger unit scale以外は未対応です');
  const mined={id,declaredCount:t.rows.length,items:t.rows.map(r=>({speciesWord:r.packedRaw,scale:4096}))};romTableRows.push(mined);
  if(field.tables!==undefined){const bound=field.tables?.rows?.find(r=>r.id===id);check(bound&&bound.declaredCount===mined.declaredCount&&dense(bound.items)&&bound.items.length===mined.items.length&&bound.items.every((r,i)=>r.speciesWord===mined.items[i].speciesWord&&r.scale===mined.items[i].scale),'creatorのtable項目とROM数値が一致しません');}
 }
 if(field.tables!==undefined)check(field.tables?.containerPointer===field.pointer+0x5c&&field.tables?.declaredCount===rows.length&&field.tables.rows.length===rows.length,'creatorのtable一覧/bindingとROMが一致しません');
 check(uint(field.pointer)&&field.pointer+0x314<=0x100000000,'field pointer範囲が不明です');
 field.tables={containerPointer:field.pointer+0x5c,declaredCount:romTableRows.length,rows:romTableRows};
 const terrain=context.terrain;check(terrain&&terrain.mapId===runtime.mapId&&dense(terrain.objects)&&terrain.objects.length<=16,'terrain binding/object一覧が必要です');
 for(const object of terrain.objects){
  check(object&&!Object.hasOwn(object,'resource')&&object.resourceBinding?.archivePath===`data/map/${record.fieldCode}.amdj`,'地形は同mapのROM resource bindingのみ使用します');
  object.resource=monsterCol2FromRom(rom,object.resourceBinding);
 }
 context.graph=graph;
 if(continueNewborn){const env=runtime.continuation.environment;check(env.managerMapId===runtime.mapId&&env.selectedHero?.pointer===hero.pointer&&env.selectedHero?.mapId===runtime.mapId&&!Object.hasOwn(env,'identity')&&!Object.hasOwn(env,'typedMonsterLookup')&&!Object.hasOwn(env,'terrain'),'walking環境と選択hero/ROM terrainを混同できません');}
 return new FirstSpawnReplay({kernel,fieldKernel,atKernel,trig:preferredNodeTrigFromRom(rom),context,parties,hero,graph,steps,rows,distributions,field,group,seed,timer:runtime.initialTimer,runtimeNodeFlags:copy(runtime.runtimeNodeFlags),continueNewborn,environment:continueNewborn?copy(runtime.continuation.environment):null});
}

export class FirstSpawnReplay{
 constructor(input){Object.assign(this,input);this.scheduler=new FieldScheduler(input.fieldKernel);this.context=copy(input.context);this.parties=copy(input.parties);this.hero=this.parties[input.hero.slot];this.field=this.context.fields[input.field.index];this.seed=input.seed;this.timer=input.timer;this.consumed=0;this.events=[];this.heroTrace=[];this.actors=new Map();this.actorTrace=[];this.actor=null;this.birth=null;this.births=[];this.generationCount=0;this.stopped=false;this.status='ready';this.reason='';}
 advance(){
  if(this.stopped)return false;
  const next=this.advanceSpawn();
  if(!this.continueNewborn||(!next&&this.status!=='created')||!this.creation)return next;
  const row=this.events.at(-1),sample=this.steps[row.index];this.stopped=false;row.bodies=[];row.environments=[];row.phaseOrder=['spawn'];
  const stop=(reason,status='unresolved')=>{this.refreshPrimary();this.status=status;this.reason=reason;this.stopped=true;Object.assign(row,{status,reason,seed:this.seed,invocationResolved:false});return false;};
  try{
   if(this.pendingCreation){this.addCreatedActor(this.pendingCreation,row.index);this.pendingCreation=null;}
   Object.assign(this.hero,{xyz:[...sample.postHero.xyz],angle:sample.postHero.angle,nodeIndex:sample.postHero.nodeIndex});
   // Native group order: every body/lifetime pair first, then the separate
   // environment traversal. Walking actor1 before body2 would change inputs.
   for(const slot of this.context.inventory.slots.filter(s=>s.slot>=112+12*this.group&&s.slot<124+12*this.group)){
    if(!slot.pointer||!(slot.headerFlags&32)||(slot.actorFlags&1))continue;
    const e=this.actors.get(slot.slot);check(e,'active natural actor has no derived generation');
    const a=e.actor,binding=e.creation.animationBinding;a.currentSeed=this.seed;
    const ctx={tickReached:true,globalWord:this.context.globalWord,managerMapId:this.field.mapId,clock:sample.actorClock,visualBindingValidated:e.creation.creationProjectionResolved,animationComponents:{complete:true,headPointer:binding.componentListPointer,records:binding.records},derivedCreationProof:e.creation,parties:this.parties,fieldPresent:true,fieldMapId:this.field.mapId,fieldFlags:this.field.flags,tableBindingVerified:true,graphBindingVerified:true,graph:this.graph,inventory:this.context.inventory,tableRows:this.rows,terrain:this.context.terrain};
    row.phaseOrder.push(`body:${slot.slot}`);
    const body=a.state===0?stepNewbornState0(this.kernel,a,ctx):this.kernel.step(a,ctx,this.fieldKernel);
    if(!body.resolved){const n=body.minimumATConsumed;if(Number.isInteger(n)&&n>0){this.seed=this.atKernel.seedAt(this.seed,BigInt(n));this.consumed+=n;row.consumed+=n;row.seed=this.seed;const prefix={slot:slot.slot,resolved:false,knownATPrefix:n};row.bodies.push(prefix);if(slot.slot===this.birth.slot)row.body=prefix;}return stop(`slot${slot.slot}: ${body.reason}`);}
    e.actor=body.nextState;e.phase={index:row.index,phase:'body'};this.seed=body.nextATSeed;this.consumed+=body.atConsumed;row.consumed+=body.atConsumed;
    const b={slot:slot.slot,xyz:[...e.actor.xyz],state:e.actor.state,timer:e.actor.stateTimer,counter:e.actor.updateCounter,atConsumed:body.atConsumed};row.bodies.push(b);if(slot.slot===this.birth.slot)row.body=b;this.syncActor(e);
    row.phaseOrder.push(`lifetime:${slot.slot}`);
    const life=projectMonsterOuterReset(e.actor,{afterTickReached:true,globalWord:this.context.globalWord,fieldGroupFlags:this.field.flags,groupIndex:this.group,managerMapId:this.field.mapId,identity:e.identity,typedMonsterLookup:{known:true,...e.identity},parties:this.parties});
    if(!life.resolved)return stop(`slot${slot.slot}: ${life.reason}`);b.lifetime=life.outcome;if(slot.slot===this.birth.slot)row.lifetime=life.outcome;
    if(life.outcome!=='retain')return stop(`slot${slot.slot}: 寿命終了。最後の位置で停止します`,'reset');
   }
   for(const slot of this.context.inventory.slots){
    if(!slot.pointer||!(slot.headerFlags&32)||(slot.monsterIdRaw&0x8000))continue;
    const e=this.actors.get(slot.slot);check(e,'environment actor has no derived generation');row.phaseOrder.push(`walking:${slot.slot}`);
    const ground=this.kernel.walkingPass(e.actor,{...this.environment,identity:e.identity,typedMonsterLookup:{known:true,...e.identity},terrain:this.context.terrain});
    if(!ground.resolved)return stop(`slot${slot.slot}: ${ground.reason}`);
    check(ground.atConsumed===0,'walkingの追加AT消費は未対応です');e.actor=ground.nextState;e.phase={index:row.index,phase:'walking'};this.syncActor(e);e.trace.push([...e.actor.xyz]);
    const g={slot:slot.slot,xyz:[...e.actor.xyz],e0:e.actor.e0,atConsumed:0};row.environments.push(g);if(slot.slot===this.birth.slot)row.environment=g;
   }
   this.refreshPrimary();row.actor={xyz:[...this.actor.xyz],state:this.actor.state,timer:this.actor.stateTimer,counter:this.actor.updateCounter};row.seed=this.seed;
   this.status='running';this.reason=`派生actor${this.actors.size}体のbody→寿命、全体の接地を計算`;Object.assign(row,{status:this.status,reason:this.reason});return true;
  }catch(error){return stop(error.message);}
 }
 addCreatedActor(creation,index){
  const a=creation.actor,slot=this.context.inventory.slots.find(s=>s.slot===a.registryIndex);check(uint(slot?.e0Byte,255),'pre-reset raw e0 byteが不明です');check(!this.actors.has(a.registryIndex),'既存generationの置換は未対応です');
  const actor={...copy(a),e0:slot.e0Byte&0xc0,c1:0,c2:0,cooldownByte:0,delayWord:0,correctionSpeed:0,gravity:0,turnRate:804,targetSpeed:450,acceleration:40,verticalVelocity:0,verticalLimit:0,verticalCounter:0,currentSeed:this.seed,routeMode:a.ai138to13c[0],speedMode:a.ai138to13c[1],detectionMode:a.ai138to13c[2],alertFlag:0,blockFlag:0,field17a:0,targetXYZ:[0,0,0],selectedComponentFamily:['null','bound-type1']};
  const e={actor,creation,identity:{slot:a.registryIndex,pointer:slot.pointer,generationId:`derived-birth:${++this.generationCount}`},trace:[[...a.xyz]],phase:{index,phase:'creation'}};this.actors.set(a.registryIndex,e);
  this.field.creationCounter=creation.fieldCreationCounterAfter;this.context.serialContext.counter=creation.serialCounterAfter;const serial=this.context.serialContext.slots.find(s=>s.slot===a.registryIndex);serial.serial=a.serial;serial.rawHeader=a.header;this.syncActor(e);this.refreshPrimary();
 }
 refreshPrimary(){const e=this.actors.get(this.birth?.slot);if(e){this.actor=e.actor;this.actorPhase=e.phase;this.actorTrace=e.trace;this.identity=e.identity;}}
 syncActor(e){const a=e.actor,s=this.context.inventory.slots.find(s=>s.slot===a.registryIndex);Object.assign(s,{headerFlags:a.header,monsterIdRaw:a.species,nativeSlot:a.registryIndex,mapId:a.mapId,actorFlags:a.actorFlags,nativeSerial:a.serial,tableId:a.tableId,nodeIndex:a.currentNodeIndex,xyz:[...a.xyz],e0Byte:a.e0,generationId:e.identity.generationId});}
 advanceSpawn(){
  if(this.stopped)return false;
  const sample=this.steps[this.events.length];
  if(!sample){this.stopped=true;this.status='trajectory-ended';this.reason='軌跡終端。以降の入力・AT消費は不明です';return false;}
  Object.assign(this.hero,{xyz:[...sample.hero.xyz],angle:sample.hero.angle,nodeIndex:sample.hero.nodeIndex});
  const original={seed:this.seed,position:'0',timer:this.timer},input={active:true,storyAllowed:true,delta:sample.delta,rows:this.rows,timeValue:sample.timeValue};
  const row={index:sample.index,sourceFrame:sample.sourceFrame,heroXYZ:[...this.hero.xyz],seed:this.seed,consumed:0,timer:this.timer,selectedNodeId:null,candidateXYZ:null,monsterId:null,tableId:null,birth:null,reason:''};
  let result,creation;
  const finish=(status,reason)=>{const n=result?.consumed??0;this.seed=this.atKernel.seedAt(original.seed,BigInt(n));this.consumed+=n;this.timer=result?.timer??original.timer;Object.assign(row,{seed:this.seed,consumed:n,timer:this.timer,reason,status,invocationResolved:status!=='unresolved'});this.events.push(row);this.heroTrace.push([...row.heroXYZ]);this.status=status;this.reason=reason;this.stopped=status!=='running';return !this.stopped;};
  try{
   const allocation=deriveNaturalFreeSlot(this.context.inventory,{group:this.group});
   if(!allocation.resolved)return finish('unresolved',allocation.reason||'allocator不明');
   input.freeSlot=allocation.freeSlot;
   // Obtain the selected node using the original seed/timer. Refinements below
   // rerun this immutable invocation; none commits its draws twice.
   if(this.fieldKernel.e.field_spawn_timer(original.timer,sample.delta)>=1000&&allocation.freeSlot>=0){
    const near=[];for(const s of this.context.inventory.slots.filter(s=>s.slot>=112+12*this.group&&s.slot<124+12*this.group)){const d=describeInventorySlot(s);check(d.allocated!==null&&d.active!==null,'member proximity inventory is unknown');if(!d.allocated||!d.active)continue;check(xyz(d.xyz),'active actor XYZ is unknown');if(d.xyz.every((v,i)=>v>=((this.hero.xyz[i]-[61440,2048,61440][i])|0)&&v<=((this.hero.xyz[i]+[61440,6144,61440][i])|0)))near.push(s.slot);}
    row.nearbyActorSlots=near;
    if(near.length>=3)input.attempts=[{memberId:-1}];
    else{
    const query=queryPreferredFieldNode({queryReached:true,player:{position:this.hero.xyz,angle:this.hero.angle,nodeIndex:this.hero.nodeIndex,graphEnabled:sample.hero.graphEnabled},graph:this.graph,inventory:this.context.inventory,fieldFlags:this.field.flags,trig:this.trig});
    if(!query.resolved)return finish('unresolved',query.reason);
    input.attempts=[{memberId:this.hero.slot,direction:{nodeIds:query.nodeIds,dots:query.dots}},{memberId:-1}];
    result=this.scheduler.step(original,input,this.distributions);
    if(!result.resolved&&result.reason==='spawn position/collision/area/time unknown'){
     row.selectedNodeId=result.nodeId;
     const geometry=evaluateFieldSpawnPoint({pointQueryReached:true,graph:this.graph,selectedNodeId:result.nodeId,currentNodeIndex:this.hero.nodeIndex,playerPosition:this.hero.xyz,fieldMapId:this.field.mapId,fieldFlags:this.field.flags,parties:{slots:this.parties.map(p=>({...p,effectivePositionResolved:p.pointer?true:undefined,effectivePosition:p.xyz}))},inventory:this.context.inventory,runtimeNodeFlags:this.runtimeNodeFlags});
     if(!geometry.resolved)return finish('unresolved',geometry.reason);
     row.candidateXYZ=geometry.point?[...geometry.point]:null;
     Object.assign(input.attempts[0],{geometryEligible:geometry.geometryEligible,areaMask:geometry.areaMask});
    }
    }
   }
   result=this.scheduler.step(original,input,this.distributions);
   row.monsterId=result.monsterId??null;row.tableId=result.tableId??null;
   if(!result.resolved&&result.reason==='creation-result-unknown'){
    const context={...this.context,heroXYZ:[...this.hero.xyz]};
    creation=projectMonsterCreation({mapId:this.field.mapId,species:result.monsterId,tableId:result.tableId,nodeId:row.selectedNodeId,candidateXYZ:row.candidateXYZ,routeFlags:0},context,this.kernel);
    if(!creation.resolved)return finish('unresolved',creation.reason);
    if(this.continueNewborn&&creation.created&&!futureCreatorInputsRemainStable(this.context,this.field,this.parties,creation))return finish('unresolved','creator writes alias a later runtime dependency; continuation cannot keep stale primitives');
    if(creation.atConsumed!==0)return finish('unresolved','creatorの追加AT消費は未対応です');
    const prefix=result;result=this.scheduler.step(original,{...input,creationResult:creation.result},this.distributions);
    check(result.resolved&&result.consumed===prefix.consumed&&JSON.stringify(result.events)===JSON.stringify(prefix.events),'original-state refinement changed AT events');
    if(creation.created){this.creation??=creation;this.pendingCreation=creation;row.birth={xyz:[...creation.actor.xyz],species:creation.actor.species,slot:creation.actor.registryIndex,serial:creation.actor.serial};this.birth??=row.birth;this.births.push({...copy(row.birth),index:row.index});return finish('created','生成を計算。追加更新は明示した継続条件のみ適用します');}
    return finish('rejected',`creatorが0を返す条件付き生成失敗で停止: ${creation.reason}`);
   }
   return finish(result.resolved?'running':'unresolved',result.reason);
  }catch(error){return finish('unresolved',error.message);}
 }
}
