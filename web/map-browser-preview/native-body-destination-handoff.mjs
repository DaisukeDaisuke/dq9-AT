// Same-frame CPU source-render handoff only. No final-RGB inversion, cross-frame
// source cache, GPU substitution or exported raw planes in appearance evidence.
import {bindNativeBodyDestination} from '../monster-native-scene-composition.mjs?v=native-raster-reuse-20261006-0637';
import {readNaturalBodySceneOrder} from '../monster-native-scene-order.mjs';
import {readFrozenMonsterFog} from '../monster-source-fog.mjs';
import {readArm9Overlay} from './rom-overlay.mjs';
import {readInitialTexturedBlendProfile} from './integer/native-textured-translucent.mjs?v=native-raster-reuse-20261006-0637';
const N=49152,need=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const frameKeys=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
function frameOf(frame,romSHA256,recordKey){return Object.fromEntries(frameKeys.map(k=>[k,k==='romSHA256'?romSHA256:k==='recordKey'?recordKey:k==='mediaTime'?(frame.mediaTime??frame.videoTime):frame[k]]));}
function validFrame(frame){need(['romSHA256','fullRGBA_SHA256'].every(k=>/^[a-f0-9]{64}$/.test(frame[k]??''))&&typeof frame.recordKey==='string'&&typeof frame.sourceId==='string'&&frame.sourceId.length>0&&['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(frame[k])&&frame[k]>=0)&&Number.isFinite(frame.mediaTime)&&frame.mediaTime>=0,'Exact frozen source frame required');}
function cameraOf(branch){return{viewFx:branch.viewFx.slice(),projectionFx:branch.projectionFx.slice()};}
function plain(value){if(ArrayBuffer.isView(value))return Array.from(value);if(Array.isArray(value))return value.map(plain);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,plain(value[k])]));return value;}
async function integrity(value){
 if(ArrayBuffer.isView(value))return{type:value.constructor.name,length:value.length,sha256:await sha(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
 if(Array.isArray(value))return Promise.all(value.map(integrity));
 if(value&&typeof value==='object'){const entries=await Promise.all(Object.keys(value).sort().map(async k=>[k,await integrity(value[k])]));return Object.fromEntries(entries);}
 return value;
}
const payloadHash=async value=>sha(new TextEncoder().encode(JSON.stringify(await integrity(value))));
const bytes=value=>ArrayBuffer.isView(value)?value.byteLength:Array.isArray(value)?value.reduce((n,v)=>n+bytes(v),0):value&&typeof value==='object'?Object.values(value).reduce((n,v)=>n+bytes(v),0):0;
// This one-frame mailbox prevents the planes from being copied into every DINO
// appearance batch or saved observation bundle. Only the native projection
// resolves it. A new frozen frame drops all prior mailbox entries. Already
// projected native requests own their copies for same-frame continuation.
let currentFrameKey=null,generation=0;const handoffs=new Map();
export function beginNativeBodyDestinationHandoffFrame(frame,romSHA256){const key=JSON.stringify([romSHA256,...['sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'].map(k=>k==='mediaTime'?(frame?.mediaTime??frame?.videoTime):frame?.[k])]);handoffs.clear();currentFrameKey=key;return{key,generation:++generation};}
export function clearNativeBodyDestinationHandoffs(){handoffs.clear();currentFrameKey=null;generation++;}

export async function retainNativeBodyDestinationHandoff({image,branchId,recordKey,frameEvidence,romSHA256,camera,comparison,sourceEnvironment,handoffLease}){
 if(!image?.bodyDestination)return null;
 try{
  need(handoffLease?.key===currentFrameKey&&handoffLease?.generation===generation,'Background handoff frame was superseded');
  const frame=frameOf(frameEvidence,romSHA256,recordKey);validFrame(frame);
  need(image.nativeWords==null&&!String(image.backend??'').startsWith('webgpu'),'GPU output is not a retained CPU source destination');
  need(image.ready===true&&image.basisOnly===false&&image.snapshot?.profile==='ROM-mode2-inverse-source-hypothesis'&&image.snapshot.basisLabel===null,'Only a final source mode2 CPU render may be handed off');
  need(sourceEnvironment?.fogApplied===true&&sourceEnvironment.mode2Inputs&&same(image.snapshot.inputs,sourceEnvironment.mode2Inputs),'Final source environment differs');
  need(image.snapshot.recordKey===recordKey&&same(camera,{viewFx:image.snapshot.viewFx,projectionFx:image.snapshot.projectionFx}),'Final source camera differs');
  need(image.rgba?.length===N*4&&image.knownMask?.length===N&&comparison?.alignedBackground?.length===N*4&&comparison.validMask?.length===N,'Exact renderer and compared source planes required');
  // Exercise the same actual binding now; do not certify from availability flags.
  bindNativeBodyDestination(image.bodyDestination,{frame,camera,alignment:comparison.alignment.applied,reconstructedRGBA:image.rgba,backgroundRGBA:comparison.alignedBackground,validMask:comparison.validMask});
  const payload={kind:'same-frame-source-native-destination-reuse-v1',producer:'source-mode2-final-render',frame,branchId,camera:structuredClone(camera),alignment:{...comparison.alignment.applied},mode2Inputs:structuredClone(sourceEnvironment.mode2Inputs),backgroundSHA256:await sha(comparison.alignedBackground),validMaskSHA256:await sha(comparison.validMask),renderedRGBA:image.rgba.slice(),renderedKnownMask:image.knownMask.slice(),destination:structuredClone(image.bodyDestination)},envelope={payload,integritySHA256:await payloadHash(payload)},token=crypto.randomUUID();
  const reference={kind:'same-frame-native-destination-handoff-reference-v1',token,integritySHA256:envelope.integritySHA256,retainedBytes:bytes(payload),rawPlanesExported:false};if(handoffLease.key!==currentFrameKey||handoffLease.generation!==generation)return null;handoffs.set(token,envelope);return reference;
 }catch{return null;}
}
/** Synchronous projection into the native request only. Worker adoption does all
 * source/byte validation. Projected continuation requests retain their envelope;
 * old lightweight references cannot obtain planes from another frame. */
export function projectNativeBodyDestinationHandoff(branch,{frame,romSHA256}){
 if(branch.nativeBodyDestinationReuse?.payload?.kind==='same-frame-source-native-destination-reuse-v1')return branch.nativeBodyDestinationReuse;
 const ref=branch.nativeBodyDestinationRef,envelope=ref&&handoffs.get(ref.token);if(!envelope||ref.integritySHA256!==envelope.integritySHA256)return null;
 const p=envelope.payload,expected=frameOf(frame,romSHA256,branch.recordKey);
 if(!same(p.frame,expected)||p.branchId!==branch.branchId||!same(p.camera,cameraOf(branch))||!same(p.alignment,branch.alignment)||!same(p.mode2Inputs,branch.sourceEnvironment?.mode2Inputs)||p.backgroundSHA256!==branch.alignedBackgroundRGBA_SHA256)return null;
 return envelope;
}
function validatePlanes(d){
 need(d?.kind==='source-prefog-opaque-body-destination-v1','Original pre-fog source planes required');
 for(const[k,T,n]of[['rgba6665',Uint8Array,N*4],['depth24',Uint32Array,N],['owner',Int32Array,N],['frontFacing',Uint8Array,N],['knownMask',Uint8Array,N],['sourceFogMask',Uint8Array,N],['opaqueId',Uint8Array,N],['unknownOrderMask',Uint8Array,N]])need(d[k]instanceof T&&d[k].length===n,'Source plane type/size differs: '+k);
 for(let i=0;i<N;i++){need((!d.knownMask[i]||(d.rgba6665[i*4+3]===31&&d.owner[i]>=0))&&d.depth24[i]<=0xffffff&&d.frontFacing[i]<=1&&d.knownMask[i]<=1&&d.sourceFogMask[i]<=1&&d.opaqueId[i]<64&&d.unknownOrderMask[i]<=1,'Source plane value outside native domain');for(let c=0;c<4;c++)need(d.rgba6665[i*4+c]<=(c===3?31:63),'Source RGBA6665 range differs');}
 const s=d.mapFragments;need(s?.offsets instanceof Uint32Array&&s.offsets.length===N+1&&s.words instanceof Uint32Array&&s.words.length%4===0&&s.fragmentCount===s.words.length/4&&s.offsets[0]===0&&s.offsets[N]===s.fragmentCount&&s.retainedBytes===s.offsets.byteLength+s.words.byteLength&&s.retainedBytes<=16*1024*1024,'Original compact map stream required');
 for(let i=0;i<N;i++)need(s.offsets[i]<=s.offsets[i+1]&&s.offsets[i+1]<=s.fragmentCount,'Map stream offsets differ');
 for(let i=0;i<s.words.length;i+=4){const attr=s.words[i+1],c=s.words[i+3];need((attr>>>4&3)===0&&(attr>>>16&31)>0&&!(attr&0x4800)&&s.words[i+2]<=0xffffff&&(c&255)<=63&&(c>>>8&255)<=63&&(c>>>16&255)<=63&&(c>>>24&31)>0&&(c>>>30)===0,'Map stream outside admitted native domain');}
}
/** Missing, expired or unverified input returns ready:false and must fall back
 * to ordinary source reconstruction. Never manufacture native state from RGB. */
export async function adoptNativeBodyDestinationHandoff({envelope,project,rom,record,branch,frame,assertCurrent=()=>{}}){
 const start=performance.now();try{
  assertCurrent();if(!envelope)return{ready:false,reason:'Same-frame source destination handoff absent'};
  const p=envelope.payload;need(p?.kind==='same-frame-source-native-destination-reuse-v1'&&p.producer==='source-mode2-final-render','Source destination handoff producer absent');validFrame(frame);
  need(same(p.frame,frameOf(frame,frame.romSHA256,record.key))&&p.branchId===branch.branchId&&record.key===branch.recordKey,'Source destination frame/branch differs');
  need(same(p.camera,cameraOf(branch))&&same(p.alignment,branch.alignment)&&branch.sourceEnvironment?.fogApplied===true&&same(p.mode2Inputs,branch.sourceEnvironment.mode2Inputs),'Source destination camera/environment differs');
  need(p.renderedRGBA instanceof Uint8ClampedArray&&p.renderedRGBA.length===N*4&&p.renderedKnownMask instanceof Uint8Array&&p.renderedKnownMask.length===N,'Original final-render planes absent');
  need(await sha(branch.backgroundRGBA)===p.backgroundSHA256&&await sha(branch.validMask)===p.validMaskSHA256,'Frozen background or valid-mask bytes differ');assertCurrent();
  validatePlanes(p.destination);need(await payloadHash(p)===envelope.integritySHA256,'Source destination payload integrity differs');assertCurrent();
  const d=p.destination;need(d.recordKey===record.key&&d.snapshot?.profile==='ROM-mode2-inverse-source-hypothesis'&&d.snapshot.basisLabel===null&&same(d.snapshot.inputs,p.mode2Inputs)&&same(p.camera,{viewFx:d.snapshot.viewFx,projectionFx:d.snapshot.projectionFx}),'Source destination snapshot differs');
  need(same(plain(d.sourceOrder),plain(readNaturalBodySceneOrder({sdk:project.sdk,fieldOverlay:readArm9Overlay(rom,17)}))),'Source native draw-order guards differ');
  need(same(plain(d.controls),plain(readInitialTexturedBlendProfile(project,rom))),'Source native alpha controls differ');
  const fog=readFrozenMonsterFog({project,record,inputs:p.mode2Inputs,frame,backgroundFrame:frame});need(same(plain(d.sourceFogParameters),plain(fog.parameters)),'Source fog parameters differ');assertCurrent();
  const destination=bindNativeBodyDestination(d,{frame,camera:p.camera,alignment:p.alignment,reconstructedRGBA:p.renderedRGBA,backgroundRGBA:branch.backgroundRGBA,validMask:branch.validMask});assertCurrent();
  return{ready:true,destination,evidence:{kind:'validated-same-frame-background-source-reuse',integritySHA256:envelope.integritySHA256,retainedBytes:bytes(p),verificationMs:performance.now()-start,reconstructed:false}};
 }catch(error){if(error.name==='AbortError')throw error;return{ready:false,reason:error.message};}
}
