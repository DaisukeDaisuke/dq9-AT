/* SPDX-License-Identifier: GPL-2.0-or-later
 * Accepted-expression RGB lineage for the admitted DeSmuME535f676 compositor.
 * This is not actual ROM/background contrast or removal of body geometry.
 */
import {rgb555To6665} from './map-browser-preview/native/fog-raster.mjs';
const N=256*192,issued=new WeakMap(),channel=x=>Number.isInteger(x)&&x>=0&&x<=63;
const frameKeys=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const frameKey=f=>JSON.stringify(frameKeys.map(k=>f?.[k]));
const validFrame=f=>f&&/^[a-f0-9]{64}$/.test(f.romSHA256??'')&&/^[a-f0-9]{64}$/.test(f.fullRGBA_SHA256??'')&&typeof f.recordKey==='string'&&typeof f.sourceId==='string'&&f.sourceId.length>0&&['sourceEpoch','timelineSegment'].every(k=>Number.isSafeInteger(f[k])&&f[k]>=0)&&Number.isFinite(f.mediaTime)&&f.mediaTime>=0;
/** Every already-accepted color write has its actual RGB operands replayed.
 * In parallel, each BODY operand is independently ranged over RGB6 0..63.
 * All admitted blend/fog/truncation recurrences are coordinate-wise monotone:
 * the endpoint executions are attainable and therefore determine exactly
 * whether the final displayed expression depends on any accepted body RGB.
 * Alpha/depth/ID/facing/order/fog flags remain the actual accepted trace.
 * Actual replay equality is mandatory; endpoint dependence alone is not a
 * renderer-issued complete-lineage record. No native pixels are modified.
 */
