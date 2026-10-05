/* SPDX-License-Identifier: GPL-2.0-or-later
 * DeSmuME contributors, 535f676: GFX3D_GenerateRenderLists, _pixel,
 * alphaBlend and fog postprocess. Conditional source scene/body composition.
 * No reconstruction from final RGB; no live actor, MSE or ordering assertion.
 */
import {compositeBinaryAwareDepth} from './map-browser-preview/integer/native-binary-alpha.mjs?v=destination-reuse-20261006-0501';
import {applyFogPixel} from './map-browser-preview/native/fog-raster.mjs';
import {presentStaticRgb} from './map-browser-preview/integer/static-mode0-rgb.mjs?v=destination-reuse-20261006-0501';
import {projectNativePrimitiveFx} from './map-browser-preview/integer/native-primitive-inputs.mjs';
import {clipNativePositionPolygon} from './map-browser-preview/integer/native-position-clip.mjs?v=destination-reuse-20261006-0501';
const N=256*192,need=(ok,why)=>{if(!ok)throw Error(why);};

/** Keep source opaque framebuffer state BEFORE map translucency/fog. A map
 * translucent fragment with positive alpha makes that cell order-unknown
 * without a guarded ordinary map-before-natural-body route, unless it is strictly behind the original opaque depth and therefore
 * cannot become accepted when actor writes only retain/decrease that depth. This deliberately
 * avoids guessing where actor drawing sits among map/MSE submissions. With
 * the guarded route, compact map fragments are replayed before actor
 * translucent polygons; requested MSE still makes its unknown footprint unsafe. */
export function prepareNativeBodyDestination({rgb,inventory,translucent,participants,controls,screenEffectPlan,rasterRejected=[],sourceOrder=null}){
 need(rgb?.rgba6665?.length===N*4&&rgb.plane?.coverage?.length===N&&inventory?.polygons&&Array.isArray(participants),'Source opaque RGB/ownership and original map polygons required');
 need(controls?.translucentSortMode==='manual-source-order'&&typeof controls.alphaBlendEnabled==='boolean'&&controls.alphaTestEnabled===false&&controls.alphaTestRef===null,'Source manual-order/alpha controls required');
 if(sourceOrder)need(sourceOrder.kind==='source-ordinary-map-before-natural-body-v1','Unsupported actor/map source order');
 const sourceTranslucent=new Map(translucent.polygons.map(p=>[p.index,p])),mapParticipants=participants.map(p=>({...p,attribute:sourceTranslucent.get(p.index)?.materialEvidence.polygonAttribute}));
 const unknownReasons=[],unknownOrderMask=new Uint8Array(N),sourceFogMask=new Uint8Array(N),opaqueId=new Uint8Array(N),knownMask=new Uint8Array(N),attributes=new Map(inventory.polygons.map(p=>[p.index,p.materialEvidence?.polygonAttribute]));
 if(!sourceOrder)for(const p of participants)for(const f of p.fragments)if(f.alpha5>0){const i=f.y*256+f.x;if(!rgb.plane.coverage[i]||f.depth24<=rgb.plane.depth24[i])unknownOrderMask[i]=1;}
 if(!screenEffectPlan?.ready||screenEffectPlan.request){unknownReasons.push('Source MSE request or request selection remains unresolved; phase/order/overlap not inferred');unknownOrderMask.fill(1);}
 const admitted=new Set(translucent.polygons.map(p=>p.index));
 for(const p of inventory.polygons)if(p.classification==='rejected'&&!admitted.has(p.index)){
  try{const q=projectNativePrimitiveFx(p.primitive,p.positionMatrixFx,p.projectionFx);if(!clipNativePositionPolygon(q.clipVerticesFx).discarded)unknownReasons.push(`Visible unsupported source polygon ${p.index}`);}catch(e){unknownReasons.push(`Source polygon ${p.index}: ${e.message}`);}
 }
 if(inventory.unresolved?.some(x=>typeof x.reason!=='string'||!x.reason.startsWith('name-char3-A / ')))unknownReasons.push('Source instance/dynamic geometry is unresolved');
 if(rasterRejected.length||rgb.polygons?.some(p=>p.rasterRejection))unknownReasons.push('A source map raster participant was not evaluated');
 const globallyUnknown=unknownReasons.some(r=>!r.startsWith('Source MSE'));
 for(let i=0;i<N;i++)if(rgb.plane.coverage[i]&&!rgb.rgbUnavailableMask[i]&&!globallyUnknown){const attr=attributes.get(rgb.plane.owner[i]);need(Number.isInteger(attr)&&(attr>>>16&31)===31,'Source opaque owner attribute missing');knownMask[i]=1;sourceFogMask[i]=attr>>>15&1;opaqueId[i]=attr>>>24&63;}
 const mapFragments=sourceOrder?packNativeMapTranslucentFragments(mapParticipants,rgb.plane):null;
 return{kind:'source-prefog-opaque-body-destination-v1',sourceOrder:sourceOrder?structuredClone(sourceOrder):null,mapFragments,recordKey:inventory.recordKey,snapshot:structuredClone(inventory.snapshot),rgba6665:rgb.rgba6665.slice(),depth24:rgb.plane.depth24.slice(),owner:rgb.plane.owner.slice(),frontFacing:rgb.plane.frontFacing.slice(),knownMask,sourceFogMask,opaqueId,unknownOrderMask,controls:structuredClone(controls),unknownReasons,screenEffectPlan:structuredClone(screenEffectPlan),scope:'Same-source pre-fog opaque destination and optional guarded map-before-natural-body translucent stream. Without source order, potentially accepted map-translucent footprints remain unknown. Requested MSE, unsupported owners and opaque actor/map depth ties remain unknown.'};
}

