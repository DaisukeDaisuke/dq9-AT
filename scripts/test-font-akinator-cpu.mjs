import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Optional private inputs stay read-only and are never copied into the stage.
// node scripts/test-font-akinator-cpu.mjs /path/to/private/akinator-real
const privateDirectory=process.argv[2];
const globals=['navigator','GPUBufferUsage','GPUMapMode'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
const {buildGlyphAkinatorDictionary,GlyphAkinatorMatcher,validateCpuGlyphInput,snapshotCpuGlyphInput,validateCpuAkinatorRequest,akinatorSearchSpec,decodeAkinatorIndex,reconstructionFit}=await import('../web/font-akinator.mjs');
const {createCpuAkinatorWorkerHandler}=await import('../web/font-akinator-cpu-worker.mjs');
const {buildPrefix,maskInfo}=await import('../web/vendor/font-match-reference.mjs');
const cpu={backend:'cpu-reference'};
let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const bad=f=>{assert.throws(f);checks++;};
const one={'1x1':[{char:'A',rows:['#']}]};
const dictionary=buildGlyphAkinatorDictionary(one,cpu);
const matcher=()=>new GlyphAkinatorMatcher(dictionary,cpu);
const rgba=(width,height,white)=>{
 const data=new Uint8ClampedArray(width*height*4);
 for(const index of white){data[index*4]=255;data[index*4+1]=255;data[index*4+2]=255;data[index*4+3]=255;}
 return {width,height,data};
};
const image=rgba(3,1,[0,2]);
const options={sequenceMode:'greedy',scales:[1],shiftX:0,shiftY:0,shiftStep:1,maxMilliseconds:10000};

eq(new GlyphAkinatorMatcher(dictionary).backend,'webgpu');
eq(new GlyphAkinatorMatcher(dictionary).disposableWorker,false);
bad(()=>new GlyphAkinatorMatcher(dictionary,{disposableWorker:true}));
bad(()=>new GlyphAkinatorMatcher(dictionary,{backend:'cpu-reference',disposableWorker:'true'}));
eq(validateCpuGlyphInput(one),{glyphs:1,glyphCells:1});
bad(()=>validateCpuGlyphInput({'1x1':new Array(4097).fill(one['1x1'][0])}));
bad(()=>validateCpuGlyphInput({'1025x1024':[{rows:[]}]}));
bad(()=>validateCpuGlyphInput({'2x1':[{rows:['#']}]}));
bad(()=>validateCpuGlyphInput({'2x1x1':[{rows:['##']}]}));
bad(()=>validateCpuGlyphInput({'1x1':[{rows:new Array(1)}]}));
bad(()=>validateCpuGlyphInput({'1x1':new Array(1)}));
bad(()=>validateCpuGlyphInput({'1x1':[{rows:['x']}]}));
bad(()=>validateCpuGlyphInput({'1x1':[{rows:['#'],source:'s'.repeat(257)}]}));
bad(()=>validateCpuGlyphInput({'1x1':[{rows:['#'],aliases:new Array(1)}]}));
const projectionInput={'1x1':[{char:'A',rows:['#'],get unrelated(){throw Error('Unbounded metadata must not be read');}}]};
const projection=snapshotCpuGlyphInput(projectionInput);
eq(Object.hasOwn(projection['1x1'][0],'unrelated'),false);
projectionInput['1x1'][0].rows[0]='.';
eq(projection['1x1'][0].rows,['#']);
bad(()=>new GlyphAkinatorMatcher({...dictionary,coords:new Uint32Array(1048577)},cpu));
bad(()=>new GlyphAkinatorMatcher({...dictionary,fontIds:['1x1','1x1']},cpu));
bad(()=>new GlyphAkinatorMatcher(dictionary,{backend:'gpu-polyfill'}));
for(const patch of [{charCount:33},{topN:9},{maxEvaluations:2000001},{maxEvaluations:Infinity},{maxMilliseconds:10001},{maxMilliseconds:0},{maxMilliseconds:NaN},{scales:new Array(7).fill(1)},{scales:new Array(1)},{scales:[Infinity]},{shiftStep:0},{shiftX:Infinity},{threshold:256}])bad(()=>validateCpuAkinatorRequest(image,{...options,...patch}));
for(const im of [{width:257,height:1,data:new Uint8Array(1028)},{width:1,height:193,data:new Uint8Array(772)},{width:1,height:1,data:[255,255,255,255]},{width:1,height:1,data:new Uint8Array(3)}])bad(()=>validateCpuAkinatorRequest(im,options));

const partial=await matcher().match(image,{...options,maxEvaluations:1});
eq([partial.sequence,partial.evaluated,partial.complete,partial.reason],['A',1,false,'evaluation-budget']);
eq([partial.route,partial.backend,partial.scorePrecision,partial.unknownTextPossible,partial.fontIdentityResolved,partial.gpuValidated,partial.provisional],['glyph-akinator','cpu-reference','javascript-number',true,false,false,true]);
const full=await matcher().match(image,{...options,maxEvaluations:2});
eq([full.sequence,full.evaluated,full.complete],['AA',2,true]);
const shared=await matcher().match(image,{...options,sequenceMode:'line-font-hypotheses',maxEvaluations:7});
eq([shared.evaluated,shared.sequence,shared.textResolved,shared.searchStopped],[7,'A',false,'evaluation-budget']);
// Only scheduling changes in the disposable Worker, including child hypotheses.
const workerMatcher=new GlyphAkinatorMatcher(dictionary,{...cpu,disposableWorker:true});
const workerShared=await workerMatcher.match(image,{...options,sequenceMode:'line-font-hypotheses',maxEvaluations:7});
const stableResult=({elapsedMilliseconds,...result})=>result;
eq(stableResult(workerShared),stableResult(shared));
eq(workerMatcher.hypothesisMatcher,null);
const workerExpired=await new GlyphAkinatorMatcher(dictionary,{...cpu,disposableWorker:true}).match(image,{...options,maxMilliseconds:Number.MIN_VALUE});
eq([workerExpired.reason,workerExpired.evaluated,workerExpired.characters.length],['time-budget',0,0]);
const absent=await matcher().match(rgba(3,1,[]),options);
eq([absent.sequence,absent.reason,absent.unknownTextPossible],['','white-pixels-absent',true]);
const preCancelled=await matcher().match(image,{...options,signal:AbortSignal.abort()});
eq([preCancelled.reason,preCancelled.evaluated,preCancelled.characters.length],['cancelled',0,0]);

// A cancelled pass may have scored candidates, but must never select its winner.
const many=buildGlyphAkinatorDictionary({'1x1':new Array(4096).fill(one['1x1'][0])},cpu);
const cancellationMatcher=new GlyphAkinatorMatcher(many,cpu);
const cancelling=cancellationMatcher.match(image,{...options,scales:[.95,1,1.05],shiftX:1,shiftY:1,shiftStep:.5});
setTimeout(()=>cancellationMatcher.cancel(),0);
const cancelled=await cancelling;
eq(cancelled.reason,'cancelled');
eq(cancelled.characters.length,0);
assert.ok(cancelled.evaluated>0&&cancelled.evaluated<cancelled.evaluatedPerPass);checks++;
const dense=buildGlyphAkinatorDictionary({'1024x1024':[{char:'D',rows:new Array(1024).fill('#'.repeat(1024))}]},cpu);
const expired=await new GlyphAkinatorMatcher(dense,cpu).match(image,{...options,maxMilliseconds:.1});
eq([expired.reason,expired.characters.length,expired.complete],['time-budget',0,false]);

// An independent scalar implementation of the existing private reference.
// With private inputs supplied, execute only its pure score function, never the
// emulator module that installs fake GPU globals.
function referenceScore(buffers){
 const [prefix,coords,metas,sizes,out,p]=buffers.map(x=>new Uint32Array(x.array));
 for(let j=0;j<p[17];j++){
  const idx=p[16]+j,pc=p[7]*p[8],pg=p[6]*pc,gi=Math.floor(idx/pg),rem=idx%pg,si=Math.floor(rem/pc),pi=rem%pc,dx=(pi%p[7]-p[12])*p[18]/1000,dy=(Math.floor(pi/p[7])-p[13])*p[18]/1000,scale=sizes[si]/750,tx=p[10]-metas[gi*6+2]*scale+dx,ty=p[11]-metas[gi*6+3]*scale+dy;
  let cw=0,inter=0;
  for(let k=0;k<metas[gi*6+1];k++){
   const v=coords[metas[gi*6]+k],x=v&65535,y=v>>>16,edge=(a,max)=>Math.min(max,Math.max(0,Math.ceil(a-.5))),x0=edge(tx+x*scale,p[0]),x1=edge(tx+(x+1)*scale,p[0]),y0=edge(ty+y*scale,p[1]),y1=edge(ty+(y+1)*scale,p[1]);
   cw+=(x1-x0)*(y1-y0);inter+=prefix[y1*p[2]+x1]+prefix[y0*p[2]+x0]-prefix[y0*p[2]+x1]-prefix[y1*p[2]+x0];
  }
  out[j]=p[9]+cw-2*inter;
 }
}
let scoreReference=referenceScore;
if(privateDirectory){
 const source=fs.readFileSync(path.join(privateDirectory,'emulator.mjs'),'utf8');
 const scoreLine=source.split('\n').find(line=>line.startsWith('function score(b)'));
 assert.ok(scoreLine);scoreReference=Function(`return (${scoreLine});`)();
}
const tiny=buildGlyphAkinatorDictionary({'3x3':[{char:'L',rows:['#..','#..','###']},{char:'X',rows:['#.#','.#.','#.#']},{char:'I',rows:['.#.','.#.','.#.']}]},cpu);
const parityOptions={...options,scales:[.5,.95,1,1.05,1.5,2],shiftX:1,shiftY:1,shiftStep:.5,charCount:1};
const spec=akinatorSearchSpec(parityOptions);
const total=tiny.glyphs.length*spec.sizes.length*spec.posW*spec.posH;
const sort=(a,b)=>a.difference-b.difference||(Math.abs(a.dx)+Math.abs(a.dy))-(Math.abs(b.dx)+Math.abs(b.dy))||Math.abs(a.scale-1)-Math.abs(b.scale-1)||a.index-b.index;
for(let fixture=0;fixture<8;fixture++){
 const sample=rgba(7,6,Array.from({length:42},(_,i)=>i).filter(i=>(i*17+fixture*23)%11<3));
 const mask=Uint8Array.from({length:42},(_,i)=>Number(sample.data[i*4]>220)),info=maskInfo(mask,7,6),out=new Uint32Array(total);
 const params=new Uint32Array([7,6,8,tiny.glyphs.length,0,0,spec.sizes.length,spec.posW,spec.posH,info.white,info.bounds.minX,info.bounds.minY,spec.xSteps,spec.ySteps,1000,1,0,total,spec.stepMilli,0]);
 scoreReference([buildPrefix(mask,7,6),tiny.coords,tiny.metas,spec.sizes,out,params].map(array=>({array:array.buffer})));
 const best=new Map();
 for(let index=0;index<total;index++){
  const candidate={...decodeAkinatorIndex(index,spec),difference:out[index]},old=best.get(candidate.glyphIndex);
  if(!old||sort(candidate,old)<0)best.set(candidate.glyphIndex,candidate);
 }
 const expected=[...best.values()].sort(sort).map(c=>[c.glyphIndex,c.index,c.difference]);
 const result=await new GlyphAkinatorMatcher(tiny,cpu).match(sample,parityOptions);
 eq(result.characters[0].alternatives.map(c=>[c.glyphIndex,c.index,c.difference]),expected);
}

const messages=[],handle=createCpuAkinatorWorkerHandler(message=>messages.push(message));
await handle({type:'match',id:'uninitialized',romEpoch:1,image,options});
eq(messages.at(-1).type,'error');
await handle({type:'init',id:'init',romEpoch:1,glyphsBySize:one});
eq(messages.at(-1),{type:'ready',id:'init',romEpoch:1});
await handle({type:'match',id:'stale',romEpoch:2,image,options});
eq([messages.at(-1).type,messages.at(-1).romEpoch],['error',2]);
await handle({type:'match',id:'bounded',romEpoch:1,image,options:{...options,maxMilliseconds:10001}});
eq(messages.at(-1).type,'error');
const stamp={romEpoch:1,sourceEpoch:2,frameEpoch:3,roiEpoch:4};
await handle({type:'match',id:'frame',romEpoch:1,stamp,image,options});
eq([messages.at(-1).type,messages.at(-1).id,messages.at(-1).romEpoch,messages.at(-1).stamp],['result','frame',1,stamp]);
eq(messages.at(-1).result.backend,'cpu-reference');

const privateResults=[];
if(privateDirectory){
 const glyphs=JSON.parse(fs.readFileSync(path.join(privateDirectory,'glyphs-private.json'))),inputBounds=validateCpuGlyphInput(glyphs),romDictionary=buildGlyphAkinatorDictionary(glyphs,cpu);
 eq(inputBounds,{glyphs:2588,glyphCells:312852});eq(romDictionary.coords.length,103331);
 for(const [name,expected] of [['100','ウォルロ地方'],['120','とうげのみち'],['252','ルディアノ城Ｂ１Ｆ']]){
  const prefix=path.join(privateDirectory,`${name}-auto`),sample={...JSON.parse(fs.readFileSync(prefix+'.json')),data:fs.readFileSync(prefix+'.rgba')};
  const result=await new GlyphAkinatorMatcher(romDictionary,cpu).match(sample,{threshold:180,maxMilliseconds:10000});
  eq(result.sequence,expected);eq(result.reconstructionDifference,0);eq(reconstructionFit(sample,romDictionary,result,180).reconstructionDifference,0);eq(result.unknownTextPossible,true);eq(result.fontIdentityResolved,false);
  privateResults.push({name,sequence:result.sequence,evaluated:result.evaluated,elapsedMilliseconds:Math.round(result.elapsedMilliseconds)});
 }
 const sanmarouDirectory=path.join(privateDirectory,'../map-disambiguation/sanmarou');
 if(fs.existsSync(path.join(sanmarouDirectory,'local-095-native.rgba'))){
  const {detectMapNameROI}=await import('../web/map-name-roi.mjs');
  const native={width:256,height:192,data:fs.readFileSync(path.join(sanmarouDirectory,'local-095-native.rgba'))},roi=detectMapNameROI(native);
  eq(roi.resolved,true);
  const {x,y,w,h}=roi.pixels,data=new Uint8Array(w*h*4);
  for(let row=0;row<h;row++)data.set(native.data.subarray(((y+row)*256+x)*4,((y+row)*256+x+w)*4),row*w*4);
  const result=await new GlyphAkinatorMatcher(romDictionary,cpu).match({width:w,height:h,data},{autoThreshold:true,maxMilliseconds:10000,maxEvaluations:2000000});
  const expected=JSON.parse(fs.readFileSync(path.join(sanmarouDirectory,'pipeline-095-auto-results.json')))[0].ocr;
  eq(result.sequence,expected.sequence);eq(result.thresholdVotes,expected.thresholdVotes);eq(result.evaluated,expected.evaluated);
  eq(result.textResolved,false);eq(result.unknownTextPossible,true);eq(result.fontIdentityResolved,false);
  privateResults.push({name:'sanmarou-095',sequence:result.sequence,evaluated:result.evaluated,textResolved:result.textResolved,elapsedMilliseconds:Math.round(result.elapsedMilliseconds)});
 }
}
for(const [key,descriptor] of globals)eq(Object.getOwnPropertyDescriptor(globalThis,key),descriptor);
console.log(JSON.stringify({passed:true,checks,referenceLoop:privateDirectory?'actual private scorer function':'copied CPU reference',privateResults,gpuValidated:false,browserWorkerValidated:false},null,2));