export function createNativeBodyColorLineage(rgba6665,binding){
 if(!(rgba6665 instanceof Uint8Array)||rgba6665.length!==N*4||binding?.kind!=='same-frozen-source-destination-v1'||!validFrame(binding.frame)||!Number.isInteger(binding.alignment?.dx)||!Number.isInteger(binding.alignment?.dy))return null;
 const actual=rgba6665.slice(),lower=rgba6665.slice(),upper=rgba6665.slice(),boundFrame=frameKey(binding.frame),boundCamera=JSON.stringify([binding.camera?.viewFx,binding.camera?.projectionFx]),alignment={...binding.alignment};
 let supported=true,acceptedBodyWrites=0,acceptedOtherWrites=0;
 return{
  accept(i,rgb6,alpha5,body,blendEnabled,priorAlpha){
   if(!supported)return;
   if(!Number.isInteger(i)||i<0||i>=N||!Array.isArray(rgb6)||rgb6.length!==3||!rgb6.every(channel)||!Number.isInteger(alpha5)||alpha5<1||alpha5>31||typeof body!=='boolean'||typeof blendEnabled!=='boolean'||!Number.isInteger(priorAlpha)||priorAlpha<0||priorAlpha>31){supported=false;return;}
   const o=i*4;if(actual[o+3]!==priorAlpha||lower[o+3]!==priorAlpha||upper[o+3]!==priorAlpha){supported=false;return;}
   const replace=alpha5===31||!blendEnabled||priorAlpha===0,a=alpha5+1;
   for(let c=0;c<3;c++){
    if(!channel(actual[o+c])||!channel(lower[o+c])||!channel(upper[o+c])){supported=false;return;}
    const lo=body?0:rgb6[c],hi=body?63:rgb6[c];
    actual[o+c]=replace?rgb6[c]:Math.floor((a*rgb6[c]+(32-a)*actual[o+c])/32);
    lower[o+c]=replace?lo:Math.floor((a*lo+(32-a)*lower[o+c])/32);
    upper[o+c]=replace?hi:Math.floor((a*hi+(32-a)*upper[o+c])/32);
   }
   actual[o+3]=lower[o+3]=upper[o+3]=replace?alpha5:Math.max(alpha5,priorAlpha);
   if(body)acceptedBodyWrites++;else acceptedOtherWrites++;
  },
  finish(rendered,{footprint,preFogRGBA6665,postFogRGBA6665,depth24,isFogged,fog}){
   if(!supported||rendered?.ready!==true||!(footprint instanceof Uint8Array)||footprint.length!==N||!(depth24 instanceof Uint32Array)||depth24.length!==N||!(isFogged instanceof Uint8Array)||isFogged.length!==N||preFogRGBA6665?.length!==N*4||postFogRGBA6665?.length!==N*4)return false;
   if(!Number.isSafeInteger(rendered.stats?.opaqueWrites)||rendered.stats.opaqueWrites<0||!Number.isSafeInteger(rendered.stats?.blended)||rendered.stats.blended<0||rendered.stats.opaqueWrites+rendered.stats.blended!==acceptedBodyWrites+acceptedOtherWrites)return false;
   let fogColor=null;
   if(fog){const p=fog.parameters;if(typeof p?.enabled!=='boolean'||typeof p?.alphaOnly!=='boolean'||!Number.isInteger(p.color)||p.color<0||p.color>0xffffffff||!Number.isInteger(p.offset)||p.offset< -2147483648||p.offset>2147483647||!Number.isInteger(p.shift)||p.shift<0||p.shift>15||!(p.density instanceof Uint8Array)||p.density.length!==32||p.density.some(x=>x>127)||!(fog.table instanceof Uint8Array)||fog.table.length!==32768)return false;fogColor=rgb555To6665(p.color);}
   const displayMask=new Uint8Array(N),outputIndices=[],outputValues=[];let verifiedPixels=0;
   for(let i=0;i<N;i++){
    if(footprint[i]!==0&&footprint[i]!==1)return false;if(!footprint[i])continue;
    const o=i*4,x=i%256+alignment.dx,y=(i>>8)+alignment.dy;
    if(x<0||x>=256||y<0||y>=192)return false;
    for(let c=0;c<4;c++)if(actual[o+c]!==preFogRGBA6665[o+c]||(c<3&&(!channel(actual[o+c])||actual[o+c]<lower[o+c]||actual[o+c]>upper[o+c])))return false;
    if(actual[o+3]>31||!Number.isInteger(depth24[i])||depth24[i]>0xffffff||(isFogged[i]!==0&&isFogged[i]!==1))return false;
    if(fog?.parameters.enabled){
     // Scalar form of native applyFogPixel; validate once, with no per-pixel
     // arrays. Convex factors and RGB6/alpha5 inputs cannot wrap or clamp.
     const w=isFogged[i]?fog.table[depth24[i]>>>9]:0;if(w>128)return false;
     for(let c=0;c<4;c++)if(c===3||!fog.parameters.alphaOnly){
      actual[o+c]=Math.floor(((128-w)*actual[o+c]+fogColor[c]*w)/128);
      lower[o+c]=Math.floor(((128-w)*lower[o+c]+fogColor[c]*w)/128);
      upper[o+c]=Math.floor(((128-w)*upper[o+c]+fogColor[c]*w)/128);
     }
    }
    for(let c=0;c<4;c++)if(actual[o+c]!==postFogRGBA6665[o+c])return false;
    const j=(y*256+x)*4;
    if(rendered.rgba[j+3]!==255)return false;
    for(let c=0;c<3;c++){
     const v=actual[o+c]>>>1;if(rendered.rgba[j+c]!==((v<<3)|(v>>>2)))return false;
     if((lower[o+c]>>>1)!==(upper[o+c]>>>1))displayMask[i]=1;
    }
    outputIndices.push(j>>>2);outputValues.push((rendered.rgba[j]|rendered.rgba[j+1]<<8|rendered.rgba[j+2]<<16|rendered.rgba[j+3]<<24)>>>0);verifiedPixels++;
   }
   // Native state survives rasterNativeBody's isolated-result object spread;
   // a JSON/structured clone or a caller-supplied diagnostic cannot issue this.
   issued.set(rendered.nativeState,{displayMask,boundFrame,boundCamera,binding,alignment,rgba:rendered.rgba,sourceCoverage:rendered.sourceCoverage,coverageWitness:rendered.sourceCoverage.slice(),outputIndices:Uint32Array.from(outputIndices),outputValues:Uint32Array.from(outputValues),sourceAcceptedSubset:rendered.sourceAcceptedSubset,verifiedPixels,acceptedBodyWrites,acceptedOtherWrites});
   return true;
  }
 };
}
export function readNativeBodyColorLineage(rendered,{frame,alignment,camera}){
 const row=issued.get(rendered?.nativeState);
 if(camera!==undefined&&JSON.stringify([camera?.viewFx,camera?.projectionFx])!==row?.boundCamera)return null;
 if(!row||rendered.ready!==true||rendered.sceneOcclusionApplied!==true||rendered.rgba!==row.rgba||rendered.sourceCoverage!==row.sourceCoverage||rendered.sourceAcceptedSubset!==row.sourceAcceptedSubset||!validFrame(frame)||frameKey(frame)!==row.boundFrame||alignment?.dx!==row.alignment.dx||alignment?.dy!==row.alignment.dy)return null;
 // Exact sparse displayed-byte witness plus zero outside the emitted footprint.
 // This catches mutation and cross-raster reuse without retaining an RGB frame.
 if(!(rendered.rgba instanceof Uint8ClampedArray)||rendered.rgba.length!==N*4||rendered.rgba.byteOffset%4)return null;
 const words=new Uint32Array(rendered.rgba.buffer,rendered.rgba.byteOffset,N);let cursor=0;
 for(let i=0;i<N;i++){if(rendered.sourceCoverage[i]!==row.coverageWitness[i])return null;const expected=row.outputIndices[cursor]===i?row.outputValues[cursor++]:0;if(words[i]!==expected)return null;}
 if(cursor!==row.outputIndices.length)return null;
 return{kind:'source-accepted-body-color-lineage-v1',displayMask:row.displayMask.slice(),sourceAcceptedSubset:row.sourceAcceptedSubset,completeWithinAdmittedComposition:true,allDisplayedBodyOperandDependenciesCaptured:true,actualAcceptedRGBReplayVerified:true,sourceDestinationFrameBindingVerified:true,fixedAcceptanceTrace:true,integerBlendAndFogQuantizationIncluded:true,verifiedCompositionPixels:row.verifiedPixels,acceptedBodyColorWrites:row.acceptedBodyWrites,acceptedOtherColorWrites:row.acceptedOtherWrites,bodyRGBOperandDomain:[0,63],actualROMColorContrastCertified:false,bodyRemovalDifferenceCertified:false,indirectDepthOcclusionInfluenceIncluded:false,observedBodyCertified:false,identityCertified:false,minimumProvenATCalls:0};
}

// Exact destination object used by the verified source composition.
export function nativeBodyColorLineageUsesDestination(rendered,binding){return binding!==undefined&&issued.get(rendered?.nativeState)?.binding===binding;}
