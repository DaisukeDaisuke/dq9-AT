// Source-qualified02079d54/02077ef8 current-node entry. The actor's own
// native slot is excluded. No AT draw; occupied/unknown contexts suspend.
import {fieldNodeOccupied,fieldNativeDistance} from './field-preferred-node.mjs';
import {describeInventorySlot} from './field-inventory.mjs';
const u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const u16=n=>Number.isInteger(n)&&n>=0&&n<=65535;
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const xyz=a=>dense(a)&&a.length===3&&a.every(n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647);
export function unarmedCurrentNodeTransition(kernel,before,context){
  const no = reason => ({resolved:false,reason,scope:'unarmed source branch',inputUnchanged:true});
  if(!byte(before?.routeFlags)||(before.routeFlags&64)||!u32(before.stateTimer)||before.stateTimer<4001)return no('unarmed route flag and reached timer gate required');
  if (context?.handlerReached !== true || context.globalWord !== 0 || context.fieldPresent !== true || context.graphBindingVerified !== true || !u16(context.fieldMapId) || context.fieldMapId !== before.mapId || !u16(context.fieldFlags)) return no('unarmed field/map/group context unresolved');
  if (![before.stateTimer,before.currentSeed,before.actorFlags].every(u32) || !u16(before.mapId)) return no('unarmed native timer/seed/flags/map widths unknown');
  if (before.state !== 1 || before.routeMode !== 1 || before.movementByte !== 0 || before.e0 !== 0 || before.alertFlag !== 0 || before.blockFlag !== 0 || (before.actorFlags & 0x40000) || ![0,1,2,3,7,8,9,10,11,12].includes(before.previousState) || !xyz(before.xyz)) return no('unarmed handler state outside supported guards');
  const group = context.fieldFlags & 3, slot = before.registryIndex, graph = context.graph, inventory = context.inventory;
  if (!u16(slot) || slot < 112 + 12*group || slot >= 124 + 12*group || !dense(graph?.nodes) || graph.nodes.length>255 || graph.nodes.some(n => !n || !byte(n.id)) || new Set(graph.nodes.map(n => n.id)).size !== graph.nodes.length || !u16(before.currentNodeIndex) || before.currentNodeIndex>=graph.nodes.length) return no('unarmed caller native slot/current node unknown');
  const node = graph.nodes[before.currentNodeIndex];
  if (!node || !byte(node.id) || !dense(node.neighbors) || !node.neighbors.length || node.neighbors.length > 255 || !xyz(node.position) || node.position.some(x => x < -32768 || x > 32767) || !dense(inventory?.slots) || inventory.slots.some(r => !r || typeof r !== 'object') || new Set(inventory.slots.map(r => r.slot)).size !== inventory.slots.length) return no('unarmed current-node graph unresolved');
  if (node.neighbors.some(i => !Number.isInteger(i) || i < 0 || !graph.nodes[i])) return no('unarmed adjacency graph coverage unknown');
  const selectedTargets = graph.nodes.filter(n => n.id === node.id);
  if (selectedTargets.length !== 1 || selectedTargets[0] !== node) return no('unarmed selected node-ID lookup ambiguous');
  for (let other = 112 + 12*group; other < 124 + 12*group; other++) {
   if (other === slot) continue;
   const raw = inventory.slots.find(r => r.slot === other), record = describeInventorySlot(raw ?? {slot:other,registryKnown:false});
   if (record.typedActorReadable === true && record.active === true && (!Number.isInteger(record.nodeIndex) || record.nodeIndex < 0 || !graph.nodes[record.nodeIndex])) return no('active other-actor node graph coverage unknown');
  }
  const same = inventory.slots.filter(r => r?.slot === slot);
  if (same.length !== 1 || same[0].registryKnown !== true || !u32(same[0].pointer) || same[0].pointer <= 0) return no('unarmed own-slot binding unknown');
  // Native02074ee4 receives signed actor+4 and skips that slot before lookup.
  const otherInventory = {...inventory,slots:inventory.slots.map(r => r?.slot === slot ? {slot,registryKnown:true,pointer:0} : r)};
  const occupancy = fieldNodeOccupied(graph, otherInventory, group, node.id);
  if (!occupancy.resolved) return no('unarmed other-actor current-node occupancy unresolved');
  if (occupancy.occupied) return no('unarmed occupied-current-node branch outside this measured closure');
  const targetXYZ = node.position.map(x => x * 4096), distance = fieldNativeDistance(before.xyz,targetXYZ);
  if (distance === null) return no('unarmed current-node distance unresolved');
  if(distance>=4096){
   if(!Number.isInteger(before.speedMode)||before.speedMode<0||before.speedMode>3||!u16(before.delayWord))return no('unarmed far-entry speed/delay inputs unresolved');
   const steering=kernel.state2EntrySteering(before.xyz,targetXYZ);if(!steering.resolved||steering.steeringDistance<4096)return no('unarmed far-entry numerical domain unresolved');
   const speed=[0,154,230,450][before.speedMode],nextState={...structuredClone(before),state:2,previousState:1,stateTimer:0,targetNodeId:node.id,targetXYZ,targetAngle:steering.targetAngle,movementByte:1,previousMovementByte:0,speed,targetSpeed:speed,routeFlags:before.routeFlags|64,actorFlags:(before.actorFlags|128)>>>0,delayWord:before.delayWord&32767,alertFlag:0};
   return {resolved:true,nextState,nextATSeed:before.currentSeed,atConsumed:0,inputUnchanged:true,scope:'unarmed current-node far state2 entry',entryReturn:1,stateChangeCommitted:true,currentNodeOccupiedByOther:false,ignoredNativeSlot:slot,steering,fullMonsterStepResolved:false};
  }
  // Source02077ef8 writes targetXYZ before distance<4096 returns0. The common
  // state transition commits state/previous/timer only on nonzero return.
  const nextState = {...structuredClone(before),routeFlags:before.routeFlags|64,targetNodeId:node.id,targetXYZ,alertFlag:0};
  return {resolved:true,nextState,nextATSeed:before.currentSeed,atConsumed:0,inputUnchanged:true,scope:'unarmed current-node arming and close-target rejected state2 entry',entryReturn:0,entryWritesCommitted:true,stateChangeCommitted:false,currentNodeOccupiedByOther:false,ignoredNativeSlot:slot,distance,fullMonsterStepResolved:false};
}
