// Source-backed natural field allocation plus explicitly observed transitions.
// This does not infer entity lifetimes from visibility or reset ATSession bounds.
const clone=x=>structuredClone(x);
const u16=x=>Number.isInteger(x)&&x>=0&&x<=65535;
const u32=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const signed16=x=>x&0x8000?x-65536:x;
const validGroup=g=>Number.isInteger(g)&&g>=0&&g<=3;

export function describeInventorySlot(record){
 const pointerKnown=record.registryKnown===true&&u32(record.pointer);
 const allocated=pointerKnown?record.pointer!==0:null;
 const speciesKnown=allocated===true&&u16(record.monsterIdRaw);
 return{...clone(record),allocated,monsterIdSigned:speciesKnown?signed16(record.monsterIdRaw):null,
  allocatorFree:allocated===false?false:speciesKnown?signed16(record.monsterIdRaw)<0:null,
  typedMonsterReadable:allocated===false?false:allocated===true&&u16(record.headerFlags)?!!(record.headerFlags&0x20):null,
  typedActorReadable:allocated===false?false:allocated===true&&u16(record.headerFlags)?!!(record.headerFlags&2):null,
  active:allocated===false?false:allocated===true&&u32(record.actorFlags)?(record.actorFlags&1)===0:null,
  visibility:clone(record.visibility??'unknown')};
}

/** Generic0200fbcc, NOT typed0200fc88: non-null and signed16 species<0.
 * Natural group domain0..3; native requested count clamps at12.
 * Unknown earlier slots prevent choosing a later known-free slot as certain.
 */
export function deriveNaturalFreeSlot(inventory,{group=inventory.group,requestedCount=12}={}){
 if(!validGroup(group)||!Number.isInteger(requestedCount))throw Error('Natural group0..3 and integer requested count required');
 if(!Array.isArray(inventory.slots))throw Error('Slot inventory required');
 const bySlot=new Map();for(const record of inventory.slots){if(bySlot.has(record.slot))throw Error('Duplicate slot record');bySlot.set(record.slot,record);}
 const count=Math.max(0,Math.min(12,requestedCount)),base=112+12*group,possible=[],checked=[];
 for(let i=0;i<count;i++){
  const slot=base+i,record=describeInventorySlot(bySlot.get(slot)??{slot,registryKnown:false});
  checked.push({slot,pointer:record.pointer??null,allocatorFree:record.allocatorFree});
  if(record.allocatorFree===null)possible.push(slot);
  if(record.allocatorFree===true){possible.push(slot);return{resolved:possible.length===1,freeSlot:possible.length===1?slot:null,possibleSlots:possible,checked,group,count,basis:'generic-nonnull-signed-species-negative',visibilityUsed:false};}
 }
 possible.push(-1);
 return{resolved:possible.length===1,freeSlot:possible.length===1?-1:null,possibleSlots:possible,checked,group,count,basis:'generic-nonnull-signed-species-negative',visibilityUsed:false};
}

/** Development fixture decoder. Production may supply equivalent modeled records.
 * Out-of-captured-RAM pointers retain unknown fields, never become empty slots.
 */
export function inventoryFromMainRam(bytes,{runId,frameKey,group=0,registryAddress=0x020f33d8}={}){
 if(!runId||!frameKey||!validGroup(group)||!(bytes instanceof Uint8Array))throw Error('Stamped main RAM and natural group required');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),start=0x02000000;
 const fits=(address,size)=>address>=start&&address+size<=start+bytes.length;
 const read16=a=>view.getUint16(a-start,true),read32=a=>view.getUint32(a-start,true);
 const slots=[];
 for(let slot=112+12*group;slot<124+12*group;slot++){
  const address=registryAddress+8+slot*4,r={slot,registryKnown:fits(address,4),snapshotFrameKey:frameKey};
  if(r.registryKnown){r.pointer=read32(address);if(r.pointer&&fits(r.pointer,0x16c)){
   const p=r.pointer;r.headerFlags=read16(p);r.monsterIdRaw=read16(p+2);r.nativeSlot=read16(p+4);r.actorFlags=read32(p+0x6c);
   r.tableId=read16(p+0x168);r.nativeSerial=read16(p+0x16a);r.nodeIndex=read16(p+0xb8);
   r.xyz=[0x44,0x48,0x4c].map(offset=>view.getInt32(p+offset-start,true));
  }}slots.push(r);
 }
 return{runId,frameKey,group,registryAddress,slots,generationCounter:0,lifetimes:[],history:[],atUnchanged:true};
}

