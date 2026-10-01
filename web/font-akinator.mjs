import {getGPU,makeBuffer,maskInfo,buildPrefix} from './vendor/font-match-reference.mjs';

// Same exhaustive pixel-difference search as the supplied font Akinator.
// Source glyphs are already mined from the local ROM: no TTF round trip,
// system font substitution, remote assets, or dictionary-based pruning.
export const CPU_AKINATOR_LIMITS=Object.freeze({width:256,height:192,glyphs:4096,glyphCells:1048576,coordinates:1048576,evaluations:2000000,characters:32,alternatives:8,scales:6,milliseconds:10000});

function validateCpuGlyphMetadata(g){
 for(const [field,limit] of [['char',8],['assignedChar',8],['source',256],['cp932Hex',8]])if(g[field]!=null&&(typeof g[field]!=='string'||g[field].length>limit))throw Error('Invalid CPU glyph text metadata');
 for(const [field,limit] of [['assignedCodepoint',0x10ffff],['sourceIndex',0xffffffff]])if(g[field]!=null&&(!Number.isSafeInteger(g[field])||g[field]<0||g[field]>limit))throw Error('Invalid CPU glyph numeric metadata');
 if(g.aliases!=null){
  if(!Array.isArray(g.aliases)||g.aliases.length>32)throw Error('Invalid CPU glyph aliases');
  for(let i=0;i<g.aliases.length;i++)if(!Object.hasOwn(g.aliases,i)||typeof g.aliases[i]!=='string'||g.aliases[i].length>16)throw Error('Invalid CPU glyph alias');
 }
}

