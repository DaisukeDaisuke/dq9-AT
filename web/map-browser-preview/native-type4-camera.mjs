// Source-derived, conditional ordinary type4 camera adapter. No scene-specific parameters.
import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {parseCalls,decodeNumber} from './vendor/call-stream.mjs';
import {planRomScene} from './rom-scene-plan.mjs';
import {readArm9Overlay,readInitialFieldPlayerHeight} from './rom-overlay.mjs';
import {readRomInitialCamera} from './rom-initial-camera.mjs';
import {fxNormalize,fxDot,fxDiv,integerSqrt,followTargetFx,buildEyeFx,lookAtFx,fovHalfAngleFx,perspectiveFx} from './native/native-camera-fx.mjs';

const SOURCE_SPANS=[
 ['sdk',0x0201d2bc,0x108,0x9d5bcafc], // opcode73 box producer
 ['sdk',0x0201d3c4,0x7c,0xfa565744], // opcode74 dispatch by region kind
 ['sdk',0x0201d79c,0x180,0x7214f89f], // type4 configuration producer
 ['sdk',0x0201e49c,0xf8,0xcea4c781], // prepended native region list
 ['sdk',0x020967ec,0x140,0x7a0a88a2], // containment and runtime one-shot flags
 ['sdk',0x02031d18,0xe0,0x9026bcc3], // box region test
 ['sdk',0x02030c50,0x70,0x48cb5bfa], // inclusive axis-aligned bounds
 ['sdk',0x020a4680,0x230,0x022b92ca], // copy setter and actor-dependent blend
 ['sdk',0x02031c5c,0x24,0x86e5a056], // signed plane distance
 ['sdk',0x02030810,0x58,0xe4756f3d], // shortest yaw delta and abs
 ['sdk',0x02030964,0x5c,0x2d2cb501], // per-component rounded scale
 ['sdk',0x02030a68,0x98,0x78c507ca], // native yaw normalization
 ['sdk',0x020c485c,0x29c,0x00b1d877], // vector arithmetic, magnitude, normalize
 ['sdk',0x02030644,0xf4,0xb491cc12], // typed args -> FX32
 ['sdk',0x020a4154,0xac,0x410a97fb], // base target + actor height, then type4 blend
 ['overlay17',0x02198e5c,0x134,0x8f43108a], // first containing region and mode4 setter
];
const planState=new WeakMap();
const i32=x=>Number(BigInt.asIntN(32,BigInt(x)));
const fxMul=(a,b)=>i32((BigInt(a)*BigInt(b)+2048n)>>12n);
const finiteI32=x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647;
const unknown=reason=>({ready:false,reason,currentCameraCertified:false,currentActorCertified:false,minimumProvenATCalls:0});
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function fxNumber(x){if(!Number.isFinite(x))throw Error('Non-numeric type4 argument');const f=Math.trunc(Math.fround(Math.fround(x)*4096));if(!finiteI32(f))throw Error('Type4 argument exceeds FX32');return f;}
function verify(project,rom){
 const ov=readArm9Overlay(rom,17);
 for(const [segment,address,length,expected] of SOURCE_SPANS){let h=2166136261;for(const b of(segment==='sdk'?project.sdk:ov).read(address,length))h=Math.imul(h^b,16777619)>>>0;if(h!==expected)throw Error('Native type4 source differs at '+address.toString(16));}
 return SOURCE_SPANS.map(([segment,address,length,fingerprint])=>({segment,address,length,fingerprint}));
}
/** Pure producer arithmetic. Accepts decoded numeric source arguments, never image-tuned values. */
export function deriveNativeType4Configuration(values){
 if(!Array.isArray(values)||values.length!==15||!values.every(Number.isFinite))throw Error('Mode4 requires exactly 15 numeric source arguments');
 if(values[0]!==4)throw Error('Only native camera mode4 is implemented');
 if(!Number.isInteger(values[1])||!Number.isInteger(values[2]))throw Error('Native mode4 flags require integer arguments');
 const aFx=values.slice(3,6).map(fxNumber),bFx=values.slice(6,9).map(fxNumber),delta=bFx.map((v,i)=>i32(v-aFx[i]));
 if(delta.every(x=>x===0))throw Error('Degenerate type4 A/B plane');
 const square=delta.reduce((s,x)=>s+BigInt(x)*BigInt(x),0n);if(square>0x0fffffffffffffffn)throw Error('Type4 length exceeds supported signed magnitude range');
 const normalFx=fxNormalize(delta),lengthFx=i32((integerSqrt(square*4n)+1n)>>1n);
 if(lengthFx<=0)throw Error('Nonpositive type4 blend length');
 const orbitFx=values.slice(9,12).map(fxNumber),offsetFx=values.slice(12,15).map(fxNumber);
 if(orbitFx[0]<0||orbitFx[0]>25736)throw Error('Type4 yaw outside normalized source domain');
 if(orbitFx[2]<=0||Math.abs(orbitFx[1])>orbitFx[2])throw Error('Invalid type4 orbit radius/height');
 return {mode:4,auxByte:values[1]&255,allowShoulderBit:values[2]&1,aFx,bFx,normalFx,planeFx:fxDot(normalFx,aFx),lengthFx,orbitFx,offsetFx};
}
function shortestYaw(from,to){let d=to-from;if(from<to&&d>12868)d-=25736;else if(to<from&&d< -12868)d+=25736;return d;}
function nativeNormalizeYaw(x){if(x<0){const q=(fxDiv(-x,25736)+4096)&-4096;return i32(x+fxMul(q,25736));}if(x>25736){const q=fxDiv(x,25736)&-4096;return i32(x-fxMul(q,25736));}return x;}
/** Matches 020a4714 for flags=4, explicit base orbit and target, without later transitions. */
export function blendNativeType4Camera(config,{actorFx,baseOrbitFx,baseTargetFx}){
 if(![actorFx,baseOrbitFx,baseTargetFx].every(a=>Array.isArray(a)&&a.length===3&&a.every(finiteI32)))throw Error('Explicit FX32 actor, base orbit and base target are required');
 const signedDistanceFx=i32(fxDot(config.normalFx,actorFx)-config.planeFx);
 if(signedDistanceFx<=0)return {applied:false,blendFx:0,signedDistanceFx,orbitFx:[...baseOrbitFx],targetFx:[...baseTargetFx]};
 const blendFx=Math.min(4096,fxDiv(signedDistanceFx,config.lengthFx)),inv=4096-blendFx;
 const orbitFx=[nativeNormalizeYaw(i32(baseOrbitFx[0]+fxMul(shortestYaw(baseOrbitFx[0],config.orbitFx[0]),blendFx))),i32(fxMul(baseOrbitFx[1],inv)+fxMul(config.orbitFx[1],blendFx)),i32(fxMul(baseOrbitFx[2],inv)+fxMul(config.orbitFx[2],blendFx))];
 // Native does two separately rounded multiplies; simplifying to base + t*offset changes words.
 const targetFx=baseTargetFx.map((x,i)=>i32(fxMul(x,inv)+fxMul(i32(x+config.offsetFx[i]),blendFx)));
 return {applied:true,blendFx,signedDistanceFx,orbitFx,targetFx};
}
function sourceBox(values){
 if(values.length!==9||!values.every(Number.isFinite))throw Error('Only exact opcode73 box argument shape is implemented');
 const centerFx=values.slice(1,4).map(fxNumber),sizeFx=values.slice(4,7).map(fxNumber),rotationFx=fxNumber(values[7]);
 if(rotationFx!==0)throw Error('Rotated type4 region is not implemented');
 if(sizeFx.some(x=>x<=0))throw Error('Cylinder/degenerate type4 region is not implemented');
 return {centerFx,sizeFx,rotationFx,minFx:centerFx.map((x,i)=>i32(x-(sizeFx[i]>>1))),maxFx:centerFx.map((x,i)=>i32(x+(sizeFx[i]>>1))),nativeFlags:0};
}
/** Read once for repeated source-surface inverse evaluations. This is a conditional source initial state. */
export function readNativeType4Plan(project,rom,record){
 try{
  if(!project?.sdk||!project?.nfs||!(rom instanceof Uint8Array))return unknown('ROM project/bytes unavailable');
  const sourceGuards=verify(project,rom),scene=planRomScene(project,record);
  if(!scene.amblRequest.supported)return unknown(scene.amblRequest.reason??'Source AMBL request unresolved');
  const z=Narc.load(new Uint8Array(project.nfs.readFile(scene.amblRequest.path))),regions=[],unresolved=[],inlineMembers=new Set();
  for(let i=0;i<z.files.length;i++){
   const member=z.fnt.getFilenameOf(i);if(!member.toLowerCase().endsWith('.bmbl'))continue;
   const raw=z.files[i],bytes=raw[0]===16?new Uint8Array(Compression.decompress(new BufferReader(raw.buffer,raw.byteOffset,raw.length))):raw;
   let selected=null;
   for(const call of parseCalls(bytes)){
    const values=call.args.map(decodeNumber);
    if(call.opcode===0x73||call.opcode===0x6b){
     if(call.opcode===0x6b)inlineMembers.add(member);
     const kind=call.opcode===0x6b&&values[0]>=10?values[0]-10:values[0];
     selected=kind===4?{source:{archive:scene.amblRequest.path,member,callIndex:call.index,callOffset:call.offset,opcode:call.opcode},values,configurations:[],ready:false}:null;
     if(selected){regions.push(selected);try{if(call.opcode!==0x73)throw Error('Inline opcode6b type4 producer is not implemented');selected.box=sourceBox(values);}catch(e){selected.reason=e.message;}}
    }else if(call.opcode===0x74&&selected){
     const c={callIndex:call.index,callOffset:call.offset,values};selected.configurations.push(c);selected.configuration=null;selected.ready=false;
     try{selected.configuration=deriveNativeType4Configuration(values);selected.ready=!!selected.box;if(selected.ready)delete selected.reason;}catch(e){selected.reason=e.message;}
    }
   }
  }
  if(!regions.length)return unknown('No source type4 camera regions');
  const members=[...new Set(regions.map(r=>r.source.member))];if(members.some(m=>inlineMembers.has(m)))unresolved.push('Mixed inline opcode6b/selected opcode73 camera source domain is not implemented');if(members.length!==1)unresolved.push('Type4 regions span multiple BMBL load domains; current stream selection is not reconstructed');
  for(const r of regions)if(!r.ready)unresolved.push(r.source.member+'@'+r.source.callOffset+': '+(r.reason??'No supported camera configuration'));
  const preset=readRomInitialCamera(project.sdk,record.cameraSelector),height=readInitialFieldPlayerHeight(rom),raw=project.sdk.read(0x020e955c,16384),data=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),trig=i=>[data.getInt16(i*4,true),data.getInt16(i*4+2,true)];
  const plan={ready:unresolved.length===0,kind:'source-initial-type4-camera-plan',recordKey:record.key,mapId:record.mapId,preset,initialActorHeightFx:height.heightFx,regions,unresolved,sourceGuards,assumptions:['Source initial region records, no script mutation or one-shot history','Ordinary source camera preset, supplied base yaw, initial actor height and zero follow offset','No camera follow smoothing, shake, distance/height transition or later scripted camera override'],currentCameraCertified:false,currentActorCertified:false,minimumProvenATCalls:0};
  if(!plan.ready)plan.reason=unresolved.join('; ');freeze(plan);planState.set(plan,{trig});return plan;
 }catch(e){return unknown(e.message);}
}
/** Actor XYZ and base yaw are hypotheses supplied by the caller, not observed by this adapter. */
export function cameraAtSourcePoint(plan,point){
 try{
  const state=planState.get(plan);if(!state||!plan.ready)return unknown(plan?.reason??'Verified type4 plan required');
  const {xFx,yFx,zFx,yawDegrees}=point??{};if(![xFx,yFx,zFx].every(finiteI32)||!Number.isFinite(yawDegrees))return unknown('Explicit actor XYZ FX32 and base yaw hypothesis required');
  if(point.cameraTransitionState!=null&&point.cameraTransitionState!=='none')return unknown('Requested camera transition state is not implemented');
  const actorFx=[xFx,yFx,zFx],yawFx=Math.round((((yawDegrees%360)+360)%360)/360*25736),p=plan.preset,baseOrbitFx=[yawFx,p.orbitHeightFx,p.radiusFx],baseTargetFx=followTargetFx(actorFx,plan.initialActorHeightFx);
  const rows=plan.regions.map(r=>({region:r,contains:actorFx.every((x,i)=>x>=r.box.minFx[i]&&x<=r.box.maxFx[i])}));
  // 0201e49c prepends: last authored record is visited first by 02198e5c.
  const selected=rows.slice().reverse().find(r=>r.contains),blend=selected?blendNativeType4Camera(selected.region.configuration,{actorFx,baseOrbitFx,baseTargetFx}):{applied:false,blendFx:0,orbitFx:baseOrbitFx,targetFx:baseTargetFx};
  const orbit=buildEyeFx({target:blend.targetFx,yawFx:blend.orbitFx[0],heightFx:blend.orbitFx[1],radiusFx:blend.orbitFx[2]},state.trig),view=lookAtFx(orbit.eye,p.upFx,blend.targetFx),fov=fovHalfAngleFx(p.halfFovFx,state.trig);
  return {ready:true,viewFx:[...view.slice(0,3),0,...view.slice(3,6),0,...view.slice(6,9),0,...view.slice(9,12),4096],projectionFx:perspectiveFx({...fov,aspectFx:p.aspectFx,nearFx:p.nearFx,farFx:p.farFx}),eyeFx:orbit.eye,targetFx:blend.targetFx,preset:p,type4:{kind:'conditional-source-type4-camera',actorFx,baseOrbitFx,baseTargetFx,selectedSource:selected?.region.source??null,regionAlternatives:rows.map(r=>({source:r.region.source,contains:r.contains})),...blend,assumptions:plan.assumptions},currentCameraCertified:false,currentActorCertified:false,minimumProvenATCalls:0,scope:'ROM-native initial mode4 region selection and position-dependent blend at explicit actor XYZ/base-yaw hypotheses. Unsupported modes and transitions are held; this does not identify a current camera or actor.'};
 }catch(e){return unknown(e.message);}
}
