/* SPDX-License-Identifier: GPL-2.0-or-later
 * Dispatch caller-supplied, already prepared jobs in one submission. This does
 * not generate candidates or select environmental hypotheses. The shader and
 * each job's ordered polygon references remain unchanged.
 */
const need=(x,m)=>{if(!x)throw Error(m);};
const bytes=256*192*8*4,fields=['config','rows','references','texels','fogTable'];
export async function submitNativeIntegerBatch(device,pipeline,jobs){
 need(Array.isArray(jobs)&&jobs.length>0,'Nonempty explicit prepared job array required');
 const start=performance.now();
 for(const job of jobs){
  for(const k of fields){need(job[k] instanceof Uint32Array,'Uint32 '+k+' required');const size=Math.max(4,job[k].byteLength);need(size<=device.limits.maxBufferSize,'GPU buffer limit exceeded: '+k);if(k!=='config')need(size<=device.limits.maxStorageBufferBindingSize,'GPU storage binding limit exceeded: '+k);}
  need(job.config.length===16&&job.config[0]===256&&job.config[1]===192,'Native256x192 profile required');need(job.fogTable.length===32768,'Source fog LUT required');
 }
 need(bytes<=device.limits.maxBufferSize&&bytes<=device.limits.maxStorageBufferBindingSize,'GPU output buffer limit exceeded');
 const buffers=[],reads=[],outputs=[],groups=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
 try{
  for(const job of jobs){
   const inputs=fields.map((k,i)=>{const b=make(Math.max(4,job[k].byteLength),(i===0?GPUBufferUsage.UNIFORM:GPUBufferUsage.STORAGE)|GPUBufferUsage.COPY_DST);device.queue.writeBuffer(b,0,job[k]);return b;});
   const output=make(bytes,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),read=make(bytes,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);outputs.push(output);reads.push(read);
   groups.push(device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[...inputs,output].map((buffer,binding)=>({binding,resource:{buffer}}))}));
  }
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);
  for(const group of groups){pass.setBindGroup(0,group);pass.dispatchWorkgroups(768);}pass.end();
  for(let i=0;i<jobs.length;i++)encoder.copyBufferToBuffer(outputs[i],0,reads[i],0,bytes);
  device.queue.submit([encoder.finish()]);
  // allSettled keeps buffers alive until every mapping operation has finished,
  // including when one mapping fails or the device is lost.
  const maps=await Promise.allSettled(reads.map(read=>read.mapAsync(GPUMapMode.READ)));
  const failed=maps.find(v=>v.status==='rejected');if(failed)throw failed.reason;
  const elapsedMs=performance.now()-start;
  return reads.map(read=>{const words=new Uint32Array(read.getMappedRange()).slice();read.unmap();let errors=0;for(let i=7;i<words.length;i+=8)errors|=words[i];return{ready:errors===0,errorFlags:errors,words,elapsedMs,batchSize:jobs.length,timingScope:'Entire batch upload/compute/readback; not per-image elapsed time',scope:'GPU integer pixel/sample/depth/blend/fog only; CPU source geometry/scanlines/NORMAL retained'};});
 }finally{for(const b of buffers)b.destroy();}
}
