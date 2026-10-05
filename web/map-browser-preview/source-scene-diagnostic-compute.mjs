/* SPDX-License-Identifier: GPL-2.0-or-later
 * Bounded WebGPU proposal-basis raster. Clip, packet rejection and source camera
 * preparation stay on CPU. Pixels use Float32 diagnostics, never DS integer
 * acceptance, native depth, fog, or a GPU speed/parity claim.
 * Pixel order is parallel; the source triangle/blend order inside each pixel is
 * unchanged. One tile-binned submission/readback covers a whole diagnostic image.
 */
import {rasterizePreviewPackets} from './source-scene-diagnostic-raster.mjs';
import {prepareNativeMode0Color} from './native-mode0-color.mjs';

export const DIAGNOSTIC_RASTER_LIMITS=Object.freeze({maxTriangles:65536,maxTextureTexels:4194304,maxTileReferences:1048576,maxReferencesPerTile:8192});
export const DIAGNOSTIC_TRIANGLE_WORDS=40;
const W=128,H=96,TILE=8,TILES_X=W/TILE,TILES_Y=H/TILE;
const F32_MAX=3.4028234663852886e38;
const transform=(m,v)=>Array.from({length:4},(_,r)=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
const planes=[v=>v[3]+v[0],v=>v[3]-v[0],v=>v[3]+v[1],v=>v[3]-v[1],v=>v[3]+v[2],v=>v[3]-v[2]];
const edge=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
function clip(poly){for(const distance of planes){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b),ina=da>=0,inb=db>=0;if(ina)out.push(a);if(ina!==inb){const t=da/(da-db);out.push(a.map((x,k)=>x+t*(b[k]-x)));}}poly=out;if(!poly.length)break;}return poly;}
const finiteF32=x=>Number.isFinite(x)&&Math.abs(x)<=F32_MAX;
function limitsFor(overrides){const limits={...DIAGNOSTIC_RASTER_LIMITS,...overrides};for(const key of Object.keys(DIAGNOSTIC_RASTER_LIMITS))if(!Number.isSafeInteger(limits[key])||limits[key]<1||limits[key]>DIAGNOSTIC_RASTER_LIMITS[key])throw Error('Diagnostic GPU limits must be positive bounded integers: '+key);return limits;}

