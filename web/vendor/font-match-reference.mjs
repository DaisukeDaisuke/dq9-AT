// Extracted without algorithm changes from font_akinator_webgpu.html.
// Source SHA256: 0d1b6f27fe40b2fb9b9c493723136f955aea8d849c9795af1e21b6b3d3daa351
const WORKGROUP=64,CSS_DPI=96,POINTS_PER_INCH=72;
const state={gpu:null};
function maskInfo(mask,w,h){let white=0,minX=w,minY=h,maxX=-1,maxY=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){white++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}if(!white)return{white:0,bounds:null};return{white,bounds:{minX,minY,maxX,maxY}};}
function buildPrefix(mask,w,h){const stride=w+1,out=new Uint32Array((w+1)*(h+1));for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){row+=mask[(y-1)*w+x-1];out[y*stride+x]=out[(y-1)*stride+x]+row;}}return out;}
async function getGPU(){
  if(state.gpu)return state.gpu;if(!navigator.gpu)throw new Error('WebGPUが利用できません。');const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('WebGPU adapterを取得できません。');const device=await adapter.requestDevice();
  const module=device.createShaderModule({code:`
struct Params {
  width:u32, height:u32, prefixStride:u32, glyphCount:u32,
  gridW:u32, gridH:u32, sizeCount:u32, posW:u32,
  posH:u32, sampleWhite:u32, sampleMinX:i32, sampleMinY:i32,
  shiftX:i32, shiftY:i32, cellUnitMilli:u32, unitsPerEm:u32,
  batchStart:u32, batchCount:u32, shiftStepMilli:u32, pad2:u32,
};
struct GlyphMeta { offset:u32, count:u32, minX:u32, minY:u32, maxX:u32, maxY:u32 };
@group(0) @binding(0) var<storage,read> prefix:array<u32>;
@group(0) @binding(1) var<storage,read> coords:array<u32>;
@group(0) @binding(2) var<storage,read> metas:array<GlyphMeta>;
@group(0) @binding(3) var<storage,read> sizeMilli:array<u32>;
@group(0) @binding(4) var<storage,read_write> results:array<u32>;
@group(0) @binding(5) var<uniform> p:Params;
fn rectSum(x0:u32,y0:u32,x1:u32,y1:u32)->u32{
  let a=prefix[y0*p.prefixStride+x0];let b=prefix[y0*p.prefixStride+x1];let c=prefix[y1*p.prefixStride+x0];let d=prefix[y1*p.prefixStride+x1];return d+a-b-c;
}
fn rasterEdge(v:f32)->i32{return i32(ceil(v-0.5));}
@compute @workgroup_size(${WORKGROUP})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let local=gid.x;if(local>=p.batchCount){return;}let candidate=p.batchStart+local;
  let posCount=p.posW*p.posH;let perGlyph=p.sizeCount*posCount;let glyphIndex=candidate/perGlyph;if(glyphIndex>=p.glyphCount){return;}
  let rem=candidate-glyphIndex*perGlyph;let sizeIndex=rem/posCount;let posIndex=rem-sizeIndex*posCount;
  let dx=f32(i32(posIndex%p.posW)-p.shiftX)*f32(p.shiftStepMilli)/1000.0;let dy=f32(i32(posIndex/p.posW)-p.shiftY)*f32(p.shiftStepMilli)/1000.0;
  let pt=f32(sizeMilli[sizeIndex])/1000.0;let cssPx=pt*${CSS_DPI}.0/${POINTS_PER_INCH}.0;
  let scale=cssPx*(f32(p.cellUnitMilli)/1000.0)/f32(p.unitsPerEm);
  let m=metas[glyphIndex];let topX=f32(p.sampleMinX)-f32(m.minX)*scale+f32(dx);let topY=f32(p.sampleMinY)-f32(m.minY)*scale+f32(dy);
  var candidateWhite=0u;var intersection=0u;var i=0u;
  loop{
    if(i>=m.count){break;}let packed=coords[m.offset+i];let sx=packed&65535u;let sy=packed>>16u;
    var x0=rasterEdge(topX+f32(sx)*scale);var x1=rasterEdge(topX+f32(sx+1u)*scale);var y0=rasterEdge(topY+f32(sy)*scale);var y1=rasterEdge(topY+f32(sy+1u)*scale);
    x0=clamp(x0,0,i32(p.width));x1=clamp(x1,0,i32(p.width));y0=clamp(y0,0,i32(p.height));y1=clamp(y1,0,i32(p.height));
    if(x1>x0&&y1>y0){let ux0=u32(x0);let ux1=u32(x1);let uy0=u32(y0);let uy1=u32(y1);candidateWhite+=u32((x1-x0)*(y1-y0));intersection+=rectSum(ux0,uy0,ux1,uy1);}
    i++;
  }
  results[local]=p.sampleWhite+candidateWhite-2u*intersection;
}`});
  const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error('WGSL compile error: '+errors.map(e=>e.message).join(' / '));
  const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});state.gpu={adapter,device,pipeline};return state.gpu;
}

function makeBuffer(device,typed,usage){const size=Math.max(4,(typed.byteLength+3)&~3);const b=device.createBuffer({size,usage,mappedAtCreation:true});new Uint8Array(b.getMappedRange()).set(new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength));b.unmap();return b;}
export {getGPU,makeBuffer,maskInfo,buildPrefix};
