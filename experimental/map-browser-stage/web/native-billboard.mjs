// Limited native BB/BBY packet builder, derived from YDQJ runtime handlers
// 020b6bb8/020b6ec0. Requires actual post-projection-identity model-view readback.
// Does not solve inverse camera/object modes, callbacks, or render integration.
import {integerSqrt,fxNormalize} from './native/native-camera-fx.mjs';
const i32=x=>Number(BigInt.asIntN(32,BigInt(x)));
function lengthFx(v){const sum=v.reduce((s,x)=>s+BigInt(x)*BigInt(x),0n);if(sum*4n>0xffffffffffffffffn)throw Error('Native square-root overflow outside accepted subset');const n=integerSqrt(sum*4n);if(n>=0x7fffffffn)throw Error('Native length signed-range branch not accepted');return Number((n+1n)>>1n);}
export function buildDefaultBillboardPacket({axis,modelViewFx,previousTemplate,globalFlags,contextFlags,callbackOverride}){
 if(!['full','y'].includes(axis)||!Array.isArray(modelViewFx)||modelViewFx.length!==16||modelViewFx.some(x=>!Number.isInteger(x)||x< -2147483648||x>2147483647))throw Error('Native 16word model-view input required');
 if(!Number.isInteger(globalFlags)||!Number.isInteger(contextFlags)||callbackOverride!==false)throw Error('Explicit native flags and callback condition required');
 if(globalFlags&3||contextFlags&0x300)throw Error('Inverse camera/object or suppressed BB branch not implemented');
 if(!(previousTemplate instanceof Uint8Array)||previousTemplate.length!==72)throw Error('ROM-initialized/preserved native packet template required');
 const result=previousTemplate.slice(),d=new DataView(result.buffer);const word=i=>d.getInt32(i*4,true),put=(i,x)=>d.setInt32(i*4,x,true);
 if(d.getUint32(0,true)!==0x1b171012||word(1)!==1||word(2)!==2)throw Error('Unrecognized native BB packet template');
 const columns=[modelViewFx.slice(0,3),modelViewFx.slice(4,7),modelViewFx.slice(8,11)];
 [12,13,14].forEach((i,k)=>put(i,modelViewFx[12+k]));columns.forEach((v,k)=>put(15+k,lengthFx(v)));
 let branch='full';if(axis==='y'){
  if(columns[1][1]===0&&columns[1][2]===0){const n=fxNormalize(columns[2]);n.forEach((v,k)=>put(9+k,v));put(8,i32(-word(10)));put(7,word(11));branch='normalize-z';}
  else{const n=fxNormalize(columns[1]);n.forEach((v,k)=>put(6+k,v));put(10,i32(-word(8)));put(11,word(7));branch='normalize-y';}
 }
 return {packet:result,nextTemplate:result.slice(),branch,scaleFx:[word(15),word(16),word(17)],translationFx:[word(12),word(13),word(14)],scope:'Static-derived ordinary BB/BBY GX packet subset; native dynamic/pixel acceptance pending. Preserve previous template across calls.'};
}
