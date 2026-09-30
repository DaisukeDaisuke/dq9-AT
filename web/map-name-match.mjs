import {getGPU,makeBuffer,maskInfo,buildPrefix} from './vendor/font-match-reference.mjs';
import {GlyphAkinatorMatcher,buildGlyphAkinatorDictionary} from './font-akinator.mjs';
export {GlyphAkinatorMatcher,buildGlyphAkinatorDictionary} from './font-akinator.mjs';
// Explicit routes keep the existing whole-name reference available.
export function createTextMatcher({route,glyphsBySize,records=[]}){
 if(route==='glyph-akinator')return new GlyphAkinatorMatcher(buildGlyphAkinatorDictionary(glyphsBySize));
 if(route==='whole-name-reference')return new MapNameMatcher(buildMapNameDictionary(glyphsBySize,records));
 throw Error('Choose glyph-akinator or whole-name-reference');
}
// Use ROM glyph rows directly; no rendered system-font substitute and no TTF re-mining.
export function buildMapNameDictionary(glyphsBySize,records){
 const names=new Map();for(const r of records){if(!r.name||r.name===r.fieldCode||/^0x|^map_/i.test(r.name))continue;const ids=names.get(r.name)||[];if(!ids.includes(r.mapId))ids.push(r.mapId);names.set(r.name,ids);}
 const templates=[],coords=[],metas=[];
 for(const[size,glyphs]of Object.entries(glyphsBySize)){const [cw,ch]=size.split('x').map(Number),lookup=new Map(glyphs.map(g=>[g.char,g]));
  for(const [name,mapIds]of names)for(const spacing of [0,1]){const chars=[...name],width=chars.length*(cw+spacing)-spacing;if(width>256||chars.some(c=>c!==' '&&!lookup.has(c)))continue;
   const offset=coords.length;let minX=width,minY=ch,maxX=-1,maxY=-1;
   chars.forEach((c,i)=>{const glyph=lookup.get(c);if(!glyph)return;glyph.rows.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x]==='#'){const xx=i*(cw+spacing)+x;coords.push((y<<16)|xx);minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}});});
   const count=coords.length-offset;if(!count)continue;metas.push(offset,count,minX,minY,maxX,maxY);templates.push({name,mapIds,size,spacing,width,height:ch,pixelCount:count});
  }
 }
 return {templates,coords:Uint32Array.from(coords),metas:Uint32Array.from(metas),source:'runtime NDS glyph rows + existing map names',scope:'dictionary candidates; unknown text remains possible'};
}
export class MapNameMatcher {
 constructor(dictionary){this.dictionary=dictionary;this.buffers=null;this.device=null;this.route='whole-name-reference';}
 destroy(){if(this.buffers)for(const b of Object.values(this.buffers))b.destroy();this.buffers=null;this.device=null;}
 async match(image,{threshold=220,shift=2}={}){
  const {device,pipeline}=await getGPU(),d=this.dictionary;if(!d.templates.length)throw Error('マップ名辞書に対応する実フォントがありません');
  const width=image.width,height=image.height,mask=new Uint8Array(width*height);
  // Same any-channel white binarization as font_akinator_webgpu.html; threshold is user-calibrated.
  for(let i=0;i<mask.length;i++){const k=i*4;mask[i]=(image.data[k]>threshold||image.data[k+1]>threshold||image.data[k+2]>threshold)?1:0;}
  const info=maskInfo(mask,width,height);if(!info.white)return {candidates:[],reason:'white-pixels-absent',confidenceCalibrated:false};
  if(!this.buffers||this.device!==device){this.destroy();this.device=device;this.buffers={coords:makeBuffer(device,d.coords,GPUBufferUsage.STORAGE),metas:makeBuffer(device,d.metas,GPUBufferUsage.STORAGE),sizes:makeBuffer(device,new Uint32Array([750]),GPUBufferUsage.STORAGE)};}
  const posW=shift*2+1,total=d.templates.length*posW*posW,limit=Math.min(1000000,Number(device.limits.maxStorageBufferBindingSize)/4,Number(device.limits.maxComputeWorkgroupsPerDimension)*64),cap=Math.min(total,Math.floor(limit));
  const prefix=makeBuffer(device,buildPrefix(mask,width,height),GPUBufferUsage.STORAGE),output=device.createBuffer({size:Math.max(4,cap*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size:Math.max(4,cap*4),usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),params=device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[prefix,this.buffers.coords,this.buffers.metas,this.buffers.sizes,output,params].map((buffer,binding)=>({binding,resource:{buffer}}))});
  const values=new Uint32Array([width,height,width+1,d.templates.length,256,height,1,posW,posW,info.white,info.bounds.minX,info.bounds.minY,shift,shift,1000,1,0,0,1000,0]),best=new Map();
  try{for(let start=0;start<total;start+=cap){const count=Math.min(cap,total-start);values[16]=start;values[17]=count;device.queue.writeBuffer(params,0,values);const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();encoder.copyBufferToBuffer(output,0,read,0,count*4);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ,0,count*4);const scores=new Uint32Array(read.getMappedRange(0,count*4));
   for(let j=0;j<count;j++){const index=start+j,templateIndex=Math.floor(index/(posW*posW)),t=d.templates[templateIndex],previous=best.get(t.name);if(!previous||scores[j]<previous.difference){const p=index%(posW*posW);best.set(t.name,{...t,difference:scores[j],differencePerWhitePixel:scores[j]/info.white,dx:p%posW-shift,dy:Math.floor(p/posW)-shift});}}read.unmap();}
   return {candidates:[...best.values()].sort((a,b)=>a.difference-b.difference).slice(0,5),whitePixels:info.white,evaluated:total,confidenceCalibrated:false,unknownTextPossible:true};
  }finally{for(const b of [prefix,output,read,params])b.destroy();}
 }
}
