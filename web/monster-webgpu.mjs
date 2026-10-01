// Static, unlit material preview only. No image classification or AT effects.
const contextOwners=new WeakMap();
export class WebGPUUnavailableError extends Error {constructor(message){super(message);this.name='WebGPUUnavailableError';}}
export function previewMatrix(bounds,aspect=1,yaw=0,pitch=0){
 const center=bounds.min.map((v,i)=>(v+bounds.max[i])/2),extent=Math.max(...bounds.max.map((v,i)=>v-bounds.min[i]));
 if(!Number.isFinite(extent)||extent<=0)throw Error('Empty model bounds');
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),s=1.7/extent,rows=[[cy,0,sy],[sp*sy,cp,-sp*cy],[-cp*sy,sp,cp*cy]],scales=[s/aspect,s,-1/(3*extent)];
 const m=new Float32Array(16);for(let row=0;row<3;row++){for(let c=0;c<3;c++)m[c*4+row]=rows[row][c]*scales[row];m[12+row]=-rows[row].reduce((n,v,i)=>n+v*center[i],0)*scales[row]+(row===2?.5:0);}m[15]=1;return m;
}
// Common scale for every orientation. The bounding sphere prevents rotated
// corners clipping without independently resizing each template.
export function templateMatrix(bounds,yaw=0,pitch=0){
 const center=bounds.min.map((v,i)=>(v+bounds.max[i])/2),radius=Math.hypot(...bounds.max.map((v,i)=>(v-bounds.min[i])/2));
 return previewMatrix({min:center.map(v=>v-radius),max:center.map(v=>v+radius)},1,yaw,pitch);
}
const abortIfNeeded=signal=>{if(signal?.aborted)throw new DOMException('Template generation cancelled','AbortError');};
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const shader=`
struct View { mvp: mat4x4<f32> }
@group(0) @binding(0) var<uniform> view: View;
@group(1) @binding(0) var textureImage: texture_2d<f32>;
@group(1) @binding(1) var textureSampler: sampler;
struct In { @location(0) position: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) color: vec3<f32> }
struct Out { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) color: vec3<f32> }
@vertex fn vertexMain(v: In) -> Out { var out: Out; out.position=view.mvp*vec4<f32>(v.position,1.0); out.uv=v.uv; out.color=v.color; return out; }
@fragment fn fragmentMain(v: Out) -> @location(0) vec4<f32> { let tex=textureSample(textureImage,textureSampler,v.uv); if(tex.a<0.5){discard;} return vec4<f32>(tex.rgb*v.color,tex.a); }
`;
export class MonsterWebGPU {
 static async create(canvas,onLost=()=>{}){
  if(!globalThis.navigator?.gpu)throw new WebGPUUnavailableError('WebGPUを利用できません。3D表示と認識は実行されません');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new WebGPUUnavailableError('WebGPU adapterがありません。3D表示と認識は実行されません');
  const device=await adapter.requestDevice(),context=canvas.getContext('webgpu');if(!context){device.destroy();throw new WebGPUUnavailableError('WebGPU canvasが利用できません');}
  const renderer=new MonsterWebGPU(canvas,device,context,onLost);const info=adapter.info;renderer.adapterInfo=info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:{description:'Adapter details not exposed by browser'};try{await renderer.init();if(renderer.disposed)throw Error('WebGPU device lost during initialization');return renderer;}catch(error){renderer.destroy();throw error;}
 }
 constructor(canvas,device,context,onLost){Object.assign(this,{canvas,device,context,onLost,resources:[],sceneResources:[],auxResources:new Set(),templateBusy:false,disposed:false,model:null,yaw:0,pitch:Math.PI/4});device.addEventListener('uncapturederror',event=>{if(!this.disposed){this.destroy();onLost('WebGPU error: '+event.error.message);}});device.lost.then(info=>{if(!this.disposed){this.disposed=true;this.releaseScene();this.depth?.destroy();for(const r of this.resources)r.destroy();for(const r of this.auxResources)r.destroy();this.auxResources.clear();if(contextOwners.get(context)===this){context.unconfigure();contextOwners.delete(context);}onLost('WebGPU device lost: '+info.message);}});}
 async init(){
  const d=this.device;this.format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:d,format:this.format,alphaMode:'opaque'});contextOwners.set(this.context,this);
  const module=d.createShaderModule({label:'Monster static unlit material preview',code:shader});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw Error(info.messages.map(m=>m.message).join('\n'));
  this.viewLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:'uniform'}}]});
  this.textureLayout=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]});
  const layout=d.createPipelineLayout({bindGroupLayouts:[this.viewLayout,this.textureLayout]});this.pipelines={};
  for(const cullMode of ['none','back','front'])this.pipelines[cullMode]=await d.createRenderPipelineAsync({layout,vertex:{module,entryPoint:'vertexMain',buffers:[{arrayStride:44,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x2'},{shaderLocation:2,offset:20,format:'float32x3'}]}]},fragment:{module,entryPoint:'fragmentMain',targets:[{format:this.format}]},primitive:{topology:'triangle-list',frontFace:'ccw',cullMode},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
  this.uniform=d.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.resources.push(this.uniform);
  this.view=d.createBindGroup({layout:this.viewLayout,entries:[{binding:0,resource:{buffer:this.uniform}}]});
 }
 releaseScene(){for(const r of this.sceneResources)r.destroy();this.sceneResources=[];this.model=null;this.bindings=[];}
 uploadScene(model,resources){
  if(model.billboards?.length||model.materials.some(m=>m.wireframe||m.translucent))throw Error('Extended billboard/alpha/wireframe models require the CPU template renderer; GPU support is not yet validated');
  const d=this.device,upload=(data,usage)=>{const b=d.createBuffer({size:Math.max(4,data.byteLength),usage:usage|GPUBufferUsage.COPY_DST});resources.push(b);d.queue.writeBuffer(b,0,data);return b;};
  const vertex=upload(model.vertices,GPUBufferUsage.VERTEX),index=upload(model.indices,GPUBufferUsage.INDEX);
  const bindings=model.materials.map(mat=>{const texture=d.createTexture({size:[mat.width,mat.height],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});resources.push(texture);d.queue.writeTexture({texture},mat.rgba,{bytesPerRow:mat.width*4,rowsPerImage:mat.height},[mat.width,mat.height]);
   const address=axis=>{const repeat=!!(mat.textureParams&(1<<(16+axis))),mirror=!!(mat.textureParams&(1<<(18+axis)));return repeat?(mirror?'mirror-repeat':'repeat'):'clamp-to-edge';};
   const sampler=d.createSampler({magFilter:'nearest',minFilter:'nearest',addressModeU:address(0),addressModeV:address(1)});return d.createBindGroup({layout:this.textureLayout,entries:[{binding:0,resource:texture.createView()},{binding:1,resource:sampler}]});});
  return{vertex,index,bindings,model};
 }
 encodeScene(pass,scene,view){
  pass.setBindGroup(0,view);pass.setVertexBuffer(0,scene.vertex);pass.setIndexBuffer(scene.index,'uint32');
  for(const call of scene.model.drawCalls){const mat=scene.model.materials[call.materialId];if(mat.cullBack&&mat.cullFront)continue;pass.setPipeline(this.pipelines[mat.cullBack?'back':mat.cullFront?'front':'none']);pass.setBindGroup(1,scene.bindings[call.materialId]);pass.drawIndexed(call.indexCount,1,call.firstIndex);}
 }
 async setModel(model){
  if(this.disposed)throw Error('WebGPU renderer released');if(this.templateBusy)throw Error('Cancel template generation before replacing model');this.releaseScene();const d=this.device;d.pushErrorScope('validation');let failure;
  try{Object.assign(this,this.uploadScene(model,this.sceneResources));this.yaw=0;this.pitch=Math.PI/4;this.draw();await d.queue.onSubmittedWorkDone();}catch(error){failure=error;}
  const validation=await d.popErrorScope();if(failure||validation){this.releaseScene();throw failure||Error(validation.message);}
 }
 // Offscreen GPU work only, independent of OBS/video frame cadence.
 async createTemplateAtlas(model,{views,tileSize=64,signal,onProgress=()=>{},batchViews=2}={}){
  if(this.disposed)throw Error('WebGPU renderer released');if(this.templateBusy)throw Error('Template generation already active');abortIfNeeded(signal);
  if(!Array.isArray(views)||!views.length||views.length>16||views.some(v=>!Number.isFinite(v.yaw)||!Number.isFinite(v.pitch)))throw Error('Choose 1..16 finite template orientations');
  if(![32,64,128].includes(tileSize)||!Number.isInteger(batchViews)||batchViews<1||batchViews>2)throw Error('Unsupported template tile/batch budget');
  const modelBytes=model.vertices.byteLength+model.indices.byteLength+model.materials.reduce((n,m)=>n+m.rgba.byteLength,0);if(modelBytes>8*1024*1024)throw Error('Template source exceeds 8 MiB upload budget');
  const d=this.device,columns=Math.min(4,views.length),rows=Math.ceil(views.length/columns),width=columns*tileSize,height=rows*tileSize,resources=[],start=performance.now();
  this.templateBusy=true;d.pushErrorScope('out-of-memory');d.pushErrorScope('validation');let texture,output,failure;
  const keep=r=>{resources.push(r);this.auxResources.add(r);return r;};
  try{
   const scene=this.uploadScene(model,resources);for(const r of resources)this.auxResources.add(r);
   texture=keep(d.createTexture({label:'Bounded monster orientation atlas',size:[width,height],format:this.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}));
   const depth=keep(d.createTexture({size:[width,height],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT})),stride=Math.ceil(64/(d.limits?.minUniformBufferOffsetAlignment||256))*(d.limits?.minUniformBufferOffsetAlignment||256),uniforms=keep(d.createBuffer({size:stride*views.length,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})),matrices=new Float32Array(stride*views.length/4);
   views.forEach((v,i)=>matrices.set(templateMatrix(model.templateBounds??model.bounds,v.yaw,v.pitch),i*stride/4));d.queue.writeBuffer(uniforms,0,matrices);
   const bindings=views.map((_,i)=>d.createBindGroup({layout:this.viewLayout,entries:[{binding:0,resource:{buffer:uniforms,offset:i*stride,size:64}}]}));
   for(let first=0;first<views.length;first+=batchViews){abortIfNeeded(signal);if(this.disposed)throw Error('WebGPU renderer released');const encoder=d.createCommandEncoder();
    for(let i=first;i<Math.min(views.length,first+batchViews);i++){const pass=encoder.beginRenderPass({colorAttachments:[{view:texture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:i===0?'clear':'load',storeOp:'store'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});pass.setViewport((i%columns)*tileSize,Math.floor(i/columns)*tileSize,tileSize,tileSize,0,1);pass.setScissorRect((i%columns)*tileSize,Math.floor(i/columns)*tileSize,tileSize,tileSize);this.encodeScene(pass,scene,bindings[i]);pass.end();}
    d.queue.submit([encoder.finish()]);await d.queue.onSubmittedWorkDone();abortIfNeeded(signal);onProgress({completedViews:Math.min(views.length,first+batchViews),totalViews:views.length});await yieldTask();
   }
   abortIfNeeded(signal);if(this.disposed)throw Error('WebGPU renderer released');let destroyed=false;
   output={texture,width,height,format:this.format,tileSize,byteLength:width*height*4,renderedViews:views.length,views:views.map((v,i)=>({...v,x:(i%columns)*tileSize,y:Math.floor(i/columns)*tileSize})),wallMs:performance.now()-start,fit:'common-bounding-sphere',background:'transparent',recognitionEvidence:false,destroy:()=>{if(!destroyed){destroyed=true;texture.destroy();this.auxResources.delete(texture);}},get destroyed(){return destroyed;}};
  }catch(error){failure=error;}
  try{for(let i=0;i<2;i++){try{const issue=await d.popErrorScope();if(issue&&!failure)failure=Error(issue.message);}catch(error){failure??=error;}}}catch(error){failure??=error;}
  finally{for(const r of resources)if(r!==texture||failure){r.destroy();this.auxResources.delete(r);}this.templateBusy=false;}
  if(failure)throw failure;return output;
 }
 // Optional, one-time contact-sheet readback; rendering remains real WebGPU.
 async readTemplateAtlas(atlas,signal){
  abortIfNeeded(signal);if(this.disposed||atlas.destroyed)throw Error('Template atlas released');const d=this.device,bytesPerRow=Math.ceil(atlas.width*4/256)*256;
  const buffer=d.createBuffer({size:bytesPerRow*atlas.height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});this.auxResources.add(buffer);
  try{const encoder=d.createCommandEncoder();encoder.copyTextureToBuffer({texture:atlas.texture},{buffer,bytesPerRow,rowsPerImage:atlas.height},[atlas.width,atlas.height]);d.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);abortIfNeeded(signal);if(this.disposed||atlas.destroyed)throw Error('Template atlas released');const mapped=new Uint8Array(buffer.getMappedRange()),rgba=new Uint8ClampedArray(atlas.width*atlas.height*4);
   for(let y=0;y<atlas.height;y++)for(let x=0;x<atlas.width;x++){const source=y*bytesPerRow+x*4,target=(y*atlas.width+x)*4;if(atlas.format==='bgra8unorm'){rgba[target]=mapped[source+2];rgba[target+1]=mapped[source+1];rgba[target+2]=mapped[source];}else if(atlas.format==='rgba8unorm'){rgba.set(mapped.subarray(source,source+3),target);}else throw Error('Unsupported atlas readback format '+atlas.format);rgba[target+3]=mapped[source+3];}return rgba;
  }finally{buffer.unmap();buffer.destroy();this.auxResources.delete(buffer);}
 }

 draw(){if(this.disposed||!this.model)return;const{canvas,device:d,model}=this,w=canvas.width,h=canvas.height;
  if(!this.depth||this.depth.width!==w||this.depth.height!==h){this.depth?.destroy();this.depth=d.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}
  d.queue.writeBuffer(this.uniform,0,previewMatrix(model.bounds,w/h,this.yaw,this.pitch));const encoder=d.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.06,g:.075,b:.1,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
  this.encodeScene(pass,this,this.view);
  pass.end();d.queue.submit([encoder.finish()]);
 }
 destroy(){if(this.disposed)return;this.disposed=true;this.releaseScene();this.depth?.destroy();for(const r of this.resources)r.destroy();for(const r of this.auxResources)r.destroy();this.auxResources.clear();if(contextOwners.get(this.context)===this){this.context.unconfigure();contextOwners.delete(this.context);}this.device.destroy();}
}