/** Host-only packing; this does NOT render a CPU reference image. */
export function prepareDiagnosticRasterBatch(packets,{view,projection,clearRGBA,colorProfile='legacy'},overrides={}){
 const limits=limitsFor(overrides);
 if(!['legacy','native-mode0-rgb'].includes(colorProfile))throw Error('Unknown preview RGB profile');
 if(![view,projection].every(m=>Array.isArray(m)&&m.length===16&&m.every(Number.isFinite)))throw Error('Explicit view/projection16 required');
 if(!Array.isArray(clearRGBA)||clearRGBA.length!==4||clearRGBA.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Explicit diagnostic clear RGBA required');
 if(!Array.isArray(packets?.draws))throw Error('Explicit diagnostic draw packets required');
 const nativeColor=colorProfile==='native-mode0-rgb',textureCache=new Map(),textureOffsets=new Map(),textures=[],triangles=[],bins=Array.from({length:TILES_X*TILES_Y},()=>[]);
 const stats={submittedPackets:packets.draws.length,acceptedPackets:0,sourceTriangles:0,clippedTriangles:0,fragments:0,rejected:[]},colorStats={profile:colorProfile,nativeRgbPackets:0,legacyFallbackPackets:0,unverifiedAlphaPackets:0};
 const white8={width:1,height:1,pixels:new Uint8Array([255,255,255,255])},white6={width:1,height:1,pixels:new Uint8Array([63,63,63,255])};
 let texelCount=0,referenceCount=0;
 const textureAt=texture=>{if(textureOffsets.has(texture))return textureOffsets.get(texture);const{width,height,pixels}=texture;if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>32768||height>32768||pixels?.length!==width*height*4)throw Error('Unsupported diagnostic GPU texture dimensions');if(texelCount+width*height>limits.maxTextureTexels)throw Error('Diagnostic GPU texture budget exceeded');const offset=texelCount;texelCount+=width*height;textureOffsets.set(texture,offset);textures.push(texture);return offset;};
 for(const p of packets.draws){let reason=null;if(p.polygonMode!==0)reason='Only modulation mode0 implemented';else if(p.alpha===0)reason='Wireframe not implemented';else if(p.polygonAttribute&0x4000)reason='Equal-depth comparison not implemented';else if(p.texture&&(p.texture.output!=='8888'||p.texture.pixels.length!==p.texture.width*p.texture.height*4))reason='RGBA8888 texture required';
  let color=null;if(!reason&&nativeColor){try{color=prepareNativeMode0Color(p,textureCache);}catch(error){reason=error.message;}}
  if(reason){stats.rejected.push({instanceId:p.instanceId,shapeIndex:p.shapeIndex,reason});continue;}stats.acceptedPackets++;if(nativeColor){if(color)colorStats.nativeRgbPackets++;else colorStats.legacyFallbackPackets++;if(p.alpha!==1||color?.hasTranslucentTexels||(!color&&p.texture?.pixels.some((v,i)=>i%4===3&&v!==0&&v!==255)))colorStats.unverifiedAlphaPackets++;}
  const face=p.polygonAttribute>>>6&3;if(!face)continue;
  const vertices=color?.vertices??p.vertices,texture=color?.texture??p.texture??(color?white6:white8);
  if(vertices?.length%24||!Number.isFinite(p.alpha)||p.alpha<0||p.alpha>1||!p.sampler)throw Error('Unsupported diagnostic GPU packet layout');
  let texOffset=null;
  for(let at=0;at<vertices.length;at+=24){stats.sourceTriangles++;const input=[];for(let k=0;k<3;k++){const v=Array.from(vertices.slice(at+k*8,at+k*8+8));input.push([...transform(projection,transform(view,[...v.slice(0,3),1])),...v.slice(3)]);}
   const polygon=clip(input);for(let k=1;k+1<polygon.length;k++){const tri=[polygon[0],polygon[k],polygon[k+1]];if(tri.some(v=>!v.every(Number.isFinite)||v[3]===0))continue;
    const screen=tri.map(v=>[(v[0]/v[3]+1)*W/2,(1-v[1]/v[3])*H/2,v[2]/v[3],1/v[3]]),[a,b,c]=screen,area=edge(a,b,c[0],c[1]);if(!area)continue;const front=area<0;if((face===1&&front)||(face===2&&!front))continue;stats.clippedTriangles++;
    const x0=Math.max(0,Math.ceil(Math.min(...screen.map(v=>v[0]))-.5)),x1=Math.min(W-1,Math.floor(Math.max(...screen.map(v=>v[0]))-.5)),y0=Math.max(0,Math.ceil(Math.min(...screen.map(v=>v[1]))-.5)),y1=Math.min(H-1,Math.floor(Math.max(...screen.map(v=>v[1]))-.5));
    if(x1<x0||y1<y0)continue;
    if(triangles.length>=limits.maxTriangles)throw Error('Diagnostic GPU triangle budget exceeded');
    if(!finiteF32(area)||Math.fround(area)===0||screen.some(v=>!v.every(finiteF32)||v[3]<=0||Math.fround(v[3])===0)||tri.some(v=>Math.abs(v[7])>1e6||Math.abs(v[8])>1e6))throw Error('Diagnostic GPU Float32 input range unsupported');
    const row=new Array(DIAGNOSTIC_TRIANGLE_WORDS).fill(0);for(let i=0;i<3;i++){row.splice(i*4,4,...screen[i]);for(let j=0;j<4;j++)row[12+i*4+j]=tri[i][4+j]*screen[i][3];row[24+i]=tri[i][8]*screen[i][3];}
    row[27]=area;row[28]=p.alpha;if(!row.every(finiteF32))throw Error('Diagnostic GPU Float32 attribute range unsupported');
    if(texOffset===null)texOffset=textureAt(texture);
    const flags=Number(!!p.sampler.repeatS)|Number(!!p.sampler.repeatT)<<1|Number(!!p.sampler.flipS)<<2|Number(!!p.sampler.flipT)<<3|Number(p.alpha===1||!!(p.polygonAttribute&0x800))<<4|Number(!!color)<<5;
    const index=triangles.length;triangles.push({floats:row,ints:[flags,texOffset,texture.width,texture.height,x0,y0,x1,y1]});
    for(let ty=y0>>3;ty<=y1>>3;ty++)for(let tx=x0>>3;tx<=x1>>3;tx++){const bin=bins[ty*TILES_X+tx];if(bin.length>=limits.maxReferencesPerTile||referenceCount>=limits.maxTileReferences)throw Error('Diagnostic GPU tile-reference budget exceeded');bin.push(index);referenceCount++;}
   }
  }
 }
 if(nativeColor)stats.colorProcessing=colorStats;
 const triangleBytes=new ArrayBuffer(Math.max(DIAGNOSTIC_TRIANGLE_WORDS,triangles.length*DIAGNOSTIC_TRIANGLE_WORDS)*4),f32=new Float32Array(triangleBytes),u32=new Uint32Array(triangleBytes);triangles.forEach((row,i)=>{const at=i*DIAGNOSTIC_TRIANGLE_WORDS;f32.set(row.floats,at);u32.set(row.ints,at+32);});
 const refs=new Uint32Array(bins.length+1+referenceCount);let offset=0;for(let i=0;i<bins.length;i++){refs[i]=offset;refs.set(bins[i],bins.length+1+offset);offset+=bins[i].length;}refs[bins.length]=offset;
 const texels=new Uint32Array(Math.max(1,texelCount));offset=0;for(const t of textures)for(let i=0;i<t.pixels.length;i+=4)texels[offset++]=(t.pixels[i]|t.pixels[i+1]<<8|t.pixels[i+2]<<16|t.pixels[i+3]<<24)>>>0;
 const config=new Uint32Array([W,H,triangles.length,bins.length+1,clearRGBA[0],clearRGBA[1],clearRGBA[2],clearRGBA[3]]);
 return{triangleBytes,refs,texels,config,stats,triangleCount:triangles.length,texelCount,referenceCount,limits,scope:'Float64 host clipping; Float32 diagnostic pixel interpolation only; native rerender mandatory.'};
}

