// 02074b64..02074dc4, conditional on a reached selected-node path.
// Inputs are effective native positions, not an inferred D-pad trajectory.
import {fieldNativeDistance,fieldNativeNormalize,fieldNativeDot} from './field-preferred-node.mjs';
import {describeInventorySlot} from './field-inventory.mjs';

const i32=x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647;
const u32=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const u16=x=>Number.isInteger(x)&&x>=0&&x<=65535;
const xyz=x=>Array.isArray(x)&&x.length===3&&x.every(i32);
const signed=x=>Number(BigInt.asIntN(32,x));
const multiply=(a,b)=>signed((BigInt(a)*BigInt(b)+0x800n)>>12n);
const scale=(v,n)=>v.map(x=>multiply(x,n));
const add=(a,b)=>a.map((x,i)=>(x+b[i])|0),subtract=(a,b)=>a.map((x,i)=>(x-b[i])|0);
const divide=(a,b)=>signed(((BigInt(a)<<32n)/BigInt(b)+0x80000n)>>20n);
const pointOf=node=>Array.isArray(node?.position)&&node.position.length===3&&node.position.every(x=>Number.isInteger(x)&&x>=-32768&&x<=32767)?node.position.map(x=>x<<12):null;
const unresolved=reason=>({resolved:false,geometryEligible:null,reason,atConsumed:0,creationResolved:false,visibilityUsed:false});
const finished=(geometryEligible,reason,extra={})=>({resolved:true,geometryEligible,reason,atConsumed:0,creationResolved:false,visibilityUsed:false,...extra});
function isqrt(n){if(n<2n)return n;let x=1n<<BigInt((n.toString(2).length+1)>>1);for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
const fixedSqrt=x=>x<=0?0:Number((isqrt(BigInt(x)<<32n)+0x200n)>>10n);

// 02030fa0. Its divisions use020c47bc/020c4728, not normalize020c49e4.
function closestSegment(a,b,p){
 const ab=fieldNativeDistance(a,b),ap=fieldNativeDistance(a,p);
 if(ab===null||ap===null)return null;
 if(ab===0)return {point:p,distance:ap,branch:'zero-segment'};
 if(ap===0)return {point:p,distance:0,branch:'at-selected-node'};
 const abUnit=scale(subtract(b,a),divide(4096,ab)),apUnit=scale(subtract(p,a),divide(4096,ap));
 const cosine=fieldNativeDot(abUnit,apUnit);
 if(cosine<1)return {point:a,distance:ap,branch:'selected-end'};
 const projection=multiply(ap,cosine);
 if(ab<projection){const distance=fieldNativeDistance(p,b);return distance===null?null:{point:b,distance,branch:'current-end'};}
 const point=add(a,scale(abUnit,projection)),distance=fieldNativeDistance(p,point);
 return distance===null?null:{point,distance,branch:'interior'};
}

/** Derive only the candidate point before party/actor/node-flag gates. The
 * returned point is not a created actor position; native creation may adjust it.
 */
export function deriveFieldSpawnPoint({pointQueryReached,selectedNodeId,currentNodeIndex,playerPosition,graph}={}){
 if(pointQueryReached!==true)return unresolved('selected-node path reachability unknown');
 if(!Number.isInteger(selectedNodeId))return unresolved('selected node unknown');
 if(selectedNodeId<0)return finished(false,'no-selected-node');
 if(!xyz(playerPosition)||!Array.isArray(graph?.nodes)||!Number.isInteger(currentNodeIndex))return unresolved('effective player position/current graph unknown');
 const selected=graph.nodes.find(n=>n.id===selectedNodeId),current=graph.nodes[currentNodeIndex];
 if(!selected||!current)return unresolved('selected/current node lookup unresolved');
 const a=pointOf(selected),b=pointOf(current);if(!a||!b)return unresolved('node position unresolved');
 const selectedDistance=fieldNativeDistance(a,playerPosition);if(selectedDistance===null)return unresolved('point distance outside supported integer domain');
 let point=a,segment=null,extent=null;
 if(selected!==current&&selectedDistance>0xa000){
  segment=closestSegment(a,b,playerPosition);if(!segment)return unresolved('segment arithmetic outside supported integer domain');
  if(segment.distance>0){
   if(segment.distance>=0xa000)return finished(false,'segment-distance-at-least-0xa000',{selectedNodeId,currentNodeIndex,selectedDistance,segment});
   extent=multiply(fixedSqrt(4096-divide(multiply(segment.distance,segment.distance),0x64000)),0xa000);
   if(extent>0x5000){
    const direction=subtract(a,segment.point),length=fieldNativeDistance(direction,[0,0,0]),unit=fieldNativeNormalize(direction);
    if(length===null||!unit)return unresolved('candidate interpolation normalization unresolved');
    point=add(segment.point,scale(unit,Math.min(length,extent)));
   }
  }
 }
 return {resolved:true,geometryEligible:null,reason:'candidate-point-derived',selectedNodeId,currentNodeIndex,selectedDistance,segment,extent,point,
  atConsumed:0,creationResolved:false,visibilityUsed:false};
}

/** 02074f88 scans typed party slots0..3. No active/visibility filter exists.
 * Effective XYZ must already resolve02033c3c. Non-default alternate map/anchor
 * paths remain suspended, even if a plausible raw coordinate is supplied.
 */
export function fieldPartyProximity(parties,point,fieldMapId){
 if(!xyz(point)||!u16(fieldMapId)||!Array.isArray(parties?.slots))return {resolved:false,tooClose:null,reason:'effective party inventory unknown'};
 const bySlot=new Map();for(const r of parties.slots){if(bySlot.has(r.slot))throw Error('Duplicate party slot');bySlot.set(r.slot,r);}
 const checks=[],unknown=[];
 for(let slot=0;slot<4;slot++){
  const r=bySlot.get(slot);
  if(r?.registryKnown!==true||!u32(r.pointer)){unknown.push(slot);continue;}
  if(r.pointer===0){checks.push({slot,present:false});continue;}
  if(!u16(r.headerFlags)){unknown.push(slot);continue;}
  if(!(r.headerFlags&0x800)){checks.push({slot,typedParty:false});continue;}
  if(r.alternateMap!==0xffffffff){unknown.push(slot);continue;}
  if(!u16(r.mapId)){unknown.push(slot);continue;}
  if(r.mapId!==fieldMapId){checks.push({slot,mapMatches:false});continue;}
  if(r.effectivePositionResolved!==true||!xyz(r.effectivePosition)){unknown.push(slot);continue;}
  const distance=fieldNativeDistance(point,r.effectivePosition);if(distance===null){unknown.push(slot);continue;}
  checks.push({slot,mapMatches:true,distance,tooClose:distance<0x3800});
  if(distance<0x3800)return {resolved:true,tooClose:true,knownCloseSlot:slot,firstCloseSlot:unknown.length?null:slot,checks,unknown};
 }
 return {resolved:unknown.length===0,tooClose:unknown.length?null:false,checks,unknown,reason:unknown.length?'party effective position/map/anchor unresolved':'party distances resolved'};
}

/** Generic registry records + active bit only. Species sign and header type are
 * not this overlap predicate. A known blocker proves rejection; missing records
 * prevent a no-overlap conclusion. Box faces are inclusive signed comparisons.
 */
export function fieldPointOverlap(inventory,point,group){
 if(!xyz(point)||!Number.isInteger(group)||group<0||group>3||!Array.isArray(inventory?.slots))return {resolved:false,overlaps:null,reason:'overlap pool unknown'};
 const bySlot=new Map();for(const r of inventory.slots){if(bySlot.has(r.slot))throw Error('Duplicate inventory slot');bySlot.set(r.slot,r);}
 const checks=[],unknown=[],half=[0x3000,0x5000,0x3000],minimum=point.map((x,i)=>(x-half[i])|0),maximum=point.map((x,i)=>(x+half[i])|0);
 for(let slot=112+12*group;slot<124+12*group;slot++){
  const r=describeInventorySlot(bySlot.get(slot)??{slot,registryKnown:false});
  if(r.allocated===false||r.active===false){checks.push({slot,eligible:false});continue;}
  if(r.allocated!==true||r.active!==true||!xyz(r.xyz)){unknown.push(slot);continue;}
  const overlaps=r.xyz.every((x,i)=>x>=minimum[i]&&x<=maximum[i]);checks.push({slot,eligible:true,overlaps});
  if(overlaps)return {resolved:true,overlaps:true,knownBlockingSlot:slot,firstBlockingSlot:unknown.length?null:slot,checks,unknown,minimum,maximum};
 }
 return {resolved:unknown.length===0,overlaps:unknown.length?null:false,checks,unknown,minimum,maximum,reason:unknown.length?'active pool position unresolved':'overlap scan resolved'};
}

/** No AT draw or entity creation is performed. Runtime node flags cannot be
 * replaced by static resource initialFlags. Complete natural pools do not imply
 * complete world coverage; callers retain separate time/order/input hypotheses.
 */
export function evaluateFieldSpawnPoint(input={}){
 const candidate=deriveFieldSpawnPoint(input);if(!candidate.resolved||candidate.geometryEligible===false)return candidate;
 if(!u16(input.fieldMapId)||!u16(input.fieldFlags))return {...unresolved('field map/group unknown'),candidate};
 const proximity=fieldPartyProximity(input.parties,candidate.point,input.fieldMapId);
 if(!proximity.resolved)return {...unresolved(proximity.reason),candidate,proximity};
 if(proximity.tooClose)return finished(false,'party-too-close',{candidate,proximity,nativeNodeAfterFirstProximity:input.graph.nodes.length>4?-1:input.selectedNodeId});
 const overlap=fieldPointOverlap(input.inventory,candidate.point,input.fieldFlags&3);
 if(!overlap.resolved)return {...unresolved(overlap.reason),candidate,proximity,overlap};
 if(overlap.overlaps)return finished(false,'active-record-overlap',{candidate,proximity,overlap});
 const selectedIndex=input.graph.nodes.findIndex(n=>n.id===input.selectedNodeId),flags=input.runtimeNodeFlags?.[selectedIndex];
 if(!Number.isInteger(flags)||flags<0||flags>255)return {...unresolved('selected-node runtime flags unknown'),candidate,proximity,overlap};
 if(flags&2)return finished(false,'node-flag-bit1',{candidate,proximity,overlap,nodeFlags:flags});
 const areaMask=input.graph.nodes[selectedIndex].areaMask;
 if(!Number.isInteger(areaMask)||areaMask<0||areaMask>255)return {...unresolved('node area mask unknown'),candidate,proximity,overlap};
 return finished(true,'table-gate-reached',{candidate,point:candidate.point,selectedNodeId:input.selectedNodeId,areaMask,nodeFlags:flags,proximity,overlap,
  remaining:'table/weighted AT, creation acceptance and created-position adjustment remain owned by later stages'});
}