function slotTransition(inventory,event){
 if(!event?.eventId||!event.frameKey||!Number.isInteger(event.slot)||!event.afterSlot)throw Error('Explicit observed event and post-record required');
 if((inventory.history??[]).some(x=>x.eventId===event.eventId))throw Error('Duplicate transition event');
 const index=inventory.slots.findIndex(x=>x.slot===event.slot);if(index<0)throw Error('Transition outside captured inventory');
 const before=inventory.slots[index],after=event.afterSlot;
 if(after.slot!==event.slot||!u32(after.pointer)||after.pointer===0||after.pointer!==event.objectPointer)throw Error('Post-record identity mismatch');
 const detached=before.registryKnown&&before.pointer===0&&before.detachedObject?.pointer===after.pointer;
 if(before.registryKnown&&before.pointer!==after.pointer&&!detached)throw Error('Registry pointer changed; resolve that relation before applying object transition');
 return{index,before,after,detached};
}

export function applyObservedCreation(inventory,event){
 if(event?.kind!=='observed-creation-return'||event.result!==event.slot||event.result<=0||!u16(event.monsterId)||event.monsterId>=32768||!u16(event.tableId))throw Error('Successful observed native creation result required');
 const{index,before,after,detached}=slotTransition(inventory,event);
 if(detached)throw Error('Creation record is not registered in the observed slot');
 const allocation=deriveNaturalFreeSlot(inventory);
 if(allocation.resolved&&allocation.freeSlot!==event.slot)throw Error('Creation conflicts with the known first-free prefix; resolve missing transitions');
 if(after.registryKnown!==true||after.monsterIdRaw!==event.monsterId||after.tableId!==event.tableId||!u16(after.nativeSerial))throw Error('Creation fields do not match observed registered post-record');
 const next=clone(inventory),number=(next.generationCounter??0)+1,generationId=`${next.runId}:generation:${number}`;
 next.generationCounter=number;next.slots[index]={...clone(after),generationId};
 next.lifetimes??=[];next.lifetimes.push({generationId,slot:event.slot,pointer:after.pointer,nativeSerial:after.nativeSerial,monsterId:event.monsterId,tableId:event.tableId,birthEventId:event.eventId,birthFrameKey:event.frameKey,postSnapshotFrameKey:after.snapshotFrameKey??event.frameKey,visibility:'unknown',status:'observed-created'});
 next.history??=[];next.history.push({eventId:event.eventId,kind:event.kind,frameKey:event.frameKey,slot:event.slot,generationId,before:clone(before),after:clone(next.slots[index]),atCallsOwnedByScheduler:true});
 return next;
}

/** This exact observed pool-reset postcondition is not universal despawn logic.
 * Registry association is retained until a separate registry observation changes it.
 */