// Preflight the input before allocating packed coordinates or font subsets.
export function validateCpuGlyphInput(glyphsBySize){
 if(!glyphsBySize||typeof glyphsBySize!=='object'||Array.isArray(glyphsBySize))throw Error('Invalid CPU ROM glyph input');
 let glyphs=0,glyphCells=0,fontCount=0;
 for(const [fontId,items] of Object.entries(glyphsBySize)){
  if(++fontCount>CPU_AKINATOR_LIMITS.glyphs)throw Error('CPU ROM font count budget exceeded');
  if(!/^\d{1,5}x\d{1,5}$/.test(fontId))throw Error('Invalid CPU ROM font grid');
  const [width,height,...extra]=fontId.split('x').map(Number);
  if(extra.length||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>65535||height>65535||!Array.isArray(items))throw Error('Invalid CPU ROM font grid');
  glyphs+=items.length;glyphCells+=items.length*width*height;
  if(glyphs>CPU_AKINATOR_LIMITS.glyphs||glyphCells>CPU_AKINATOR_LIMITS.glyphCells)throw Error('CPU ROM glyph budget exceeded');
  for(let i=0;i<items.length;i++){
   const glyph=items[i];
   if(!Object.hasOwn(items,i)||!glyph||!Array.isArray(glyph.rows)||glyph.rows.length!==height)throw Error('Invalid CPU ROM glyph rows');
   for(let y=0;y<height;y++)if(!Object.hasOwn(glyph.rows,y)||typeof glyph.rows[y]!=='string'||glyph.rows[y].length!==width||/[^.#]/.test(glyph.rows[y]))throw Error('Invalid CPU ROM glyph rows');
   validateCpuGlyphMetadata(glyph);
  }
 }
 return {glyphs,glyphCells};
}

// Only bounded scoring/result fields cross the worker boundary. This does not
// traverse arbitrary input metadata, even if an unused property has a getter.
export function snapshotCpuGlyphInput(glyphsBySize){
 validateCpuGlyphInput(glyphsBySize);
 const snapshot={};
 for(const [fontId,items] of Object.entries(glyphsBySize))snapshot[fontId]=items.map(g=>({
  rows:g.rows.slice(),char:g.char,assignedChar:g.assignedChar,assignedCodepoint:g.assignedCodepoint,
  aliases:g.aliases?.slice()??[],source:g.source,sourceIndex:g.sourceIndex,cp932Hex:g.cp932Hex
 }));
 return snapshot;
}

export function buildGlyphAkinatorDictionary(glyphsBySize,{backend='webgpu'}={}){
 const inputBounds=backend==='cpu-reference'?validateCpuGlyphInput(glyphsBySize):null;
 const glyphs=[],coords=[],metas=[];let blankGlyphs=0;
 for(const [fontId,items] of Object.entries(glyphsBySize)){
  const [width,height]=fontId.split('x').map(Number);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>65535||height>65535)throw Error('Invalid ROM font grid');
  for(const g of items){
   const offset=coords.length;let minX=width,minY=height,maxX=-1,maxY=-1;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(g.rows?.[y]?.[x]==='#'){
    coords.push((y<<16)|x);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   }
   const count=coords.length-offset;if(!count){blankGlyphs++;continue;}
   const glyphIndex=glyphs.length;metas.push(offset,count,minX,minY,maxX,maxY);
   glyphs.push({glyphIndex,fontId,width,height,advance:width,char:g.assignedChar||g.char,
    originalChar:g.char,assignedCodepoint:g.assignedCodepoint,aliases:g.aliases||[],
    source:g.source,sourceIndex:g.sourceIndex,cp932:g.cp932Hex,minX,minY,pixelCount:count});
  }
 }
 return {glyphs,coords:Uint32Array.from(coords),metas:Uint32Array.from(metas),blankGlyphs,
  source:'runtime ROM glyph rows',fontIds:Object.keys(glyphsBySize),...(inputBounds?{inputBounds}:{})};
}

function validateCpuDictionary(d){
 if(!d||!Array.isArray(d.glyphs)||d.glyphs.length>CPU_AKINATOR_LIMITS.glyphs||!(d.coords instanceof Uint32Array)||d.coords.length>CPU_AKINATOR_LIMITS.coordinates||!(d.metas instanceof Uint32Array)||d.metas.length!==d.glyphs.length*6||!Array.isArray(d.fontIds)||d.fontIds.length>CPU_AKINATOR_LIMITS.glyphs)throw Error('Invalid CPU glyph dictionary bounds');
 const fontIds=new Set(d.fontIds);
 if(fontIds.size!==d.fontIds.length||[...fontIds].some(id=>typeof id!=='string'||!/^\d{1,5}x\d{1,5}$/.test(id)))throw Error('Invalid CPU glyph dictionary fonts');
 let cells=0;
 for(let i=0;i<d.glyphs.length;i++){
  const g=d.glyphs[i],m=i*6;
  if(!g||!fontIds.has(g.fontId)||!Number.isInteger(g.width)||!Number.isInteger(g.height)||g.width<1||g.height<1||g.width>65535||g.height>65535||g.glyphIndex!==i||!Number.isInteger(g.minX)||g.minX<0||g.minX>=g.width||!Number.isInteger(g.minY)||g.minY<0||g.minY>=g.height||g.advance!==g.width||d.metas[m]+d.metas[m+1]>d.coords.length||d.metas[m+1]>g.width*g.height||d.metas[m+2]!==g.minX||d.metas[m+3]!==g.minY)throw Error('Invalid CPU glyph dictionary metadata');
  validateCpuGlyphMetadata(g);
  cells+=g.width*g.height;
  if(cells>CPU_AKINATOR_LIMITS.glyphCells)throw Error('CPU ROM glyph cell budget exceeded');
 }
}

export function validateCpuAkinatorRequest(image,options={}){
 const {threshold=220,charCount=16,topN=8,maxEvaluations=2000000,maxMilliseconds=1500,scales=[0.95,1,1.05]}=options;
 if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.width>CPU_AKINATOR_LIMITS.width||image.height<1||image.height>CPU_AKINATOR_LIMITS.height||!(image.data instanceof Uint8Array||image.data instanceof Uint8ClampedArray)||image.data.length!==image.width*image.height*4)throw Error('CPU Akinator requires an RGBA ROI no larger than 256x192');
 if(!Number.isInteger(charCount)||charCount<1||charCount>CPU_AKINATOR_LIMITS.characters||!Number.isInteger(topN)||topN<1||topN>CPU_AKINATOR_LIMITS.alternatives||!Number.isFinite(threshold)||threshold<0||threshold>255||!Number.isSafeInteger(maxEvaluations)||maxEvaluations<1||maxEvaluations>CPU_AKINATOR_LIMITS.evaluations||!Number.isFinite(maxMilliseconds)||maxMilliseconds<=0||maxMilliseconds>CPU_AKINATOR_LIMITS.milliseconds||!Array.isArray(scales)||!scales.length||scales.length>CPU_AKINATOR_LIMITS.scales)throw Error('Invalid CPU Akinator budget or options');
 for(let i=0;i<scales.length;i++)if(!Object.hasOwn(scales,i)||!Number.isFinite(scales[i]))throw Error('Invalid CPU font scales');
 // Validate the remaining scalar search parameters before any large allocation.
 akinatorSearchSpec(options);
}

