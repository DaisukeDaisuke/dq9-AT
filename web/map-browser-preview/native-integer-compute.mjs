import{submitNativeIntegerBatch}from'./native-integer-compute-batch.mjs';
/* SPDX-License-Identifier: GPL-2.0-or-later
 * Integer pixel portion of the existing DeSmuME535f676-derived raster subset.
 * Native clip/edge preparation and NORMAL remain CPU/source operations.
 * WGSL uses paired u32 for signed64 interpolants; no Float32 approximation.
 */
export const NATIVE_INTEGER_COMPUTE_WGSL=String.raw`
struct Config { shape:vec4<u32>, control:vec4<u32>, fog:vec4<u32>, sizes:vec4<u32> }
@group(0) @binding(0) var<uniform> cfg:Config;
@group(0) @binding(1) var<storage,read> rows:array<u32>;
@group(0) @binding(2) var<storage,read> refs:array<u32>;
@group(0) @binding(3) var<storage,read> texels:array<u32>;
@group(0) @binding(4) var<storage,read> fogTable:array<u32>;
@group(0) @binding(5) var<storage,read_write> output:array<u32>;
struct I64 { lo:u32, hi:u32 }
struct Quotient { value:i32, error:u32 }
fn add64(a:I64,b:I64)->I64 {let lo=a.lo+b.lo;return I64(lo,a.hi+b.hi+select(0u,1u,lo<a.lo));}
fn neg64(a:I64)->I64 {return add64(I64(~a.lo,~a.hi),I64(1u,0u));}
fn mulSmall(a:I64,n:u32)->I64 {let p0=(a.lo&65535u)*n;let p1=(a.lo>>16u)*n+(p0>>16u);return I64((p0&65535u)|(p1<<16u),a.hi*n+(p1>>16u));}
fn ge64(a:I64,b:I64)->bool {return a.hi>b.hi||(a.hi==b.hi&&a.lo>=b.lo);}
fn sub64(a:I64,b:I64)->I64 {return I64(a.lo-b.lo,a.hi-b.hi-select(0u,1u,a.lo<b.lo));}
fn udiv64(a:I64,b:I64)->I64 {
 if(b.hi==0u&&a.hi==0u){return I64(a.lo/b.lo,0u);}
 var rem=I64(0u,0u);var q=I64(0u,0u);
 for(var j=0u;j<64u;j=j+1u){let bit=63u-j;var digit:u32;if(bit>=32u){digit=(a.hi>>(bit-32u))&1u;}else{digit=(a.lo>>bit)&1u;}
  rem=I64((rem.lo<<1u)|digit,(rem.hi<<1u)|(rem.lo>>31u));
  if(ge64(rem,b)){rem=sub64(rem,b);if(bit>=32u){q.hi=q.hi|(1u<<(bit-32u));}else{q.lo=q.lo|(1u<<bit);}}
 }return q;
}
fn sdiv64(a:I64,b:I64)->Quotient {
 if((b.lo|b.hi)==0u||(b.hi&2147483648u)!=0u){return Quotient(0,1u);}
 let negative=(a.hi&2147483648u)!=0u;var magnitude=a;if(negative){magnitude=neg64(a);}
 let q=udiv64(magnitude,b);let limit=select(2147483647u,2147483648u,negative);
 if(q.hi!=0u||q.lo>limit){return Quotient(0,2u);}
 return Quotient(bitcast<i32>(select(q.lo,0u-q.lo,negative)),0u);
}
fn pair(at:u32)->I64{return I64(rows[at],rows[at+1u]);}
fn interpolant(base:u32,offset:u32,x:u32)->I64{return add64(pair(base+offset),mulSmall(pair(base+offset+2u),x));}
fn rgba(v:u32)->vec4<u32>{return vec4<u32>(v&255u,(v>>8u)&255u,(v>>16u)&255u,v>>24u);}
fn packed(v:vec4<u32>)->u32{return v.x|(v.y<<8u)|(v.z<<16u)|(v.w<<24u);}
fn expand5(v:u32)->u32{return select(v*2u+1u,0u,v==0u);}
fn coordinate(v:i32,size:u32,repeat:bool,flip:bool)->u32{
 if(!repeat){return u32(clamp(v,0,i32(size)-1));}
 if(!flip){return bitcast<u32>(v)&(size-1u);}
 let n=bitcast<u32>(v)&(size*2u-1u);return select(n,size*2u-n-1u,n>=size);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let pixel=gid.x;let pixels=cfg.shape.x*cfg.shape.y;if(pixel>=pixels){return;}
 let x=pixel%cfg.shape.x;let y=pixel/cfg.shape.x;
 var covered=false;var unknown=false;var front=false;var fogged=false;
 var depth=0u;var owner=4294967295u;var depthOwner=4294967295u;var translucentID=255u;
 var color=vec4<u32>(0u);var errors=0u;var incoming=0u;
 for(var refAt=refs[pixel];refAt<refs[pixel+1u];refAt=refAt+1u){
  let ri=refs[cfg.sizes.z+refAt];if(ri>=cfg.shape.z){errors=errors|4u;continue;}
  let b=ri*cfg.sizes.x;let flags=rows[b];let index=rows[b+1u];let attr=rows[b+2u];let start=rows[b+7u];let width=rows[b+8u];let isFront=rows[b+10u]!=0u;
  if(rows[b+9u]!=y||x<start||x-start>=width){errors=errors|8u;continue;}let dx=x-start;incoming=incoming+1u;
  let z=interpolant(b,12u,dx);let zd=sdiv64(z,I64(524288u,0u));errors=errors|zd.error;let incomingDepth=bitcast<u32>(zd.value)&4294967294u;if(incomingDepth>16777215u){errors=errors|16u;continue;}
  let inv=interpolant(b,16u,dx);let su=sdiv64(interpolant(b,20u,dx),inv);let tv=sdiv64(interpolant(b,24u,dx),inv);errors=errors|su.error|tv.error;
  let wrap=rows[b+6u];let sx=coordinate(su.value,rows[b+4u],(wrap&1u)!=0u,(wrap&4u)!=0u);let sy=coordinate(tv.value,rows[b+5u],(wrap&2u)!=0u,(wrap&8u)!=0u);
  let ta=rows[b+3u]+sy*rows[b+4u]+sx;if(ta>=cfg.sizes.y){errors=errors|32u;continue;}let texture=rgba(texels[ta]);
  let rr=sdiv64(interpolant(b,28u,dx),inv);let gg=sdiv64(interpolant(b,32u,dx),inv);let bb=sdiv64(interpolant(b,36u,dx),inv);errors=errors|rr.error|gg.error|bb.error;
  let vertex=vec3<u32>(u32(clamp(rr.value,0,63)),u32(clamp(gg.value,0,63)),u32(clamp(bb.value,0,63)));
  let shaded=((texture.xyz+vec3<u32>(1u))*(vertex+vec3<u32>(1u))-vec3<u32>(1u))>>vec3<u32>(6u);
  let alpha=(((expand5(texture.w)+1u)*(expand5((attr>>16u)&31u)+1u)-1u)>>6u)>>1u;
  let trans=(flags&1u)!=0u;
  if(!trans){
   if(alpha==0u){continue;}if(alpha!=31u){errors=errors|64u;continue;}
   let pass=!covered||select(incomingDepth<depth,incomingDepth<=depth,isFront&&!front);
   if(pass){covered=true;depth=incomingDepth;depthOwner=index;owner=index;front=isFront;color=vec4<u32>(shaded,31u);fogged=(attr&32768u)!=0u;}
   continue;
  }
  if(!covered||unknown){unknown=true;continue;}
  let lequal=isFront&&!front&&color.w==31u;
  if(select(incomingDepth>=depth,incomingDepth>depth,lequal)){continue;}
  if(alpha==0u||(cfg.control.y!=0u&&alpha<cfg.control.z)){continue;}
  if(alpha==31u){color=vec4<u32>(shaded,31u);depth=incomingDepth;depthOwner=index;fogged=(attr&32768u)!=0u;}
  else{
   let id=(attr>>24u)&63u;if(translucentID==id){continue;}translucentID=id;
   if(cfg.control.x==0u||color.w==0u){color=vec4<u32>(shaded,alpha);}
   else{let a=alpha+1u;color=vec4<u32>((shaded*vec3<u32>(a)+color.xyz*vec3<u32>(32u-a))>>vec3<u32>(5u),max(alpha,color.w));}
   fogged=fogged&&((attr&32768u)!=0u);
  }
  owner=index;front=isFront;
 }
 if(covered&&!unknown&&cfg.fog.x!=0u){let weight=select(0u,fogTable[depth>>9u],fogged);let fc=rgba(cfg.fog.z);if(cfg.fog.y==0u){color=vec4<u32>((color.xyz*vec3<u32>(128u-weight)+fc.xyz*vec3<u32>(weight))>>vec3<u32>(7u),color.w);}color.w=(color.w*(128u-weight)+fc.w*weight)>>7u;}
 let known=covered&&!unknown;if(!known){color=vec4<u32>(0u);}
 let at=pixel*8u;output[at]=packed(color);output[at+1u]=depth;output[at+2u]=owner;output[at+3u]=depthOwner;output[at+4u]=select(0u,1u,covered)|select(0u,2u,known)|select(0u,4u,front)|select(0u,8u,fogged);output[at+5u]=translucentID;output[at+6u]=incoming;output[at+7u]=errors;
}
`;
const need=(x,m)=>{if(!x)throw Error(m);};
export async function createNativeIntegerCompute({onStatus=()=>{}}={}){
 if(!globalThis.navigator?.gpu)return{ready:false,reason:'navigator.gpu unavailable'};
 const adapter=await navigator.gpu.requestAdapter();if(!adapter)return{ready:false,reason:'WebGPU adapter unavailable'};
 onStatus({phase:'adapter',info:adapter.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description}:null,limits:{maxStorageBufferBindingSize:adapter.limits.maxStorageBufferBindingSize,maxBufferSize:adapter.limits.maxBufferSize}});
 const device=await adapter.requestDevice();device.addEventListener('uncapturederror',e=>onStatus({phase:'device-error',error:e.error.message}));device.lost.then(info=>onStatus({phase:'device-lost',reason:info.reason,message:info.message}));const module=device.createShaderModule({label:'Source integer background pixels',code:NATIVE_INTEGER_COMPUTE_WGSL}),info=await module.getCompilationInfo();const messages=info.messages.map(m=>({type:m.type,line:m.lineNum,column:m.linePos,message:m.message}));onStatus({phase:'compile',messages});
 if(messages.some(m=>m.type==='error')){device.destroy();return{ready:false,reason:'WGSL compilation failed',messages};}
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});onStatus({phase:'ready'});
 return{ready:true,device,async render(job){return(await submitNativeIntegerBatch(device,pipeline,[job]))[0];},async renderBatch(jobs){return submitNativeIntegerBatch(device,pipeline,jobs);},destroy(){device.destroy();}};
}
