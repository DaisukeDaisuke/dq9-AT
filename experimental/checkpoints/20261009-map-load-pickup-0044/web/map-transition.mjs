import {canCarryF06PoolStorage} from './f06-creator.mjs';
// Bounded ordinary shrine transitions, using ROM resources and explicit reached phases.
import {decodePickupRows,projectPickupMaterialization,conditionalPickupDrawCountDomain} from './pickup-materialization.mjs';
import {parseCalls,decodeMapRecords} from './vendor/call-stream.mjs';
import {readBoundedNarcMembers,decodeMapExitMember} from './map-exits.mjs';
// Isolated source projection. Does not simulate allocation, graphics, I/O timing,
// or the engine's entire loader. All unsupported or missing conditions suspend.
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const dense=a=>Array.isArray(a)&&Object.keys(a).filter(k=>/^(0|[1-9][0-9]*)$/.test(k)).length===a.length&&a.every(x=>x!==null&&x!==undefined);
const sourceArgs=c=>{if(!dense(c?.args)||!uint(c.argumentCount,255)||c.argumentCount!==c.args.length)throw Error('Incomplete or contradictory argument count');return c.args.map(a=>{if(!a||![0,1,2].includes(a.type)||!uint(a.raw))throw Error('Malformed source argument');return a.raw;});};
function deriveDescriptors(p){
 const q=p?.primitive,r=p?.resources,map=p?.binding?.mapId;
 if(!q||!r||!uint(map,65535)||!dense(q.story)||q.story.length!==3||!q.story.every(x=>uint(x,255))||!uint(q.networkWord)||!uint(q.quest185,3)||![89,90].every(i=>typeof q.eventFlags?.[i]==='boolean'))throw Error('Missing primitive context');
 if(!dense(q.generatedNpcMapRange)||q.generatedNpcMapRange.length!==2||!q.generatedNpcMapRange.every(x=>uint(x,65535))||q.generatedNpcMapRange[0]>q.generatedNpcMapRange[1])throw Error('Missing generated-NPC map gate');
 if(!dense(r.place?.calls)||!dense(r.npc?.calls))throw Error('Incomplete source call stream');
 // This source projection supports the reached non-generated-map branch.
 if(q.generatedNpcMapRange[0]<=map&&map<=q.generatedNpcMapRange[1])throw Error('Generated NPC path unresolved');
 const active=new Map(),audit=[];let ordinal=0;
 const addOrRemove=(mapId,id,hasPosition,call)=>{if(!uint(id,255)||!uint(mapId,65535))throw Error('Unsupported placement identity');
   const action=mapId===map&&hasPosition?'add':'remove';
   if(action==='add')active.set(id,{id,callIndex:call.index,callOrdinal:ordinal});else active.delete(id);
   audit.push({opcode:call.opcode,callIndex:call.index,id,action});};
 const networkPass=gate=>{if(!uint(gate,2))throw Error('Unsupported network gate');return gate===2||(gate===0?Boolean(q.networkWord):!q.networkWord);};
 const story=q.story[0]*1000+q.story[1]*10+q.story[2];
 for(const c of r.place.calls){const a=sourceArgs(c);let pass=false;
   const controlCount=({3:2,4:6,5:9,14:5,17:5})[c.opcode];
   if(controlCount&&c.args.slice(0,controlCount).some(arg=>arg.type!==1))throw Error('Noninteger placement control');
   if([3,4,5,14,17].includes(c.opcode))ordinal++;
   switch(c.opcode){
    case 3: if(![2,6,7].includes(a.length))throw Error('Incomplete place3 coordinate form');if(a[0]===map)addOrRemove(a[0],a[1],a.length>2,c);break;
    case 4: if(![6,10,11].includes(a.length))throw Error('Incomplete place4 coordinate form');pass=a[0]===q.story[0]&&a[1]===q.story[1]&&a[2]===q.story[2];if(pass&&networkPass(a[3]))addOrRemove(a[4],a[5],a.length>6,c);break;
    case 5: if(![9,13,14].includes(a.length)||!a.slice(0,6).every(x=>uint(x,255)))throw Error('Unsupported place5 bounds/coordinate form');pass=a[0]*1000+a[1]*10+a[2]<=story&&story<=a[3]*1000+a[4]*10+a[5];if(pass&&networkPass(a[6]))addOrRemove(a[7],a[8],a.length>9,c);break;
    case 14: // D04's three quest185 conditions all fail at pre-state0.
      if(![5,9,10].includes(a.length)||a[0]!==185||![0,2,3].includes(a[1])||q.quest185!==0)throw Error('Other quest placement branch unresolved');break;
    case 17: // D04 uses one simple event-flag condition, not an arbitrary expression.
      if(a.length!==9||(a[0]>>>16)!==1||![89,90].includes(a[0]&65535)||!uint(a[1],1))throw Error('Other event placement branch unresolved');
      pass=q.eventFlags[a[0]&65535]===Boolean(a[1]);if(pass&&networkPass(a[2]))addOrRemove(a[3],a[4],true,c);break;
    case 6: if(a.length!==6||c.args[0].type!==1||c.args[5].type!==1)throw Error('Unsupported route descriptor');break;
    case 8: if(a.length!==3||c.args[0].type!==1)throw Error('Unsupported motion descriptor');break;
    case 11: // Reached flags64 do not overwrite initializer threshold or invoke ancillary resources.
      if(a.length!==2||c.args.some(x=>x.type!==1)||a[1]!==64)throw Error('Unmodeled placement flags');break;
    case 18: if(![2,3].includes(a.length)||c.args[0].type!==1||c.args[1].type!==1)throw Error('Unsupported visibility descriptor');break;
    default: throw Error('Unknown placement opcode '+c.opcode);
   }
 }
 const definitions=[];
 for(const c of r.npc.calls){if(c.opcode!==3)throw Error('Unknown NPC opcode');const a=sourceArgs(c);if(a.length!==5||!uint(a[0],65535)||!uint(a[1],255)||[0,1,4].some(i=>c.args[i].type!==1)||[2,3].some(i=>c.args[i].type!==0))throw Error('NPC shape');
   if(active.has(a[0])){if(a[1]!==1||a[2]!==0xffffffff||a[3]!==0xffffffff)throw Error('Only reached kind1/no model-name constructors supported');definitions.unshift({id:a[0],kind:a[1],sourceCallIndex:c.index,placement:active.get(a[0])});}}
 return {definitions,placementAudit:audit,activePlacementIds:[...active.keys()].sort((a,b)=>a-b),story};
}