export function akinatorSearchSpec({scales=[0.95,1,1.05],shiftX=1,shiftY=1,shiftStep=0.5}={}){
 if(!Array.isArray(scales)||!scales.length||scales.length>128||scales.some(s=>!Number.isFinite(s)||s<=0||s>32))throw Error('Invalid font scales');
 if(![shiftX,shiftY,shiftStep].every(Number.isFinite)||shiftX<0||shiftY<0||shiftX>64||shiftY>64||shiftStep<0.01||shiftStep>8)throw Error('Invalid glyph shift range');
 const stepMilli=Math.round(shiftStep*1000),step=stepMilli/1000,xSteps=Math.floor(shiftX/step),ySteps=Math.floor(shiftY/step);
 // Kernel converts points to CSS pixels. 0.75 pt produces exactly 1 pixel.
 const sizes=Uint32Array.from([...new Set(scales.map(s=>Math.round(s*750)))]);
 return {sizes,scales:[...sizes].map(s=>s/750),stepMilli,step,xSteps,ySteps,posW:xSteps*2+1,posH:ySteps*2+1};
}

export function decodeAkinatorIndex(index,spec){
 const positions=spec.posW*spec.posH,perGlyph=positions*spec.sizes.length,glyphIndex=Math.floor(index/perGlyph),rem=index%perGlyph,sizeIndex=Math.floor(rem/positions),pos=rem%positions;
 return {glyphIndex,sizeIndex,scale:spec.scales[sizeIndex],dx:(pos%spec.posW-spec.xSteps)*spec.step,dy:(Math.floor(pos/spec.posW)-spec.ySteps)*spec.step,index};
}
function order(a,b){return a.difference-b.difference||(Math.abs(a.dx)+Math.abs(a.dy))-(Math.abs(b.dx)+Math.abs(b.dy))||Math.abs(a.scale-1)-Math.abs(b.scale-1)||a.index-b.index;}
export function rasterizeAkinatorCandidate(dictionary,candidate,width,height){
 const out=new Uint8Array(width*height),m=candidate.glyphIndex*6,start=dictionary.metas[m],count=dictionary.metas[m+1],s=candidate.scale;
 const edge=v=>Math.ceil(v-0.5);
 for(let i=start;i<start+count;i++){
  const packed=dictionary.coords[i],x=packed&65535,y=packed>>>16;
  const x0=Math.max(0,Math.min(width,edge(candidate.topX+x*s))),x1=Math.max(0,Math.min(width,edge(candidate.topX+(x+1)*s))),y0=Math.max(0,Math.min(height,edge(candidate.topY+y*s))),y1=Math.max(0,Math.min(height,edge(candidate.topY+(y+1)*s)));
  for(let yy=y0;yy<y1;yy++)out.fill(1,yy*width+x0,yy*width+x1);
 }
 return out;
}
export function eraseAkinatorCandidate(residual,dictionary,candidate,width,height){
 const before=residual.reduce((a,b)=>a+b,0),mask=rasterizeAkinatorCandidate(dictionary,candidate,width,height);
 const x0=Math.max(0,Math.min(width,Math.ceil(candidate.topX-0.5))),x1=Math.max(0,Math.min(width,Math.ceil(candidate.topX+candidate.advance*candidate.scale-0.5)));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if((x>=x0&&x<x1)||mask[y*width+x])residual[y*width+x]=0;
 return before-residual.reduce((a,b)=>a+b,0);
}