/** All actor opaque/binary polygons are Y-sorted first; actor translucent-list
 * polygons then keep original SBC/GX order, including their alpha31 texels.
 * Opaque actor/map depth ties are not assigned a fabricated submission order.
 * The subset only scores a COMPLETE proposal: one unknown footprint cell
 * makes the whole proposal unsupported, never a favorable partial score. */
export function composeNativeBodyOverSourceDestination(projected,participants,{destination,fog=null,alignment}){
 need(destination?.kind==='source-prefog-opaque-body-destination-v1','Known source pre-fog destination required');
 need(Number.isInteger(alignment?.dx)&&Number.isInteger(alignment?.dy),'Frozen integer alignment required');
 if('sourceFogParameters'in destination){const normalize=p=>p?{...p,density:Array.from(p.density)}:null;need(JSON.stringify(normalize(destination.sourceFogParameters))===JSON.stringify(normalize(fog?.parameters??null)),'Body/source scene fog differs');}
 if(destination.binding)need(JSON.stringify(destination.binding.camera)===JSON.stringify(projected.transform.camera)&&JSON.stringify(destination.binding.alignment)===JSON.stringify(alignment),'Body/source destination camera or alignment differs');
 const {controls}=destination;need(controls.translucentSortMode==='manual-source-order'&&typeof controls.alphaBlendEnabled==='boolean'&&controls.alphaTestEnabled===false&&controls.alphaTestRef===null,'Admitted source controls required');
 const attrs=new Map(projected.polygons.map(p=>[p.index,p.material.effective.polygonAttribute])),footprint=new Uint8Array(N),unknownMask=new Uint8Array(N),rgba6665=destination.rgba6665.slice(),depth24=destination.depth24.slice(),depthOwner=destination.owner.slice(),colorOwner=destination.owner.slice(),frontFacing=destination.frontFacing.slice(),isFogged=destination.sourceFogMask.slice(),opaqueId=destination.opaqueId.slice(),translucentId=new Uint8Array(N).fill(255),isTranslucentPoly=new Uint8Array(N),changedMask=new Uint8Array(N),colorOwnerIsBody=new Uint8Array(N),depthOwnerIsBody=new Uint8Array(N),stats={incoming:0,depthRejected:0,alphaDiscarded:0,duplicateIdSuppressed:0,blended:0,opaqueWrites:0,depthWrites:0,unknownDestinationPixels:0,unknownOrderPixels:0,opaqueDepthTiePixels:0,bodyFootprintPixels:0};
 for(const p of participants)for(const f of p.fragments)if(f.alpha5>0){const i=f.y*256+f.x;footprint[i]=1;if(!destination.knownMask[i])unknownMask[i]|=1;if(destination.unknownOrderMask[i])unknownMask[i]|=2;}
 const opaque=participants.filter(p=>!p.translucent),plane=compositeBinaryAwareDepth(opaque);
 for(const p of opaque)for(const f of p.fragments){const i=f.y*256+f.x;if(f.alpha5!==31||!plane.coverage[i]||plane.owner[i]!==p.index||plane.depth24[i]!==f.depth24||unknownMask[i])continue;const attr=attrs.get(p.index);need(Number.isInteger(attr)&&!(attr&0x4000),'Source ordinary opaque owner attribute required');if(f.depth24===depth24[i]){unknownMask[i]|=4;continue;}if(f.depth24>depth24[i])continue;rgba6665.set([...f.rgb6,31],i*4);depth24[i]=f.depth24;depthOwner[i]=colorOwner[i]=p.index;colorOwnerIsBody[i]=depthOwnerIsBody[i]=1;frontFacing[i]=Number(p.frontFacing);isFogged[i]=attr>>>15&1;opaqueId[i]=attr>>>24&63;changedMask[i]=1;stats.opaqueWrites++;stats.depthWrites++;}
 // All opaque polygons have already run. Native manual translucent order is
 // map first, then this ordinary natural actor. The source order proof does not
 // permit appending the actor to an already fogged/composed scene.
 const drawTranslucent=(p,body)=>{
  const attr=body?attrs.get(p.index):p.attribute;need(Number.isInteger(attr)&&(attr>>>4&3)===0&&(attr>>>16&31)>0&&!(attr&0x4800),'Source mode0 ordinary translucent depth-write-off attribute required');const id=attr>>>24&63;
  for(const f of p.fragments){const i=f.y*256+f.x,o=i*4;if(!footprint[i])continue;stats.incoming++;if(f.alpha5===0){stats.alphaDiscarded++;continue;}if(unknownMask[i])continue;
   const lequal=p.frontFacing&&!frontFacing[i]&&rgba6665[o+3]===31;if(lequal?f.depth24>depth24[i]:f.depth24>=depth24[i]){stats.depthRejected++;continue;}
   if(f.alpha5===31){rgba6665.set([...f.rgb6,31],o);opaqueId[i]=id;isTranslucentPoly[i]=1;isFogged[i]=attr>>>15&1;depth24[i]=f.depth24;depthOwner[i]=p.index;depthOwnerIsBody[i]=Number(body);stats.opaqueWrites++;stats.depthWrites++;}
   else{if(translucentId[i]===id){stats.duplicateIdSuppressed++;continue;}translucentId[i]=id;const a=f.alpha5+1,priorAlpha=rgba6665[o+3];for(let c=0;c<3;c++)rgba6665[o+c]=!controls.alphaBlendEnabled||priorAlpha===0?f.rgb6[c]:(a*f.rgb6[c]+(32-a)*rgba6665[o+c])>>5;rgba6665[o+3]=!controls.alphaBlendEnabled||priorAlpha===0?f.alpha5:Math.max(f.alpha5,priorAlpha);isFogged[i]=Number(Boolean(isFogged[i])&&Boolean(attr&0x8000));stats.blended++;}
   frontFacing[i]=Number(p.frontFacing);colorOwner[i]=p.index;colorOwnerIsBody[i]=Number(body);changedMask[i]=1;
  }
 };
 if(destination.mapFragments){const {offsets,words}=destination.mapFragments;for(let i=0;i<N;i++)if(footprint[i]&&!unknownMask[i])for(let k=offsets[i];k<offsets[i+1];k++){const o=k*4,c=words[o+3];drawTranslucent({index:words[o],attribute:words[o+1],frontFacing:!!(c&0x20000000),fragments:[{x:i%256,y:i>>8,depth24:words[o+2],rgb6:[c&255,c>>>8&255,c>>>16&255],alpha5:c>>>24&31}]},false);}}
 for(const p of participants.filter(p=>p.translucent).sort((a,b)=>a.index-b.index))drawTranslucent(p,true);
 for(let i=0;i<N;i++){stats.bodyFootprintPixels+=footprint[i];stats.unknownDestinationPixels+=Number(Boolean(unknownMask[i]&1));stats.unknownOrderPixels+=Number(Boolean(unknownMask[i]&2));stats.opaqueDepthTiePixels+=Number(Boolean(unknownMask[i]&4));}
 if(unknownMask.some(Boolean))return{ready:false,reason:'Source body footprint intersects unknown destination, map/MSE order or equal-depth opaque ownership',unsupportedDestination:true,partialBodyNotScored:true,stats,unknownReasons:destination.unknownReasons,unknownMask};
 const beforeFog=rgba6665.slice();if(fog)for(let i=0;i<N;i++)if(footprint[i])rgba6665.set(applyFogPixel(rgba6665.subarray(i*4,i*4+4),depth24[i],Boolean(isFogged[i]),fog.parameters,fog.table),i*4);
 const image=presentStaticRgb({width:256,height:192,rgba6665},{profile:'rgb555-expanded'}),rgba=new Uint8ClampedArray(N*4);
 for(let i=0;i<N;i++)if(footprint[i]){const x=i%256+alignment.dx,y=(i>>8)+alignment.dy;if(x>=0&&y>=0&&x<256&&y<192){const o=(y*256+x)*4;rgba.set(image.rgba.subarray(i*4,i*4+3),o);rgba[o+3]=255;}}
 return{ready:true,width:256,height:192,rgba,sourceDepth24:depth24,sourceOwner:colorOwner,sourceCoverage:footprint,sourceAcceptedSubset:'known-source-destination-mixed-body',raster:'source-integer-original-GX-body-composition-subset',sceneOcclusionApplied:true,clippedTriangles:null,originalPolygons:projected.polygons.length,stats,nativeState:{preFogRGBA6665:beforeFog,depth24,depthOwner,colorOwner,frontFacing,isFogged,opaqueId,translucentId,isTranslucentPoly,changedMask,colorOwnerIsBody,depthOwnerIsBody},scope:'Conditional same-source pre-fog scene/body composition; retained depth/IDs/fog flags follow native fragment writes. Complete known footprint only; unknown map/MSE order, opaque depth ties, live bindings and other actors remain unproved.'};
}

