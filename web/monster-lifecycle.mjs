import {deriveNaturalFreeSlot} from './field-inventory.mjs';
// Source-derived outer021a2560 post-tick branch. This is not a viewport test.
// 'retain' means this branch requests no reset; it does not prove registry life.
const u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const u16=n=>Number.isInteger(n)&&n>=0&&n<=65535;
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const xyz=p=>dense(p)&&p.length===3&&p.every(n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647);
const wrap=n=>n|0;
/** The actor is the predicted result of02077a74. Identity is a modeled lifetime
 * key, not just a reusable native serial. Registry and parties are external
 * pre-gate facts. Unknown inputs never imply an empty/visible world. */
export function evaluateMonsterOuterLifetime(actor,context){
 const result=(outcome,reason,extra={})=>({resolved:outcome!=='unresolved',outcome,reason,scope:'021a2560 post-tick far-party predicate',atConsumedByPredicate:outcome==='unresolved'?null:0,resetATResolved:outcome!=='unresolved',atConsumed:outcome==='unresolved'?null:0,minimumATConsumed:0,worldStepResolved:false,lifetimePresenceResolved:false,visibilityUsed:false,registryChanged:false,...extra});
 const no=reason=>result('unresolved',reason),keep=reason=>result('retain',reason);
 const id=context?.identity;
 if(context?.afterTickReached!==true||context.globalWord!==0||!u16(context.fieldGroupFlags)||(context.fieldGroupFlags&4)===0||!Number.isInteger(context.groupIndex)||context.groupIndex<0||context.groupIndex>3)return no('supported active-group/raw-position post-tick context required');
 if(!id||typeof id.generationId!=='string'||!id.generationId||!u32(id.pointer)||!id.pointer||!Number.isInteger(id.slot)||id.slot<112+12*context.groupIndex||id.slot>=124+12*context.groupIndex||actor?.registryIndex!==id.slot)return no('complete owned generation/pointer/slot identity required');
 if(!byte(actor.routeFlags)||!u16(context.managerMapId))return no('post-tick route flags/current manager map unknown');
 if(actor.routeFlags&14)return keep('native route-flag exemption');
 if(context.managerMapId>=41101&&context.managerMapId<=41505)return keep('native current-manager-map exemption');
 const typed=context.typedMonsterLookup,registry=context.registryAfterTick;
 if(typed!==undefined){
  if(typed?.known!==true||!u32(typed.pointer))return no('typed monster lookup unknown');
  if(typed.pointer===0)return keep('native typed relookup absent; generic registry relation unknown');
  if(typed.pointer!==id.pointer||typed.generationId!==id.generationId)return no('typed lookup lifetime identity unproved');
 }else{
  if(registry?.registryKnown!==true||!u32(registry.pointer))return no('post-tick registry relookup unknown');
  if(registry.pointer===0)return keep('native typed relookup absent');
  if(registry.pointer!==id.pointer||registry.generationId!==id.generationId)return no('registry lifetime changed or identity unproved');
  if(!u16(registry.headerFlags))return no('typed relookup header unknown');
  if(!(registry.headerFlags&0x20))return keep('native relookup is not a typed monster');
 }
 if(!u16(actor.mapId)||!xyz(actor.xyz)||!Number.isInteger(actor.state)||actor.state<0||actor.state>12)return no('post-tick map/XYZ/state unknown');
 if(!dense(context.parties)||context.parties.some(p=>!p||!Number.isInteger(p.slot)||p.slot<0||p.slot>3))return no('complete four-party registry context required');
 const parties=new Map(context.parties.map(p=>[p.slot,p]));if(parties.size!==4||parties.size!==context.parties.length)return no('all four unique party slots required');
 let unknown=false;const checks=[];
 for(let slot=0;slot<4;slot++){
  const p=parties.get(slot);
  // A sampled typed lookup can prove absence without claiming generic slot0.
  if(p.typedActorLookup!==undefined){if(p.typedActorLookup?.known!==true||!u32(p.typedActorLookup.pointer)){unknown=true;continue;}if(!p.typedActorLookup.pointer)continue;}
  else{if(p.registryKnown!==true||!u32(p.pointer)){unknown=true;continue;}if(!p.pointer)continue;if(!u16(p.headerFlags)){unknown=true;continue;}if(!(p.headerFlags&2))continue;}
  if(!u16(p.mapId)){unknown=true;continue;}if(p.mapId!==actor.mapId)continue;
  if(!xyz(p.xyz)){unknown=true;continue;}
  // Native ADD wraps before signed inclusive02030c50 comparisons.
  const inside=actor.xyz.every((v,i)=>v<=wrap(p.xyz[i]+0x19000)&&v>=wrap(p.xyz[i]-0x19000));checks.push({slot,inside});
  if(inside)return result('retain','same-map typed party within inclusive XYZ box',{checks});
 }
 if(actor.state===8||actor.state===9)return result('retain','native post-tick state exemption',{checks});
 if(unknown)return no('a possibly eligible party position is unknown');
 return result('reset-deactivate','no same-map typed party in inclusive XYZ box',{checks,resetRequested:true,objectPointer:id.pointer,generationId:id.generationId,slot:id.slot,registryUnlinkPredicted:false,resetProjectionResolved:false});
}