// The JavaScript-number arithmetic here is the private CPU reference loop.
// It intentionally does not emulate WGSL f32 rounding or install GPU globals.
function createCpuScorer(d,spec,width,height,disposableWorker){
 let prefix,info,lastYield=performance.now();
 // A dedicated Worker is terminated by its host on cancellation. Coalesce
 // task yields there to avoid browser nested-timer clamping at every batch;
 // scoring still checks its elapsed budget at every existing checkpoint.
 async function yieldControl(){
  if(disposableWorker&&performance.now()-lastYield<20)return;
  await new Promise(resolve=>setTimeout(resolve,0));lastYield=performance.now();
 }
 const edge=(a,max)=>Math.min(max,Math.max(0,Math.ceil(a-.5))),stride=width+1;
 return {cap:2048,beginPass(p,i){prefix=p;info=i;},destroy(){},yieldControl,async score(start,count,interrupted){
  const scores=new Uint32Array(count);let cellsSinceYield=0;
  for(let j=0;j<count;j++){
   const reason=interrupted();if(reason)return {scores,evaluated:j,reason};
   const idx=start+j,pc=spec.posW*spec.posH,pg=spec.sizes.length*pc,gi=Math.floor(idx/pg),rem=idx%pg,si=Math.floor(rem/pc),pi=rem%pc;
   const dx=(pi%spec.posW-spec.xSteps)*spec.stepMilli/1000,dy=(Math.floor(pi/spec.posW)-spec.ySteps)*spec.stepMilli/1000,scale=spec.sizes[si]/750;
   const tx=info.bounds.minX-d.metas[gi*6+2]*scale+dx,ty=info.bounds.minY-d.metas[gi*6+3]*scale+dy;
   let cw=0,inter=0;
   for(let k=0;k<d.metas[gi*6+1];k++){
    const v=d.coords[d.metas[gi*6]+k],x=v&65535,y=v>>>16;
    const x0=edge(tx+x*scale,width),x1=edge(tx+(x+1)*scale,width),y0=edge(ty+y*scale,height),y1=edge(ty+(y+1)*scale,height);
    cw+=(x1-x0)*(y1-y0);inter+=prefix[y1*stride+x1]+prefix[y0*stride+x0]-prefix[y0*stride+x1]-prefix[y1*stride+x0];
    // Even one unusually dense glyph cannot monopolize the worker indefinitely.
    if(++cellsSinceYield>=32768){
     cellsSinceYield=0;await yieldControl();
     const stopped=interrupted();if(stopped)return {scores,evaluated:j,reason:stopped};
    }
   }
   scores[j]=info.white+cw-2*inter;
  }
  return {scores,evaluated:count};
 }};
}

async function createGpuScorer(d,spec,width,height,total){
 const {device,pipeline}=await getGPU(),buffers=[];
 const track=b=>(buffers.push(b),b),upload=t=>track(makeBuffer(device,t,GPUBufferUsage.STORAGE));
 try{
  const coords=upload(d.coords),metas=upload(d.metas),sizes=upload(spec.sizes);
  const cap=Math.min(total,65536,Math.floor(Number(device.limits.maxStorageBufferBindingSize)/4),Number(device.limits.maxComputeWorkgroupsPerDimension)*64);
  if(cap<1)throw Error('WebGPU batch capacity unavailable');
  const prefix=track(device.createBuffer({size:(width+1)*(height+1)*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}));
  const output=track(device.createBuffer({size:cap*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC})),read=track(device.createBuffer({size:cap*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})),params=track(device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}));
  const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[prefix,coords,metas,sizes,output,params].map((buffer,binding)=>({binding,resource:{buffer}}))});
  let values;
  return {cap,destroy(){for(const b of buffers)b.destroy();},beginPass(p,info){
   device.queue.writeBuffer(prefix,0,p);
   values=new Uint32Array([width,height,width+1,d.glyphs.length,0,0,spec.sizes.length,spec.posW,spec.posH,info.white,info.bounds.minX,info.bounds.minY,spec.xSteps,spec.ySteps,1000,1,0,0,spec.stepMilli,0]);
  },async score(start,count){
   values[16]=start;values[17]=count;device.queue.writeBuffer(params,0,values);
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();encoder.copyBufferToBuffer(output,0,read,0,count*4);device.queue.submit([encoder.finish()]);
   await read.mapAsync(GPUMapMode.READ,0,count*4);
   try{return {scores:new Uint32Array(read.getMappedRange(0,count*4)).slice(),evaluated:count};}finally{read.unmap();}
  }};
 }catch(error){for(const b of buffers)b.destroy();throw error;}
}

