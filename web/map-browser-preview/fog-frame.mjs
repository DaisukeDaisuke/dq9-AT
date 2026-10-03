// Post-raster adapter for the accepted fixed-core integer fog component.
// GPL-2.0-or-later when distributed with native/fog-raster.mjs; see its notice.
import {lowerEnvironmentFog,inheritTimeFogRecords,staticMode1FogParameters} from './native/fog-records.mjs';
import {buildFogTable,applyFogPixel} from './native/fog-raster.mjs';
export function prepareStaticFog(calls,{selectedTimeIndex,selector,mode,timeInterpolationActive}){
 if(mode!==1||selector!==0||timeInterpolationActive!==false||!Number.isInteger(selectedTimeIndex)||selectedTimeIndex<0||selectedTimeIndex>3)throw Error('Verified ordinary mode1 time-record selection required');
 const source=lowerEnvironmentFog(calls);if(!source.ready||source.mode!==mode)throw Error('Unsupported fog source: '+JSON.stringify(source.issues));
 const inherited=inheritTimeFogRecords(source.records),parameters=staticMode1FogParameters(inherited.records,selectedTimeIndex);
 return {parameters,table:buildFogTable(parameters),source,inheritance:inherited.copies};
}
export function applyNativeFogFrame({rgba6665,depth24,fogMask,width,height},prepared){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16777216)throw Error('Invalid frame dimensions');const pixels=width*height;
 if(!(rgba6665 instanceof Uint8Array)||rgba6665.length!==pixels*4||!(depth24 instanceof Uint32Array)||depth24.length!==pixels||!(fogMask instanceof Uint8Array)||fogMask.length!==pixels)throw Error('Native RGBA6665/depth24/fog-mask planes required; do not pass WebGL normalized depth');
 const out=new Uint8Array(rgba6665.length);for(let i=0;i<pixels;i++){if(fogMask[i]>1)throw Error('Fog mask must be an accepted-raster boolean');out.set(applyFogPixel(rgba6665.subarray(i*4,i*4+4),depth24[i],fogMask[i]!==0,prepared.parameters,prepared.table),i*4);}
 return {width,height,rgba6665:out,scope:'Integer fog postprocess only; caller owns native raster acceptance/depth/mask and edge marking'};
}