export const SOURCE_DIAGNOSTIC_COMPUTE_WGSL=String.raw`
struct Config { shape:vec4<u32>, clear:vec4<u32> }
struct Triangle { s0:vec4<f32>, s1:vec4<f32>, s2:vec4<f32>, a0:vec4<f32>, a1:vec4<f32>, a2:vec4<f32>, va:vec4<f32>, alpha:vec4<f32>, tex:vec4<u32>, bounds:vec4<u32> }
@group(0) @binding(0) var<uniform> cfg:Config;
@group(0) @binding(1) var<storage,read> triangles:array<Triangle>;
@group(0) @binding(2) var<storage,read> refs:array<u32>;
@group(0) @binding(3) var<storage,read> texels:array<u32>;
@group(0) @binding(4) var<storage,read_write> output:array<u32>;
fn edge(a:vec2<f32>,b:vec2<f32>,p:vec2<f32>)->f32{return(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);}
fn unpack(v:u32)->vec4<f32>{return vec4<f32>(f32(v&255u),f32((v>>8u)&255u),f32((v>>16u)&255u),f32(v>>24u));}
fn coordinate(v:f32,n:u32,repeat:bool,flip:bool)->u32{let at=i32(floor(v));if(!repeat){return u32(clamp(at,0,i32(n)-1));}let period=i32(select(n,n*2u,flip));let wrapped=((at%period)+period)%period;return u32(select(wrapped,period-1-wrapped,wrapped>=i32(n)));}
fn rounded(v:vec4<f32>)->vec4<f32>{return clamp(floor(v+vec4<f32>(0.5)),vec4<f32>(0.0),vec4<f32>(255.0));}
fn packed(v:vec4<f32>)->u32{let b=vec4<u32>(v);return b.x|(b.y<<8u)|(b.z<<16u)|(b.w<<24u);}
@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) group:vec3<u32>,@builtin(local_invocation_id) local:vec3<u32>){
 let tile=group.x;let x=(tile%16u)*8u+local.x%8u;let y=(tile/16u)*8u+local.x/8u;if(x>=cfg.shape.x||y>=cfg.shape.y){return;}
 let pixel=y*cfg.shape.x+x;let center=vec2<f32>(f32(x)+0.5,f32(y)+0.5);var color=vec4<f32>(cfg.clear);var depth=3.402823466e38;var hasDepth=false;var fragments=0u;var errors=0u;
 for(var at=refs[tile];at<refs[tile+1u];at=at+1u){let index=refs[cfg.shape.w+at];if(index>=cfg.shape.z){errors=errors|1u;continue;}let t=triangles[index];if(x<t.bounds.x||y<t.bounds.y||x>t.bounds.z||y>t.bounds.w){continue;}
  let weights=vec3<f32>(edge(t.s1.xy,t.s2.xy,center),edge(t.s2.xy,t.s0.xy,center),edge(t.s0.xy,t.s1.xy,center))/t.va.w;if(any(weights<vec3<f32>(0.0))){continue;}
  let z=(dot(weights,vec3<f32>(t.s0.z,t.s1.z,t.s2.z))+1.0)/2.0;if(!(abs(z)<=3.402823466e38)){errors=errors|2u;continue;}if(z>=depth){continue;}
  let iw=dot(weights,vec3<f32>(t.s0.w,t.s1.w,t.s2.w));if(iw==0.0){continue;}let attributes=(weights.x*t.a0+weights.y*t.a1+weights.z*t.a2)/iw;let v=dot(weights,t.va.xyz)/iw;
  if(!all(abs(attributes)<=vec4<f32>(3.402823466e38))||!(abs(v)<=1000001.0)||abs(attributes.w)>1000001.0){errors=errors|4u;continue;}
  let flags=t.tex.x;let sx=coordinate(attributes.w,t.tex.z,(flags&1u)!=0u,(flags&4u)!=0u);let sy=coordinate(v,t.tex.w,(flags&2u)!=0u,(flags&8u)!=0u);let ta=t.tex.y+sy*t.tex.z+sx;if(ta>=arrayLength(&texels)){errors=errors|8u;continue;}let texture=unpack(texels[ta]);let alpha=texture.w/255.0*t.alpha.x;if(alpha==0.0){continue;}
  var shaded=texture.xyz*attributes.xyz;if((flags&32u)!=0u){let vertex=vec3<u32>(clamp(attributes.xyz,vec3<f32>(0.0),vec3<f32>(63.0)));let tex=vec3<u32>(texture.xyz);let c=((tex+vec3<u32>(1u))*(vertex+vec3<u32>(1u))-vec3<u32>(1u))>>vec3<u32>(6u);shaded=vec3<f32>((c<<vec3<u32>(2u))|(c>>vec3<u32>(4u)));}
  let destinationAlpha=color.w/255.0;let outputAlpha=alpha+destinationAlpha*(1.0-alpha);color=rounded(vec4<f32>((shaded*alpha+color.xyz*destinationAlpha*(1.0-alpha))/outputAlpha,255.0*outputAlpha));if((flags&16u)!=0u){depth=z;hasDepth=true;}fragments=fragments+1u;
 }
 let outAt=pixel*4u;output[outAt]=packed(color);output[outAt+1u]=select(2139095040u,bitcast<u32>(depth),hasDepth);output[outAt+2u]=fragments;output[outAt+3u]=errors;
}
`;