export function applyObservedPoolReset(inventory,event){
 if(event?.kind!=='observed-field-pool-reset'||event.functionAddress!==0x020779a8)throw Error('Observed020779a8 pool reset required');
 const{index,before,after,detached}=slotTransition(inventory,event);
 if(after.monsterIdRaw!==65535||after.tableId!==0||after.nativeSerial!==0||!u32(after.actorFlags)||(after.actorFlags&1)!==1)throw Error('Observed reset/inactive-sequence postconditions incomplete');
 const next=clone(inventory);next.slots[index]=detached?{...clone(before),detachedObject:{...clone(after),generationId:null}}:{...clone(after),generationId:null};
 const oldGeneration=detached?before.detachedObject.generationId:before.generationId;
 const lifetime=next.lifetimes?.find(x=>x.generationId===oldGeneration);
 if(lifetime){if(!detached)lifetime.status='observed-pool-reset';lifetime.resetEventId=event.eventId;lifetime.resetFrameKey=event.frameKey;}
 next.history??=[];next.history.push({eventId:event.eventId,kind:event.kind,frameKey:event.frameKey,slot:event.slot,previousGenerationId:oldGeneration??null,before:clone(before),after:clone(next.slots[index]),registryUnlinkKnown:detached,offscreenDespawnInferred:false,observedATCalls:event.observedATCalls??null});
 return next;
}

/** Exact observed registry write, not a camera/disappearance heuristic.
 * Detached bytes are retained separately and cannot make a null slot allocatable.
 */
export function applyObservedRegistryWrite(inventory,event){
 const unlink=event?.kind==='observed-registry-unlink',register=event?.kind==='observed-registry-register';
 if((!unlink&&!register)||!event.eventId||!event.frameKey||!u32(event.beforePointer)||!u32(event.afterPointer)
    ||(unlink&&(event.functionAddress!==0x0200fba4||event.afterPointer!==0))
    ||(register&&(event.functionAddress!==0x0200fb94||event.beforePointer!==0||event.afterPointer===0)))throw Error('Explicit native unlink or null-to-object registration required');
 if((inventory.history??[]).some(x=>x.eventId===event.eventId))throw Error('Duplicate transition event');
 const index=inventory.slots.findIndex(x=>x.slot===event.slot);if(index<0)throw Error('Registry write outside inventory');
 const before=inventory.slots[index];if(before.registryKnown&&before.pointer!==event.beforePointer)throw Error('Registry precondition differs');
 const next=clone(inventory);
 if(unlink){
  next.slots[index]={slot:event.slot,registryKnown:true,pointer:0,snapshotFrameKey:event.frameKey,detachedObject:clone(before),generationId:null};
  const life=next.lifetimes?.find(x=>x.generationId===before.generationId);
  if(life){life.status='observed-registry-unlinked';life.registryEndEventId=event.eventId;life.registryEndFrameKey=event.frameKey;}
 }else{
  if(event.afterSlot&&(event.afterSlot.slot!==event.slot||event.afterSlot.pointer!==event.afterPointer))throw Error('Registered object record differs');
  next.slots[index]={...clone(event.afterSlot??{}),slot:event.slot,registryKnown:true,pointer:event.afterPointer,snapshotFrameKey:event.frameKey,generationId:null};
 }
 next.history??=[];next.history.push({eventId:event.eventId,kind:event.kind,frameKey:event.frameKey,slot:event.slot,beforePointer:event.beforePointer,afterPointer:event.afterPointer,previousGenerationId:before.generationId??null,physicalDestructionInferred:false,visibilityInference:false,observedATCalls:event.observedATCalls??null});
 return next;
}

/** Only this wrapper supplies freeSlot; arbitrary caller free-slot claims rejected.
 * Other scheduler inputs retain their existing explicit/unknown contracts.
 */
export function stepFieldWithInventory(scheduler,state,input,tables,inventory){
 if(Object.prototype.hasOwnProperty.call(input,'freeSlot'))throw Error('freeSlot must be derived from inventory');
 const group=u16(input.fieldFlags)?input.fieldFlags&3:null;
 const allocation=group===null?{resolved:false,freeSlot:null,reason:'field group unknown'}:deriveNaturalFreeSlot(inventory,{group});
 const result=scheduler.step(state,{...input,freeSlot:allocation.resolved?allocation.freeSlot:undefined},tables);
 return{...result,allocation,inventoryRunId:inventory.runId,inventoryFrameKey:inventory.frameKey,inventoryChanged:false};
}
