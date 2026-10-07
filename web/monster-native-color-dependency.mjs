/* SPDX-License-Identifier: GPL-2.0-or-later
 * Exact dependency analysis of the admitted DeSmuME535f676 mode0 RGB writes.
 * The actual accepted trace is fixed: alpha, depth, IDs, facing and fog flags
 * never depend on the replacement RGB values used only in this analysis.
 */
import {applyFogPixel} from './map-browser-preview/native/fog-raster.mjs';
const N=256*192,channel=x=>Number.isInteger(x)&&x>=0&&x<=63;
/** Track minimum/maximum possible RGB6 as each accepted BODY color input ranges
 * independently over 0..63; non-body color and all acceptance inputs stay fixed.
 * Every admitted recurrence is coordinate-wise monotone. Thus endpoints are
 * attainable (all body channels 0 or 63), including every integer truncation.
 * Different displayed endpoints are exactly RGB555 dependence on body color.
 * This is not the effect of removing geometry or changing the actual ROM color.
 */
export function createNativeBodyColorDependency(rgba6665){
 const lower=rgba6665.slice(),upper=rgba6665.slice();
 let supported=rgba6665 instanceof Uint8Array&&rgba6665.length===N*4;
 return{
  accept(i,rgb6,alpha5,body,blendEnabled,priorAlpha){
   if(!supported)return;
   if(!Number.isInteger(i)||i<0||i>=N||!Array.isArray(rgb6)||rgb6.length!==3||!rgb6.every(channel)||!Number.isInteger(alpha5)||alpha5<1||alpha5>31||typeof body!=='boolean'||typeof blendEnabled!=='boolean'||!Number.isInteger(priorAlpha)||priorAlpha<0||priorAlpha>31){supported=false;return;}
   const o=i*4;if([0,1,2].some(c=>!channel(lower[o+c])||!channel(upper[o+c]))){supported=false;return;}if(lower[o+3]!==priorAlpha||upper[o+3]!==priorAlpha){supported=false;return;}const a=alpha5+1,replace=alpha5===31||!blendEnabled||priorAlpha===0;
   for(let c=0;c<3;c++){
    const lo=body?0:rgb6[c],hi=body?63:rgb6[c];
    lower[o+c]=replace?lo:(a*lo+(32-a)*lower[o+c])>>5;
    upper[o+c]=replace?hi:(a*hi+(32-a)*upper[o+c])>>5;
   }
   lower[o+3]=upper[o+3]=replace?alpha5:Math.max(alpha5,priorAlpha);
  },
  finish({footprint,depth24,isFogged,fog}){
   if(!supported)return null;
   if(fog&&(typeof fog.parameters?.enabled!=='boolean'||typeof fog.parameters?.alphaOnly!=='boolean'||!(fog.table instanceof Uint8Array)||fog.table.length!==32768))return null;
   const preFogMask=new Uint8Array(N),displayMask=new Uint8Array(N);
   for(let i=0;i<N;i++)if(footprint[i]){
    const o=i*4;if([0,1,2].some(c=>!channel(lower[o+c])||!channel(upper[o+c]))||lower[o+3]>31||upper[o+3]>31)return null;preFogMask[i]=Number([0,1,2].some(c=>lower[o+c]!==upper[o+c]));
    if(fog){
     // Negative destination factors are outside the proven monotone subset.
     if(fog.parameters.enabled&&isFogged[i]&&fog.table[depth24[i]>>>9]>128)return null;
     const l=applyFogPixel(lower.subarray(o,o+4),depth24[i],Boolean(isFogged[i]),fog.parameters,fog.table),u=applyFogPixel(upper.subarray(o,o+4),depth24[i],Boolean(isFogged[i]),fog.parameters,fog.table);
     lower.set(l,o);upper.set(u,o);
    }
    displayMask[i]=Number([0,1,2].some(c=>(lower[o+c]>>>1)!==(upper[o+c]>>>1)));
   }
   return{preFogMask,displayMask};
  }
 };
}