const checkCurrent=isCurrent=>{if(!isCurrent())throw new DOMException('Diagnostic source raster cancelled','AbortError');};
async function compile(device){const module=device.createShaderModule({label:'Float32 source proposal diagnostics',code:SOURCE_DIAGNOSTIC_COMPUTE_WGSL});const info=await module.getCompilationInfo();const messages=info.messages.map(m=>({type:m.type,line:m.lineNum,column:m.linePos,message:m.message}));if(messages.some(m=>m.type==='error'))throw Error('Diagnostic WGSL compilation failed: '+messages.filter(m=>m.type==='error').map(m=>m.message).join('; '));const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});return{pipeline,messages};}
export function decodeDiagnosticRasterReadback(bytes,job){
 if(bytes.byteLength!==W*H*16)throw Error('Diagnostic GPU readback size mismatch');const values=new Uint32Array(bytes),depthValues=new Float32Array(bytes),rgba=new Uint8ClampedArray(W*H*4),previewDepth=new Float64Array(W*H);let fragments=0;
 for(let i=0;i<W*H;i++){const at=i*4;if(values[at+3])throw Error('Diagnostic GPU numerical/input error flags: '+values[at+3]);const packed=values[at];rgba[i*4]=packed&255;rgba[i*4+1]=(packed>>>8)&255;rgba[i*4+2]=(packed>>>16)&255;rgba[i*4+3]=packed>>>24;previewDepth[i]=depthValues[at+1];if(!Number.isFinite(previewDepth[i])&&previewDepth[i]!==Infinity)throw Error('Invalid diagnostic GPU depth');fragments+=values[at+2];}
 return{width:W,height:H,rgba,previewDepth,stats:{...job.stats,fragments},scope:'WebGPU Float32 diagnostic pixels with Float64 source clipping. Not DS pixel/depth/fog parity; final original-pixel native integer comparison remains mandatory.'};
}
async function submit(device,pipeline,job,isCurrent,onSubmitted){
 const U=globalThis.GPUBufferUsage,M=globalThis.GPUMapMode;if(!U||!M)throw Error('WebGPU constants unavailable');
 const inputs=[job.config,job.triangleBytes,job.refs,job.texels],sizes=inputs.map(x=>x.byteLength),outputSize=W*H*16;for(const n of [...sizes,outputSize])if(n>device.limits.maxBufferSize||n>device.limits.maxStorageBufferBindingSize)throw Error('Diagnostic GPU device buffer limit exceeded');if(device.limits.maxStorageBuffersPerShaderStage<4||device.limits.maxComputeInvocationsPerWorkgroup<64||device.limits.maxComputeWorkgroupSizeX<64||device.limits.maxComputeWorkgroupsPerDimension<TILES_X*TILES_Y)throw Error('Diagnostic GPU device compute limit unsupported');
 const buffers=[];let read=null,scoped=false,error=null,data=null;
 try{device.pushErrorScope('validation');scoped=true;const uploaded=inputs.map((value,i)=>{const buffer=device.createBuffer({label:'Diagnostic input '+i,size:value.byteLength,usage:(i===0?U.UNIFORM:U.STORAGE)|U.COPY_DST});buffers.push(buffer);device.queue.writeBuffer(buffer,0,value);return buffer;});const output=device.createBuffer({label:'Diagnostic output',size:outputSize,usage:U.STORAGE|U.COPY_SRC});buffers.push(output);read=device.createBuffer({label:'Diagnostic readback',size:outputSize,usage:U.COPY_DST|U.MAP_READ});buffers.push(read);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[...uploaded,output].map((buffer,binding)=>({binding,resource:{buffer}}))});const encoder=device.createCommandEncoder({label:'Source proposal diagnostic batch'}),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(TILES_X*TILES_Y);pass.end();encoder.copyBufferToBuffer(output,0,read,0,outputSize);checkCurrent(isCurrent);device.queue.submit([encoder.finish()]);onSubmitted();await read.mapAsync(M.READ);checkCurrent(isCurrent);data=read.getMappedRange().slice(0);read.unmap();
 }catch(e){error=e;}finally{if(scoped){try{const validation=await device.popErrorScope();if(validation&&!error)error=Error(validation.message);}catch(e){if(!error)error=e;}}for(const buffer of buffers)buffer.destroy();}
 if(error)throw error;return decodeDiagnosticRasterReadback(data,job);
}