const copy=x=>structuredClone(x),xyz=a=>dense(a)&&a.length===3&&a.every(v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647);
const check=(p,m)=>{if(!p)throw Error(m);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function checkedCalls(b){check(b instanceof Uint8Array&&b.length>=16&&b.length<=2*1024*1024,'bounded scenario bytes required');const v=new DataView(b.buffer,b.byteOffset,b.byteLength),count=v.getUint32(0,true),pool=v.getUint32(4,true),poolSize=v.getUint32(8,true);check(count<=10000&&pool>=16&&pool+poolSize<=b.length,'scenario header bounds');let p=16;for(let i=0;i<count;i++){check(p+3<=pool,'truncated scenario');const n=b[p+2],h=(3+Math.ceil(n/4)+3)&~3;check(p+h+4*n<=pool,'scenario argument bounds');p+=h+4*n;}return parseCalls(b);}
// A negative membership proof for this ordinary F06 load. Conditions on other
// maps cannot add an F06 placement. This does not evaluate their quest flags.
export function deriveEmptyF06NpcList(members) {
 check(dense(members)&&members.length===2,'Complete F scenario archive required');
 const place=members.find(m=>m.name==='Fplace.bin'),npc=members.find(m=>m.name==='Fnpc.bin');
 check(place&&npc&&dense(place.calls)&&dense(npc.calls),'F scenario members missing');
 for(const c of place.calls){
  const a=sourceArgs(c);let mapIndex=null;
  if(c.opcode===3){check([2,6,7].includes(a.length),'Unsupported F place3 form');mapIndex=0;}
  else if(c.opcode===5){check([9,13,14].includes(a.length),'Unsupported F place5 form');mapIndex=7;}
  else if(c.opcode===14){check([5,9,10].includes(a.length),'Unsupported F quest placement form');mapIndex=3;}
  else if(c.opcode===17){check([9,10,11,12].includes(a.length),'Unsupported F flag placement form');const conditions=Math.floor((a.length-(a.length%2?7:8))/2);mapIndex=conditions*2+1;}
  else if(c.opcode===6)check(a.length===6&&c.args[0].type===1,'Unsupported F route modifier');
  else if(c.opcode===11)check(a.length===2&&c.args[0].type===1,'Unsupported F flags modifier');
  else if(c.opcode===18)check([2,3].includes(a.length)&&c.args[0].type===1,'Unsupported F visibility modifier');
  else throw Error('Unknown F placement opcode '+c.opcode);
  if(mapIndex!==null)check(c.args[mapIndex].type===1&&uint(a[mapIndex],65535)&&a[mapIndex]!==20006,'F06 NPC placement is outside the empty-list branch');
 }
 for(const c of npc.calls){const a=sourceArgs(c);check(c.opcode===3&&a.length===5&&c.args[0].type===1&&uint(a[0],65535),'Unsupported F NPC definition');}
 return [];
}
function mine(project,context,extended,{selectedEdges=null,requirePickupState=true}={}){
 const nitro=project.nitro,bytes=path=>new Uint8Array(nitro.readFile(path)),list=bytes('data/map/maplist9.bin'),records=decodeMapRecords(list,checkedCalls(list));
 const archive=readBoundedNarcMembers(bytes('data/scenario/D04.npc')).archive;
 const members=archive.files.map((data,i)=>({name:archive.fnt.getFilenameOf(i),calls:checkedCalls(data)}));
 check(members.length===2&&members.some(m=>m.name==='D04place.bin')&&members.some(m=>m.name==='D04npc.bin'),'complete ordinary D04 scenario archive required');
 const treasure=readBoundedNarcMembers(bytes('data/scenario/treasure.nsarc')).archive,names=treasure.files.map((_,i)=>treasure.fnt.getFilenameOf(i).toLowerCase().replace(/\.[^.]+$/,''));
 const exits=new Map(),loads=new Map(),edges=selectedEdges??[[7402,7401],[7401,7400],...(extended?[[7400,20006]]:[])];
 for(const [from,to] of edges){
  const source=records.filter(r=>r.mapId===from),dest=records.filter(r=>r.mapId===to);check(source.length===1&&dest.length===1,'ambiguous map binding');
  const path=`data/map/${source[0].fieldCode}.ambl`,n=readBoundedNarcMembers(bytes(path)),rows=[];
  for(let i=0;i<n.archive.files.length;i++){const member=n.archive.fnt.getFilenameOf(i);if(!member.endsWith('.bmbl'))continue;rows.push(...decodeMapExitMember(n.archive.files[i],{archivePath:path,member,memberIndex:i,memberArchiveOffset:n.offsets[i]},records).exits);}
  const selected=rows.filter(e=>e.target.firstMapId===to);check(selected.length===1&&selected[0].kind.value===0&&selected[0].trigger.rotationRaw16===0,'ordinary unrotated unique exit required');exits.set(from,selected[0]);
  check(!names.includes(dest[0].fieldCode.toLowerCase()),'destination treasure branch outside supported absence');
  if(to===20006){
   check(dest[0].fieldCode==='F06','Only the measured F06 pickup destination is supported');
   const f=readBoundedNarcMembers(bytes('data/scenario/F.npc')).archive;
   const fm=f.files.map((data,i)=>({name:f.fnt.getFilenameOf(i),calls:checkedCalls(data)}));
   const descriptorIds=deriveEmptyF06NpcList(fm);
   const pickups=readBoundedNarcMembers(bytes('data/scenario/flditem.pac')).archive;
   const matches=pickups.files.map((data,i)=>({name:pickups.fnt.getFilenameOf(i),data})).filter(m=>m.name==='F06flditem.bin');
   check(matches.length===1,'Unique F06 pickup resource required');
   const pickupRecords=decodePickupRows(checkedCalls(matches[0].data)),ids=[...new Set(pickupRecords.map(r=>String(r.groupId)))];
   if(requirePickupState)check(exact(context.pickup.stateWords,ids)&&Object.values(context.pickup.stateWords).every(n=>uint(n)),'Complete source-selected pickup words required');
   loads.set(to,{mapId:to,descriptorIds,pickupRecords});
  }else{
   if(selectedEdges)check([7401,7400].includes(to),'Destination NPC interpreter outside existing D04/F06 closure');
   const derived=deriveDescriptors({binding:{mapId:to},primitive:{...context.primitive,generatedNpcMapRange:[50101,50523]},resources:{place:members.find(m=>m.name==='D04place.bin'),npc:members.find(m=>m.name==='D04npc.bin')}});loads.set(to,{mapId:to,descriptorIds:derived.definitions.map(d=>d.id)});
  }
 }
 return {exits,loads,edges};
}
export function validateMapTransitionInputs(context,phases,lastWorldFrame){
 check(uint(lastWorldFrame),'移動前のworld phase時刻が必要です');
 const extended=phases?.length===18;
 check(exact(context,['primitive','conditions',...(extended?['pickup']:[])])&&exact(context.primitive,['story','networkWord','quest185','eventFlags']),'明示した移動先story/quest条件が必要です');
 const names=['ordinarySingleParty','stablePlacementConditions','successfulDestinationLoads','successfulNpcAllocations','noAdditionalFieldSpecies','noInterveningOtherAT','noSeedSetter',...(extended?['stablePickupWords','pickupDescriptorBound','successfulPickupAllocations']:[])];
 check(exact(context.conditions,names)&&names.every(k=>context.conditions[k]===true),'移動中の外部AT・ロード・party条件が不明です');
 check(dense(phases)&&[12,18].includes(phases.length),'2回または3回の到達済み6phaseが必要です');
 if(extended){const p=context.pickup;check(exact(p,['stateWords','phaseRange'])&&p.stateWords&&typeof p.stateWords==='object'&&!Array.isArray(p.stateWords),'初期pickup状態の明示が必要です');check(exact(p.phaseRange,['lower','upper'])&&uint(p.phaseRange.lower,0x7fffffff)&&uint(p.phaseRange.upper,0x7fffffff)&&p.phaseRange.lower<p.phaseRange.upper,'pickup phase範囲が不明です');}
 const order=['exit-request','field-cleanup','map-changed','destination-placement','pool-initialization','destination-load'];let previous=lastWorldFrame;
 for(let i=0;i<phases.length;i++){const e=phases[i],kind=i===17?'pickup-materialization':order[i%6],keys=['phase','sourceFrame',...(kind==='exit-request'?['heroXYZ']:[]),...(kind==='pool-initialization'?['allocationPointer']:[])];check(exact(e,keys)&&e.phase===kind&&uint(e.sourceFrame)&&e.sourceFrame>=previous,'移動phaseの順序・sourceFrameが不明です');previous=e.sourceFrame;if(kind==='exit-request')check(xyz(e.heroXYZ),'移動要求時の明示hero XYZが必要です');if(kind==='pool-initialization')check(uint(e.allocationPointer)&&e.allocationPointer>=0x02000000&&e.allocationPointer+0x1320<=0x02400000&&(e.allocationPointer&3)===0,'成功pool allocation bindingが必要です');}
 return {phases:copy(phases),context:copy(context)};
}
export function prepareMapTransitions(project,context,phases,lastWorldFrame){
 const input=validateMapTransitionInputs(context,phases,lastWorldFrame);return {...mine(project,input.context,input.phases.length===18),...input};
}
export function advanceMapTransition(session){
 if(session.stopped)return false;
 const plan=session.mapTransitions,i=session.transitionIndex??0,e=plan.phases[i];
 if(!e){session.status='transition-ended';session.reason=plan.phases.length===18?'F06のpickup初期化まで。移動先field・NPC・以降のworld更新は未解決です':'2回目の移動先loaderまで。以降のNPC・world更新は未解決です';session.stopped=true;return false;}
 const edge=Math.floor(i/6),[sourceMapId,targetMapId]=[[7402,7401],[7401,7400],[7400,20006]][edge],exit=plan.exits.get(sourceMapId),row={index:session.events.length,sourceFrame:e.sourceFrame,phase:e.phase,mapId:session.currentMapId??7402,heroXYZ:null,seed:session.seed,timer:session.timer,consumed:0,invocationResolved:true,status:'running',reason:''};
 try{
  if(e.phase==='exit-request'){
   check((session.currentMapId??7402)===sourceMapId,'source map mismatch');if(edge===0)check(JSON.stringify(session.hero.xyz)===JSON.stringify(e.heroXYZ),'last post-hero pose and first request differ');
   check(e.heroXYZ.every((v,k)=>v>=exit.trigger.minFixed[k]&&v<=exit.trigger.maxFixed[k]),'reached exit pose outside supported source trigger');
   session.hero.xyz=[...e.heroXYZ];session.pendingTransition={sourceMapId,targetMapId,lastKnownSourceXYZ:[...e.heroXYZ],requestedXYZ:[...exit.destination.xyzFixed],phase:'requested'};session.currentCoordinate={mapId:sourceMapId,xyz:[...e.heroXYZ],kind:'measured-request-input'};session.heroTrace.push([...e.heroXYZ]);row.heroXYZ=[...e.heroXYZ];row.reason='ROM出口を選択。移動要求の到達を入力条件として保持';
  }else if(e.phase==='field-cleanup'){
   check(session.pendingTransition?.phase==='requested'&&session.pendingTransition.targetMapId===targetMapId,'missing transition request');session.hero.mapId=targetMapId;session.hero.xyz=null;session.hero.angle=null;session.hero.nodeIndex=null;
   const f=session.context.fields.find(f=>f.mapId===sourceMapId);check(f,'source field absent');const group=f.flags&3;
   for(const slot of session.context.inventory.slots.filter(s=>s.slot>=112+12*group&&s.slot<124+12*group)){const actor=session.actors.get(slot.slot);if(actor){session.closedActors??=[];session.closedActors.push({...actor,closedBy:'map-unregister',closedAt:row.index});session.actors.delete(slot.slot);}Object.assign(slot,{pointer:0,registryKnown:true});}
   Object.assign(f,{mapId:0,flags:f.flags&3,creationCounter:0,active:0});f.resources={models:{containerPointer:f.pointer+0x2f4,basePointer:0,declaredCount:0,entries:[]},ai:{containerPointer:f.pointer+0x300,head:0,records:[]}};f.tables={containerPointer:f.pointer+0x5c,declaredCount:0,rows:[]};session.timer=0;session.actor=null;session.actorPhase=null;session.actorTrace=[];session.currentCoordinate=null;session.pendingTransition.phase='field-cleared';row.reason='旧mapの自然actor登録を閉じ、field timer/resourcesを初期化。ATは保持';
  }else if(e.phase==='map-changed'){
   check(session.pendingTransition?.phase==='field-cleared'&&session.pendingTransition.targetMapId===targetMapId,'cleanup-to-map phase unknown');session.currentMapId=targetMapId;session.context.managerMapId=targetMapId;session.heroTrace=[];session.currentCoordinate=null;session.pendingTransition.phase='map-changed-unplaced';row.reason='map番号更新。移動先の物理座標は配置前で不明';
  }else if(e.phase==='destination-placement'){
   check(session.pendingTransition?.phase==='map-changed-unplaced','placement phase unknown');session.pendingTransition.phase='placed-initializing';session.requestedPlacement={mapId:targetMapId,xyz:[...exit.destination.xyzFixed],settledHeightKnown:false};session.currentCoordinate=null;row.reason='ROMの配置要求XYZを適用。接地後Y/現在位置は未確定';
  }else if(e.phase==='pool-initialization'){
   check(session.pendingTransition?.phase==='placed-initializing','pool before placement');check(!session.context.fields.some(f=>f.mapId===targetMapId),'cached destination group is outside this reached fresh-pool branch');const f=session.context.fields.find(f=>(f.flags&4)===0);check(f&&f.index===0,'measured first free field0 required');
   Object.assign(f,{mapId:targetMapId,flags:(f.flags&3)|4,creationCounter:0,active:0});session.field=f;
   const carryPool=canCarryF06PoolStorage(session.f06Continuation?.creator,session.context.controllerPointer,e.allocationPointer);if(session.f06Continuation?.creator)row.poolE0Carry=carryPool?'conditional-same-storage-non-fill':'unknown';
   for(let n=0;n<12;n++){const slot=session.context.inventory.slots.find(s=>s.slot===112+n);Object.assign(slot,{registryKnown:true,pointer:e.allocationPointer+n*0x198,headerFlags:35,monsterIdRaw:65535,actorFlags:5,tableId:0,nativeSerial:0,nativeSlot:slot.slot});if(!carryPool)delete slot.e0Byte;delete slot.xyz;delete slot.generationId;delete slot.nodeIndex;delete slot.mapId;}
   session.pendingTransition.phase='pool-initialized';row.reason=carryPool?'同一storage/non-fill条件でe0を保持し、12個のreset/free slotを再登録':'到達済み成功allocationから12個のreset/free slotを再登録。残留byteは未知';
  }else if(e.phase==='pickup-materialization'){
   check(targetMapId===20006&&session.pendingTransition?.phase==='pool-initialized','pickup loop before destination pool');
   // New F06 templates/resources already load in this interval. Their live
   // state is not reconstructed by this AT-only leaf, so do not retain zeros.
   Object.assign(session.field,{flags:null,active:null,resources:null,tables:null,resourcesResolved:false});session.timer=null;
   session.destinationWorld={mapId:targetMapId,resolved:false,reason:'Destination field, templates, terrain and update schedule are not reconstructed'};
   const load=plan.loads.get(targetMapId),p=plan.context.pickup;
   check(load?.descriptorIds?.length===0&&load.pickupRecords,'F06 source NPC/pickup binding unavailable');
   const result=projectPickupMaterialization({records:load.pickupRecords,runtimeWords:p.stateWords,phaseRange:p.phaseRange,conditions:{recordLoopReached:true,completeSourceOrderedRows:true,runtimeWordsStableUntilRead:plan.context.conditions.stablePickupWords,sourceRowsBoundToLoadedList:plan.context.conditions.successfulDestinationLoads,phaseRangeBoundToLoadedDescriptor:plan.context.conditions.pickupDescriptorBound,noInterveningATConsumers:plan.context.conditions.noInterveningOtherAT,noSeedSetter:plan.context.conditions.noSeedSetter,allRequiredAllocationsSucceed:plan.context.conditions.successfulPickupAllocations}},session.seed,session.atKernel);
   session.seed=result.seed;session.consumed+=result.consumed;row.consumed+=result.consumed;row.pickupResults=result.events;row.destinationWorldResolved=false;
   check(result.resolved&&!result.returnedEarly,result.reason);session.pendingTransition.phase='pickup-projected';row.reason=`ROMのpickup recordと初期状態から${result.consumed}回を導出。移動先field・現在座標・接地Yは未確定`;
  }else{
   check(session.pendingTransition?.phase==='pool-initialized','destination initializer before pool binding');const load=plan.loads.get(targetMapId);row.constructorResults=[];
   for(const {descriptorId:id} of destinationNPCConsumerPlan(load).actors){const a=session.atKernel.generate(session.seed,0n,1);session.seed=a[0];session.consumed++;row.consumed++;const threshold=session.atKernel.e.world_movement_init(a[1]);const b=session.atKernel.generate(session.seed,0n,1);session.seed=b[0];session.consumed++;row.consumed++;const phase=session.atKernel.e.world_actor_phase(b[1]);row.constructorResults.push({descriptorId:id,threshold,phase});}
   session.field.flags|=8;session.pendingTransition.phase='loader-projected';row.reason=`ROMから移動先NPC${load.descriptorIds.length}件、初期化AT+${row.consumed}を導出。全world更新は未解決`;
  }
  row.mapId=session.currentMapId??7402;row.seed=session.seed;row.timer=session.timer;session.status='running';session.reason=row.reason;session.events.push(row);session.transitionIndex=i+1;return true;
 }catch(error){session.status='unresolved';session.reason=error.message;session.stopped=true;Object.assign(row,{status:'unresolved',reason:error.message,invocationResolved:false,seed:session.seed,timer:session.timer});session.events.push(row);return false;}
}

// Exactly the same source-ordered ordinary NPC initialization used above.
// It is a local segment, never all AT consumers during a video map change.
export function destinationNPCConsumerPlan(load){
 check(load&&dense(load.descriptorIds)&&load.descriptorIds.every(id=>uint(id,65535)),'Source-derived destination descriptors required');
 return {actors:load.descriptorIds.map(descriptorId=>({descriptorId,consumers:['npc-controller-initialize','npc-ordinary-actor-initialize']})),calls:String(2*load.descriptorIds.length),seedSetterInSegment:false};
}
export function prepareConditionalDestinationLoad(project,{fromMapId,toMapId,primitive}={}){
 check(uint(fromMapId,65535)&&uint(toMapId,65535)&&fromMapId!==toMapId,'Explicit distinct ROM map edge required');
 // No source frames, allocation addresses, seed, fake clock or pool are needed
 // to read the resources. Unknown story/quest packets remain unresolved.
 const plan=mine({nitro:project?.nitro??project?.nfs},{primitive},toMapId===20006,{selectedEdges:[[fromMapId,toMapId]],requirePickupState:false});
 const load=plan.loads.get(toMapId),npc=destinationNPCConsumerPlan(load);
 return {edge:copy(plan.exits.get(fromMapId)),fromMapId,toMapId,npc,pickup:load.pickupRecords?conditionalPickupDrawCountDomain(load.pickupRecords):null,pickupMaterializationOutsideNPCSegment:Boolean(load.pickupRecords),conditions:['ordinary reached destination NPC constructor loop','complete source-selected descriptor list under the supplied primitive hypothesis','all required ordinary NPC allocations and constructors complete','no interleaved consumer or seed setter inside this local segment'],primitiveHypothesis:primitive?copy(primitive):null,worldBeforeAndAfterUnknown:true,actualMapEntryCertified:false,currentATRecovered:false};
}