export class GlyphAkinatorMatcher{
 constructor(dictionary,{backend='webgpu',disposableWorker=false}={}){
  if(!['webgpu','cpu-reference'].includes(backend))throw Error('Unknown Akinator scoring backend');
  if(typeof disposableWorker!=='boolean'||disposableWorker&&backend!=='cpu-reference')throw Error('Disposable-worker yielding requires the CPU backend');
  if(backend==='cpu-reference')validateCpuDictionary(dictionary);
  this.dictionary=dictionary;this.backend=backend;this.disposableWorker=disposableWorker;this.generation=0;this.route='glyph-akinator';
 }
 cancel(){this.generation++;this.hypothesisMatcher?.cancel();}
 destroy(){this.cancel();}
 async match(image,options={}){
  if(this.backend==='cpu-reference')validateCpuAkinatorRequest(image,options);
  if(options.sequenceMode==='greedy')return this.matchGreedy(image,options);
  const generation=++this.generation,started=performance.now(),budget=options.maxEvaluations??2000000,timeBudget=options.maxMilliseconds??1500;
  // Each line-font hypothesis still exhaustively scores every glyph in that font.
  // The unrestricted mixed-font route remains an explicit final hypothesis.
  // All paths share one time/evaluation budget; no map-name vocabulary is used.
  const thresholds=options.autoThreshold?[180,170,190]:[options.threshold??220];
  const fonts=this.dictionary.fontIds.map(fontId=>({fontId,dictionary:fontSubset(this.dictionary,fontId)}));
  fonts.push({fontId:null,dictionary:this.dictionary});
  const hypotheses=fonts.flatMap(font=>thresholds.map(threshold=>({...font,threshold}))),perfectThresholds=new Set();
  const evaluated=[],results=[];let used=0,stopped=null;
  for(const hypothesis of hypotheses){
   if(perfectThresholds.has(hypothesis.threshold))continue;
   if(options.signal?.aborted||generation!==this.generation){stopped='cancelled';break;}
   const remainingMilliseconds=timeBudget-(performance.now()-started),remainingEvaluations=budget-used;
   if(remainingMilliseconds<=0){stopped='time-budget';break;}
   if(remainingEvaluations<1){stopped='evaluation-budget';break;}
   const child=new GlyphAkinatorMatcher(hypothesis.dictionary,{backend:this.backend,disposableWorker:this.disposableWorker});this.hypothesisMatcher=child;
   const result=await child.matchGreedy(image,{...options,threshold:hypothesis.threshold,maxMilliseconds:remainingMilliseconds,maxEvaluations:remainingEvaluations,
    // Small kana sit below the line top. Permit their true baseline alignment.
    shiftY:Math.max(options.shiftY??1,3),shiftStep:options.shiftStep??1});
   used+=result.evaluated;
   if(result.reason==='time-budget'||result.reason==='evaluation-budget')stopped=result.reason;
   const fit=reconstructionFit(image,hypothesis.dictionary,result,hypothesis.threshold);
   const summary={threshold:hypothesis.threshold,fontId:hypothesis.fontId??'mixed',sequence:result.sequence,complete:result.complete,reason:result.reason,evaluated:result.evaluated,...fit};
   evaluated.push(summary);
   if(result.characters.length){
    for(const c of result.characters)for(const a of c.alternatives){a.glyphIndex=hypothesis.dictionary.glyphs[a.glyphIndex].sourceGlyphIndex??a.glyphIndex;}
    results.push({result,summary});
   }
   if(result.reason==='cancelled'){stopped='cancelled';break;}
   // Zero binary reconstruction error is a mathematical lower bound, not a
   // claim that font identity or the semantic text is unambiguous.
   if(result.complete&&fit.reconstructionDifference===0){perfectThresholds.add(hypothesis.threshold);if(perfectThresholds.size===thresholds.length){stopped='zero-error-lower-bound';break;}}
  }
  this.hypothesisMatcher=null;
  results.sort((a,b)=>Number(b.result.complete)-Number(a.result.complete)||a.summary.reconstructionDifferencePerWhitePixel-b.summary.reconstructionDifferencePerWhitePixel||a.result.characters.length-b.result.characters.length);
  const selected=results[0];
  const thresholdVotes=thresholds.map(threshold=>{const match=results.find(r=>r.summary.threshold===threshold);return match?{threshold,sequence:match.result.sequence,complete:match.result.complete,reconstructionDifference:match.summary.reconstructionDifference,reconstructionDifferencePerWhitePixel:match.summary.reconstructionDifferencePerWhitePixel}:{threshold,sequence:null,complete:false};});
  const thresholdAgreement=thresholdVotes.every(v=>v.complete&&v.sequence===selected?.result.sequence&&v.reconstructionDifference===0);
  const result=selected?.result??{route:'glyph-akinator',sequence:'',characters:[],candidates:[],fontIds:this.dictionary.fontIds,complete:false,residualWhite:null,confidenceCalibrated:false,unknownTextPossible:true,provisional:true,whitespaceUnresolved:true};
  return {...result,...this.backendIdentity(),fontIds:this.dictionary.fontIds,evaluated:used,elapsedMilliseconds:performance.now()-started,
   sequenceMode:'line-font-hypotheses',greedySequence:false,greedyWithinHypothesis:true,hypotheses:evaluated,
   hypothesisSearchComplete:evaluated.length===hypotheses.length&&evaluated.every(h=>h.complete),searchStopped:stopped,
   selectedFontId:selected?.summary.fontId??null,selectedThreshold:selected?.summary.threshold??null,autoThreshold:Boolean(options.autoThreshold),thresholdVotes,thresholdAgreement,thresholdSearchComplete:thresholds.every(t=>perfectThresholds.has(t)||(evaluated.filter(h=>h.threshold===t).length===fonts.length&&evaluated.filter(h=>h.threshold===t).every(h=>h.complete))),...(selected?.summary?{reconstructionDifference:selected.summary.reconstructionDifference,reconstructionDifferencePerWhitePixel:selected.summary.reconstructionDifferencePerWhitePixel}:{}),
   textResolved:Boolean(selected?.result.complete&&selected.summary.reconstructionDifference===0&&thresholdAgreement&&stopped!=='cancelled'),
   fontIdentityResolved:false,reason:stopped==='cancelled'?'cancelled':result.reason??stopped??evaluated.at(-1)?.reason??'no-candidates'};
 }
 backendIdentity(){return this.backend==='cpu-reference'?{backend:'cpu-reference',scorePrecision:'javascript-number',gpuValidated:false,fontIdentityResolved:false}:{};}
 async matchGreedy(image,options={}){
  if(this.backend==='cpu-reference')validateCpuAkinatorRequest(image,options);
  const {threshold=220,charCount=16,topN=8,maxEvaluations=2000000,maxMilliseconds=1500,signal}=options;
  if(!Number.isInteger(charCount)||charCount<1||charCount>256||!Number.isInteger(topN)||topN<1||topN>200||!Number.isFinite(threshold)||threshold<0||threshold>255||!Number.isSafeInteger(maxEvaluations)||maxEvaluations<1||!Number.isFinite(maxMilliseconds)||maxMilliseconds<=0)throw Error('Invalid Akinator budget or options');
  const width=image.width,height=image.height;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1048576||image.data.length!==width*height*4)throw Error('Akinator requires a bounded single-line text ROI');
  const d=this.dictionary,spec=akinatorSearchSpec(options),total=d.glyphs.length*spec.sizes.length*spec.posW*spec.posH;
  const result={...this.backendIdentity(),route:'glyph-akinator',sequence:'',characters:[],candidates:[],fontIds:d.fontIds,evaluated:0,evaluatedPerPass:total,confidenceCalibrated:false,unknownTextPossible:true,provisional:true,greedySequence:true,whitespaceUnresolved:true,complete:false,reason:null};
  if(!total){result.reason='glyphs-absent';return result;}
  if(total>0xffffffff||total>maxEvaluations){result.reason='evaluation-budget';return result;}
  const generation=++this.generation,started=performance.now(),interrupted=()=>signal?.aborted||generation!==this.generation?'cancelled':performance.now()-started>=maxMilliseconds?'time-budget':null;
  const residual=new Uint8Array(width*height);
  for(let i=0;i<residual.length;i++){const k=i*4;residual[i]=Number(image.data[k]>threshold||image.data[k+1]>threshold||image.data[k+2]>threshold);}
  if(!maskInfo(residual,width,height).white){result.reason='white-pixels-absent';return result;}
  if(interrupted()){result.reason=interrupted();return result;}
  const scorer=await (this.backend==='cpu-reference'?createCpuScorer(d,spec,width,height,this.disposableWorker):createGpuScorer(d,spec,width,height,total));
  try{
   for(let passNo=0;passNo<charCount;passNo++){
    const info=maskInfo(residual,width,height);
    if(!info.white){result.complete=true;result.reason='residual-empty';break;}
    if(interrupted()){result.reason=interrupted();break;}
    if(result.evaluated+total>maxEvaluations){result.reason='evaluation-budget';break;}
    scorer.beginPass(buildPrefix(residual,width,height),info);
    const best=new Map();
    let aborted=false;
    for(let start=0;start<total;start+=scorer.cap){
     if(interrupted()){result.reason=interrupted();aborted=true;break;}
     const count=Math.min(scorer.cap,total-start),batch=await scorer.score(start,count,interrupted);
     result.evaluated+=batch.evaluated;
     if(batch.reason){result.reason=batch.reason;aborted=true;break;}
     for(let j=0;j<count;j++){
      const c={...decodeAkinatorIndex(start+j,spec),difference:batch.scores[j]},old=best.get(c.glyphIndex);if(!old||order(c,old)<0)best.set(c.glyphIndex,c);
     }
     if(this.backend==='cpu-reference')await scorer.yieldControl();else await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(aborted||interrupted()){result.reason=result.reason||interrupted();break;}
    const alternatives=[...best.values()].sort(order).slice(0,topN).map(c=>{
     const g=d.glyphs[c.glyphIndex];return {...g,...c,topX:info.bounds.minX-g.minX*c.scale,topY:info.bounds.minY-g.minY*c.scale,residualWhiteBefore:info.white,differencePerWhitePixel:c.difference/info.white};
    }).map(c=>({...c,topX:c.topX+c.dx,topY:c.topY+c.dy}));
    const winner=alternatives[0];if(!winner){result.reason='no-candidates';break;}
    const removed=eraseAkinatorCandidate(residual,d,winner,width,height);
    result.characters.push({index:passNo,alternatives,winner,removed,ambiguous:alternatives.length>1&&alternatives[1].difference===winner.difference});
    result.sequence+=winner.char||'';result.candidates=alternatives;
    if(!removed){result.reason='no-progress';break;}
   }
   result.residualWhite=maskInfo(residual,width,height).white;
   if(result.residualWhite===0){result.complete=true;result.reason='residual-empty';}else result.reason ||= 'character-limit';
   result.elapsedMilliseconds=performance.now()-started;return result;
  }finally{scorer.destroy();}
 }
}

function fontSubset(dictionary,fontId){
 const glyphs=[],metas=[];
 for(const g of dictionary.glyphs)if(g.fontId===fontId){metas.push(...dictionary.metas.subarray(g.glyphIndex*6,g.glyphIndex*6+6));glyphs.push({...g,sourceGlyphIndex:g.glyphIndex,glyphIndex:glyphs.length});}
 return {...dictionary,glyphs,metas:Uint32Array.from(metas),fontIds:[fontId]};
}
export function reconstructionFit(image,dictionary,result,threshold=220){
 const mask=new Uint8Array(image.width*image.height);
 for(const character of result.characters){const raster=rasterizeAkinatorCandidate(dictionary,character.winner,image.width,image.height);for(let i=0;i<mask.length;i++)mask[i]|=raster[i];}
 let white=0,difference=0;
 for(let i=0;i<mask.length;i++){const k=i*4,pixel=Number(image.data[k]>threshold||image.data[k+1]>threshold||image.data[k+2]>threshold);white+=pixel;difference+=Number(mask[i]!==pixel);}
 return {reconstructionDifference:difference,reconstructionWhite:white,reconstructionDifferencePerWhitePixel:white?difference/white:null};
}