/** Shared device is borrowed and never destroyed here. Initialization and GPU
 * submissions are serialized so error scopes and resource lifetimes cannot mix.
 * No successful GPU path runs rasterizePreviewPackets as a reference first. */
export function createDiagnosticRasterRenderer({deviceProvider=null,gpu=globalThis.navigator?.gpu,limits={},now=()=>performance.now()}={}){
 const bounds=limitsFor(limits);let initialization=null,session=null,generation=0,tail=Promise.resolve();
 function begin(){if(initialization)return initialization;const mine=generation;initialization=(async()=>{let device=null,owned=false;try{if(deviceProvider){const provided=await deviceProvider();device=provided?.device??null;if(!device)return{ready:false,reason:provided?.reason??'Shared source GPU device unavailable'};}else{if(!gpu)return{ready:false,reason:'WebGPU unavailable'};const adapter=await gpu.requestAdapter();if(!adapter)return{ready:false,reason:'WebGPU adapter unavailable'};device=await adapter.requestDevice();owned=true;}const compiled=await compile(device);if(mine!==generation){if(owned)device.destroy();return{ready:false,reason:'Diagnostic renderer released during initialization'};}session={ready:true,device,owned,...compiled};device.lost.then(info=>{if(mine===generation){session.ready=false;session.reason='Diagnostic GPU device lost: '+(info?.reason??'unknown');}});return session;}catch(error){if(owned)device?.destroy();return{ready:false,reason:error.message};}})();return initialization;}
 function render(packets,options,{isCurrent=()=>true}={}){const mine=generation;const run=async()=>{const start=now(),timings={adapterWaitMs:0,sourcePreparationMs:0,gpuSubmitReadbackMs:0,cpuFallbackMs:0};const check=()=>{checkCurrent(isCurrent);if(mine!==generation)throw new DOMException('Diagnostic renderer released','AbortError');};check();let reason=null,result=null,job=null,attempted=false,submissions=0,at=now();const current=await begin();timings.adapterWaitMs=now()-at;check();if(!current?.ready)reason=current?.reason??'Diagnostic GPU unavailable';else try{at=now();try{job=prepareDiagnosticRasterBatch(packets,options,bounds);}finally{timings.sourcePreparationMs=now()-at;}check();at=now();try{attempted=true;result=await submit(current.device,current.pipeline,job,()=>mine===generation&&isCurrent(),()=>{submissions++;});}finally{timings.gpuSubmitReadbackMs=now()-at;}check();}catch(error){if(error.name==='AbortError')throw error;reason='Diagnostic GPU fallback: '+error.message;result=null;}
   if(!result){check();at=now();try{result=rasterizePreviewPackets(packets,options);}finally{timings.cpuFallbackMs=now()-at;}check();}
   const pipeline={backend:reason?'cpu-float64-diagnostic-fallback':'webgpu-float32-diagnostic',fallbackReason:reason,gpuAttempted:attempted,gpuOutputUsed:!reason,finalAcceptance:false,nativeRerenderRequired:true,cpuReferenceRendered:false,timings:{...timings,totalMs:now()-start},batch:job?{triangles:job.triangleCount,tileReferences:job.referenceCount,textureTexels:job.texelCount,tiles:TILES_X*TILES_Y,submissions}:null,limits:bounds,timingScope:'Wall time, including upload/readback. Not GPU timestamps, utilization, parity or measured acceleration.'};return{...result,diagnosticPipeline:pipeline};};const pending=tail.then(run,run);tail=pending.catch(()=>{});return pending;}
 function destroy(){generation++;if(session?.owned)session.device.destroy();session=null;initialization=null;}
 return{begin,render,destroy};
}
