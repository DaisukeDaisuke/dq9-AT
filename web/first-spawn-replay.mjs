// Browser composition of existing guarded source models. It ends at the first
// creator call; no post-birth actor, hidden world, input or seed is invented.
import {decodeEncounterStream} from './encounter-distribution.mjs';
import {FieldScheduler} from './field-scheduler.mjs';
import {queryPreferredFieldNode,preferredNodeTrigFromRom} from './field-preferred-node.mjs';
import {evaluateFieldSpawnPoint} from './field-spawn-point.mjs';
import {deriveNaturalFreeSlot,describeInventorySlot} from './field-inventory.mjs';
import {projectMonsterCreation} from './monster-creation.mjs';
import {monsterCol2FromRom} from './monster-terrain.mjs';

export const FIRST_SPAWN_RUNTIME_SCHEMA='dq9-first-spawn-runtime-v1';
export const FIRST_SPAWN_TRAJECTORY_SCHEMA='dq9-pre-spawn-trajectory-v1';
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const i32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const xyz=a=>dense(a)&&a.length===3&&a.every(i32);
const check=(ok,message)=>{if(!ok)throw Error(message);};
const copy=x=>structuredClone(x);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(x,k));

export function validateSpawnTrajectory(input,mapId,graph){
 check(exact(input,['schema','phase','mapId','steps'])&&input.schema===FIRST_SPAWN_TRAJECTORY_SCHEMA&&input.phase==='pre-spawn-effective'&&input.mapId===mapId,'同じmapの明示的なpre-spawn-effective軌跡が必要です');
 check(dense(input.steps)&&input.steps.length>0&&input.steps.length<=2000,'軌跡は連続した1..2000段階が必要です');
 return input.steps.map((s,index)=>{
  check(exact(s,['index','sourceFrame','delta','timeValue','hero'])&&s.index===index&&(s.sourceFrame===null||uint(s.sourceFrame))&&uint(s.delta,50)&&uint(s.timeValue),'段階index・delta0..50・timeValue・任意sourceFrameが必要です');
  check(exact(s.hero,['xyz','angle','nodeIndex','graphEnabled'])&&xyz(s.hero.xyz)&&Number.isInteger(s.hero.angle)&&s.hero.angle>=-32768&&s.hero.angle<=32767&&uint(s.hero.nodeIndex,255)&&!!graph.nodes[s.hero.nodeIndex]&&s.hero.graphEnabled===true,'各段階のXYZ・signed16実向き・現在node・graphEnabledが必要です');
  return copy(s);
 });
}

/** Runtime facts cannot be mined from map/seed alone. They are a separate local
 * primitive input, declared valid until this first-creation boundary. */