/** Bind the reconstructed source state to the unchanged frozen null image.
 * A newer decoder can differ from an older saved render. Such cells are
 * unavailable, not replaced. Unaligned source planes never borrow aligned
 * screenshot depth, and source/frame/camera changes invalidate the binding. */
export function bindNativeBodyDestination(destination,{frame,camera,alignment,reconstructedRGBA,backgroundRGBA,validMask}){
 need(destination?.kind==='source-prefog-opaque-body-destination-v1'&&frame?.recordKey===destination.recordKey,'Same-frame source destination record required');
 need(/^[a-f0-9]{64}$/.test(frame.romSHA256??'')&&/^[a-f0-9]{64}$/.test(frame.fullRGBA_SHA256??'')&&typeof frame.sourceId==='string'&&frame.sourceId.length>0&&['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(frame[k])&&frame[k]>=0)&&Number.isFinite(frame.mediaTime)&&frame.mediaTime>=0,'Explicit frozen source ROM/video identity required');
 need(['viewFx','projectionFx'].every(k=>JSON.stringify(camera?.[k])===JSON.stringify(destination.snapshot?.[k])),'Source destination camera differs');
 need(Number.isInteger(alignment?.dx)&&Number.isInteger(alignment?.dy)&&reconstructedRGBA?.length===N*4&&backgroundRGBA?.length===N*4&&validMask?.length===N,'Source/null RGBA, mask and alignment required');
 const knownMask=destination.knownMask.slice(),mismatchMask=new Uint8Array(N);let backgroundMismatchPixels=0,unavailableComparisonPixels=0;
 for(let i=0;i<N;i++){const x=i%256+alignment.dx,y=(i>>8)+alignment.dy,j=y*256+x;if(x<0||x>=256||y<0||y>=192||!validMask[j]){knownMask[i]=0;unavailableComparisonPixels++;continue;}if([0,1,2,3].some(c=>reconstructedRGBA[i*4+c]!==backgroundRGBA[j*4+c])){knownMask[i]=0;mismatchMask[i]=1;backgroundMismatchPixels++;}}
 return{...destination,knownMask,mismatchMask,binding:{kind:'same-frozen-source-destination-v1',frame:structuredClone(frame),camera:structuredClone(camera),alignment:{...alignment},backgroundMismatchPixels,unavailableComparisonPixels}};
}

/** Compact per-pixel source-order stream. Strictly behind the original opaque
 * depth is always rejected because admitted actor writes cannot increase depth.
 * This keeps frame-local retention bounded without storing textures/UV traces. */
export function packNativeMapTranslucentFragments(participants,plane){
 const sorted=participants.slice().sort((a,b)=>a.index-b.index),offsets=new Uint32Array(N+1);let count=0;
 const eligible=f=>f.alpha5>0&&plane.coverage[f.y*256+f.x]&&f.depth24<=plane.depth24[f.y*256+f.x];
 for(const p of sorted)for(const f of p.fragments)if(eligible(f)){offsets[f.y*256+f.x+1]++;count++;}
 need(count*16+offsets.byteLength<=16*1024*1024,'Source map fragment destination exceeds bounded 16MiB subset');
 for(let i=1;i<=N;i++)offsets[i]+=offsets[i-1];const cursor=offsets.slice(),words=new Uint32Array(count*4);
 for(const p of sorted)for(const f of p.fragments)if(eligible(f)){const o=cursor[f.y*256+f.x]++*4;words[o]=p.index;words[o+1]=p.attribute;words[o+2]=f.depth24;words[o+3]=(f.rgb6[0]|f.rgb6[1]<<8|f.rgb6[2]<<16|f.alpha5<<24|Number(p.frontFacing)<<29)>>>0;}
 return{offsets,words,fragmentCount:count,retainedBytes:offsets.byteLength+words.byteLength,sourceOrder:'per-pixel original map polygon submission index'};
}