/** Partial native reset projection. Do not merge unlisted old actor fields into
 * a supposedly complete reset object. Native registry slot identity is external
 * to the object's reset registryIndex field (which becomesFFFF). */
export function projectMonsterOuterReset(actor,context){
 const gate=evaluateMonsterOuterLifetime(actor,context);
 if(!gate.resolved||gate.outcome!=='reset-deactivate')return {...gate,resetProjectionResolved:false};
 return {...gate,resetProjectionResolved:true,projectedResetFields:{header:35,species:65535,registryIndex:65535,mapId:65535,xyz:[0,0,0],angle:0,targetAngle:0,currentNodeIndex:0,state:1,previousState:1,stateTimer:0,activeElapsed:0,updateCounter:0,targetXYZ:[0,0,0],targetNodeId:0,targetPartySlot:0,tableId:0,serial:0,routeFlags:0,actorFlags:5,animationClassPointer:0,animationComponentListPointer:0,animationEventIndex:65535},lifetimeEvent:{kind:'predicted-reset-deactivation',generationId:context.identity.generationId,slot:context.identity.slot,pointer:context.identity.pointer,lastXYZ:[...actor.xyz],lastSpecies:actor.species??null,lastNativeSerial:actor.serial??null,frameKey:context.frameKey??null},ownedLifetimeStatus:'reset-deactivated',futureActorTicksPermitted:false,completeResetObjectResolved:false};
}

/** Apply only the derived reset to the modeled inventory. A new birth must
 * receive a new generation later; reset serial0 never renames the old life. */
export function stepMonsterOuterLifetimeWithInventory(inventory,actor,context){
 const decision=projectMonsterOuterReset(actor,context);
 const unchanged=reason=>({resolved:false,reason,decision,inventory,inventoryChanged:false});
 if(!decision.resolved)return unchanged(decision.reason);
 if(decision.outcome!=='reset-deactivate')return {resolved:true,decision,inventory,inventoryChanged:false};
 if(typeof context.eventId!=='string'||!context.eventId||!context.frameKey||typeof context.frameKey.runId!=='string'||context.frameKey.runId!==inventory?.runId||typeof inventory?.runId!=='string'||!inventory.runId||inventory.group!==context.groupIndex||!dense(inventory.slots)||inventory.slots.some(r=>!r||!Number.isInteger(r.slot)))return unchanged('stamped matching modeled inventory required');
 if(new Set(inventory.slots.map(r=>r.slot)).size!==inventory.slots.length||(inventory.history??[]).some(e=>e.eventId===context.eventId))return unchanged('duplicate slot or lifecycle event');
 const index=inventory.slots.findIndex(r=>r.slot===context.identity.slot),prior=inventory.slots[index];
 if(!prior||prior.registryKnown!==true||prior.pointer!==context.identity.pointer||prior.generationId!==context.identity.generationId)return unchanged('modeled registry generation does not match reset object');
 const next=structuredClone(inventory),f=decision.projectedResetFields,event=structuredClone(decision.lifetimeEvent);
 next.slots[index]={slot:context.identity.slot,registryKnown:true,pointer:context.identity.pointer,headerFlags:f.header,monsterIdRaw:f.species,nativeSlot:f.registryIndex,actorFlags:f.actorFlags,tableId:f.tableId,nativeSerial:f.serial,nodeIndex:f.currentNodeIndex,xyz:[...f.xyz],generationId:null,snapshotFrameKey:structuredClone(context.frameKey),visibility:'unknown'};
 next.frameKey=structuredClone(context.frameKey);
 const life=next.lifetimes?.find(l=>l.generationId===context.identity.generationId);
 if(life)Object.assign(life,{status:'predicted-reset-deactivated',lastXYZ:[...event.lastXYZ],resetFrameKey:structuredClone(context.frameKey),resetEventId:context.eventId});
 next.history??=[];next.history.push({eventId:context.eventId,kind:'predicted-reset-deactivation',frameKey:structuredClone(context.frameKey),generationId:context.identity.generationId,slot:context.identity.slot,before:structuredClone(prior),after:structuredClone(next.slots[index]),lastEntityXYZ:[...event.lastXYZ],registryUnlinkPredicted:false,atConsumedByReset:0});
 return {resolved:true,decision,inventory:next,inventoryChanged:true,allocation:deriveNaturalFreeSlot(next,{group:context.groupIndex}),globalWorldComplete:false};
}