export function createFirstSpawnReplay({project,rom,kernel,fieldKernel,atKernel,runtime,trajectory,seed}){
 check(uint(seed),'開始seedはu32が必要です');
 check(exact(runtime,['schema','mapId','fieldIndex','initialTimer','selectedHeroSlot','conditions','parties','runtimeNodeFlags','creatorContext'])&&runtime.schema===FIRST_SPAWN_RUNTIME_SCHEMA&&runtime.mapId===7402,'7402の初期runtime primitive packetが必要です');
 const conditions=runtime.conditions;
 check(exact(conditions,['active','storyAllowed','soleEligibleMember','noExternalAT','stableContext'])&&Object.values(conditions).every(x=>x===true),'active/story・単一eligible member・外部ATなし・固定runtime条件の明示が必要です');
 check(uint(runtime.fieldIndex,3)&&uint(runtime.initialTimer)&&uint(runtime.selectedHeroSlot,3),'field・timer・選択partyが不明です');
 const matches=project.records.filter(r=>r.mapId===runtime.mapId);check(matches.length===1,'ROM map bindingが一意ではありません');
 const record=matches[0],graph=project.fieldGraphs.graphs.find(g=>g.key===record.fieldGraph?.key);check(graph?.nodes?.length>0&&graph.nodes.length<=255,'ROM静的graphが必要です');
 const steps=validateSpawnTrajectory(trajectory,runtime.mapId,graph);
 check(dense(runtime.runtimeNodeFlags)&&runtime.runtimeNodeFlags.length===graph.nodes.length&&runtime.runtimeNodeFlags.every(n=>uint(n)),'全nodeのruntime flagsが必要です');
 const parties=copy(runtime.parties);check(dense(parties)&&parties.length===4&&parties.every((p,i)=>p&&p.slot===i&&p.registryKnown===true&&uint(p.pointer)),'party0..3のregistry状態が必要です');
 const hero=parties[runtime.selectedHeroSlot];check(hero.pointer>0&&uint(hero.headerFlags,65535)&&(hero.headerFlags&0x200)!==0&&hero.mapId===runtime.mapId&&hero.alternateMap===0xffffffff,'選択heroの同map・typed/effective位置条件が必要です');
 check(parties.every((p,i)=>i===runtime.selectedHeroSlot||p.pointer===0),'このsliceは選択hero以外のparty不在のみ対応しています');
 const context=copy(runtime.creatorContext);check(context&&context.creatorReached===true&&context.globalWord===0&&context.managerMapId===runtime.mapId,'通常creator/runtime条件が不明です');
 // Graph/resources come only from this locally loaded ROM, not packet arrays.
 check(!Object.hasOwn(context,'graph')&&context.graphBindingVerified===true,'graphは投入ROMから取得します');
 check(dense(context.fields)&&context.fields.length===4&&context.fields.every((f,i)=>f&&f.index===i&&uint(f.mapId,65535)&&uint(f.flags,65535)),'4fieldの順序・map・flagsが必要です');
 const field=context.fields[runtime.fieldIndex];check(field.mapId===runtime.mapId&&context.fields.findIndex(f=>f.mapId===runtime.mapId)===runtime.fieldIndex,'最初に一致するfieldが必要です');
 const group=field.flags&3,inventory=context.inventory;
 check(dense(inventory?.slots)&&inventory.slots.length===48&&inventory.slots.every((s,i)=>s&&s.slot===112+i),'48slotの初期registry順序が必要です');
 for(let slot=112+group*12;slot<124+group*12;slot++){
  const d=describeInventorySlot(inventory.slots[slot-112]);
  check(d.allocated===true&&d.allocatorFree===true&&d.active===false,'自然生成groupは既知の登録済み・未使用12objectが必要です（null slotは空きobjectではありません）');
 }
 const decoded=decodeEncounterStream(new Uint8Array(project.nitro.readFile('data/prm/encfld.bin'))),groups=decoded.groups.filter(g=>g.mapId===runtime.mapId);
 check(groups.length===1&&groups[0].conditions.every(n=>n===0),'ROMのmap/table runtime条件は未対応です');
 const rows=[],distributions={};
 for(const id of groups[0].tableIds){
  const t=decoded.tables.find(t=>t.tableId===id);check(t&&t.totalWeight>0&&t.rows.every(r=>(r.packedRaw&0x8000)===0&&!r.isTrapSpecies),'special/trap/空tableは未対応です');
  rows.push({tableId:id,flags:t.flagsRaw});distributions[id]={maxRand:t.totalWeight,data:t.rows.map(r=>({monsterId:r.speciesId,start:r.start,end:r.end}))};
  const bound=field.tables?.rows?.find(r=>r.id===id);
  check(bound&&bound.declaredCount===t.rows.length&&dense(bound.items)&&bound.items.length===t.rows.length&&bound.items.every((r,i)=>r.speciesWord===t.rows[i].packedRaw&&Number.isFinite(t.rows[i].scaleArgument.value)&&r.scale===Math.trunc(t.rows[i].scaleArgument.value*4096)),'creatorのtable項目とROM数値が一致しません');
 }
 check(field.tables?.declaredCount===rows.length&&field.tables.rows.length===rows.length,'creatorのtable一覧とROMが一致しません');
 const terrain=context.terrain;check(terrain&&terrain.mapId===runtime.mapId&&dense(terrain.objects)&&terrain.objects.length<=16,'terrain binding/object一覧が必要です');
 for(const object of terrain.objects){
  check(object&&!Object.hasOwn(object,'resource')&&object.resourceBinding?.archivePath===`data/map/${record.fieldCode}.amdj`,'地形は同mapのROM resource bindingのみ使用します');
  object.resource=monsterCol2FromRom(rom,object.resourceBinding);
 }
 context.graph=graph;
 return new FirstSpawnReplay({kernel,fieldKernel,atKernel,trig:preferredNodeTrigFromRom(rom),context,parties,hero,graph,steps,rows,distributions,field,group,seed,timer:runtime.initialTimer,runtimeNodeFlags:copy(runtime.runtimeNodeFlags)});
}

export class FirstSpawnReplay{
 constructor(input){Object.assign(this,input);this.scheduler=new FieldScheduler(input.fieldKernel);this.context=copy(input.context);this.parties=copy(input.parties);this.hero=this.parties[input.hero.slot];this.field=this.context.fields[input.field.index];this.seed=input.seed;this.timer=input.timer;this.consumed=0;this.events=[];this.heroTrace=[];this.birth=null;this.stopped=false;this.status='ready';this.reason='';}
 advance(){
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
   result=this.scheduler.step(original,input,this.distributions);
   row.monsterId=result.monsterId??null;row.tableId=result.tableId??null;
   if(!result.resolved&&result.reason==='creation-result-unknown'){
    const context={...this.context,heroXYZ:[...this.hero.xyz]};
    creation=projectMonsterCreation({mapId:this.field.mapId,species:result.monsterId,tableId:result.tableId,nodeId:row.selectedNodeId,candidateXYZ:row.candidateXYZ,routeFlags:0},context,this.kernel);
    if(!creation.resolved)return finish('unresolved',creation.reason);
    if(creation.atConsumed!==0)return finish('unresolved','creatorの追加AT消費は未対応です');
    const prefix=result;result=this.scheduler.step(original,{...input,creationResult:creation.result},this.distributions);
    check(result.resolved&&result.consumed===prefix.consumed&&JSON.stringify(result.events)===JSON.stringify(prefix.events),'original-state refinement changed AT events');
    if(creation.created){this.birth=row.birth={xyz:[...creation.actor.xyz],species:creation.actor.species,slot:creation.actor.registryIndex,serial:creation.actor.serial};return finish('created','最初の生成を計算。生成後の移動・他consumerはこのsliceの対象外です');}
    return finish('rejected',`creatorが0を返す条件付き生成失敗で停止: ${creation.reason}`);
   }
   return finish(result.resolved?'running':'unresolved',result.reason);
  }catch(error){return finish('unresolved',error.message);}
 }
}
