import {readCachedInferenceAsset} from './monster-inference-assets.mjs';
import {validateRGBA} from './monster-roi-descriptor.mjs';
export const DINO_SPEC=Object.freeze({modelSHA256:'3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917',runtime:'1.23.2',provider:'wasm',size:224,components:384,maxTemplates:64,maxMs:90000,preprocessor:'alpha-tight-template/full-ROI-gray128-bicubic224-v1'});
const abort=s=>{if(s?.aborted)throw new DOMException('AI特徴比較を中止しました','AbortError');};
const need=(v,m)=>{if(!v)throw Error(m);};
const roundEven=n=>{const a=Math.floor(n),f=n-a;return f===.5?(a%2?a+1:a):Math.round(n);};
function cubic(x){x=Math.abs(x);return x<1?((1.5*x-2.5)*x)*x+1:x<2?((-.5*x+2.5)*x-4)*x+2:0;}
function coefficients(src,dst){const scale=src/dst,filter=Math.max(1,scale),support=2*filter;return Array.from({length:dst},(_,i)=>{const center=(i+.5)*scale,lo=Math.max(0,Math.trunc(center-support+.5)),hi=Math.min(src,Math.trunc(center+support+.5));let v=Array.from({length:hi-lo},(_,j)=>cubic((lo+j-center+.5)/filter)),sum=v.reduce((a,b)=>a+b,0);v=v.map(x=>{const f=x/sum*4194304;return Math.trunc(f+(f<0?-.5:.5));});return{lo,v};});}
function resizeRGB(data,w,h,ow,oh){
 let temp=data,tw=w;
 if(w!==ow){const c=coefficients(w,ow);temp=new Uint8Array(ow*h*3);for(let y=0;y<h;y++)for(let x=0;x<ow;x++)for(let k=0;k<3;k++){let sum=2097152;for(let j=0;j<c[x].v.length;j++)sum+=data[(y*w+c[x].lo+j)*3+k]*c[x].v[j];temp[(y*ow+x)*3+k]=Math.max(0,Math.min(255,Math.floor(sum/4194304)));}tw=ow;}
 if(h===oh)return temp;
 const out=new Uint8Array(ow*oh*3),c=coefficients(h,oh);for(let y=0;y<oh;y++)for(let x=0;x<ow;x++)for(let k=0;k<3;k++){let sum=2097152;for(let j=0;j<c[y].v.length;j++)sum+=temp[((c[y].lo+j)*tw+x)*3+k]*c[y].v[j];out[(y*ow+x)*3+k]=Math.max(0,Math.min(255,Math.floor(sum/4194304)));}return out;
}
export function dinoInput(image,{template=false}={}){
 validateRGBA(image);need(image.width<=1024&&image.height<=1024,'AI比較ROIは各辺1024px以下です');let x0=0,y0=0,x1=image.width,y1=image.height;
 if(template){x0=image.width;y0=image.height;x1=0;y1=0;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.rgba[(y*image.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}need(x1>x0&&y1>y0,'空のROMテンプレートです');}
 const w=x1-x0,h=y1-y0,rgb=new Uint8Array(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=((y+y0)*image.width+x+x0)*4,a=image.rgba[p+3];for(let k=0;k<3;k++)rgb[(y*w+x)*3+k]=Math.round((image.rgba[p+k]*a+128*(255-a))/255);}
 const size=224,scale=size/Math.max(w,h),ow=Math.max(1,roundEven(w*scale)),oh=Math.max(1,roundEven(h*scale)),resized=resizeRGB(rgb,w,h,ow,oh),ox=Math.floor((size-ow)/2),oy=Math.floor((size-oh)/2),square=new Uint8Array(size*size*3).fill(128);
 for(let y=0;y<oh;y++)square.set(resized.subarray(y*ow*3,(y+1)*ow*3),((y+oy)*size+ox)*3);
 const means=[.485,.456,.406],stds=[.229,.224,.225],tensor=new Float32Array(3*size*size);for(let k=0;k<3;k++)for(let i=0;i<size*size;i++)tensor[k*size*size+i]=Math.fround((Math.fround(Math.fround(square[i*3+k]/255)-Math.fround(means[k])))/Math.fround(stds[k]));return tensor;
}
export function cosineSimilarity(a,b){need(a.length===384&&b.length===384,'AI特徴量の長さが不正です');let n=0;for(let i=0;i<384;i++){need(Number.isFinite(a[i])&&Number.isFinite(b[i]),'AI特徴量が不正です');n+=a[i]*b[i];}return Math.max(-1,Math.min(1,n));}
async function cachedRuntime(signal){
 const urls=[];try{const entry=await readCachedInferenceAsset('runtime-entry',{signal}),mjs=await readCachedInferenceAsset('runtime-mjs',{signal}),wasmBinary=await readCachedInferenceAsset('runtime-wasm',{signal});abort(signal);
 const entryURL=URL.createObjectURL(new Blob([entry],{type:'text/javascript'}));urls.push(entryURL);const mjsURL=URL.createObjectURL(new Blob([mjs],{type:'text/javascript'}));urls.push(mjsURL);const wasmURL=URL.createObjectURL(new Blob([wasmBinary],{type:'application/wasm'}));urls.push(wasmURL);const ort=await import(entryURL);abort(signal);return{ort,mjsURL,wasmURL,dispose(){for(const u of urls)URL.revokeObjectURL(u);}};
 }catch(e){for(const u of urls)URL.revokeObjectURL(u);throw e;}
}
export async function createDinoFeatureBackend({signal,onProgress=()=>{},loadRuntime=cachedRuntime,readModel=()=>readCachedInferenceAsset('model',{signal})}={}){
 abort(signal);onProgress({phase:'init',message:'AI推論ランタイムを読込中'});const runtime=await loadRuntime(signal);let session;
 try{abort(signal);const {ort}=runtime;need(ort.env.versions.web==='1.23.2','AIランタイムの版が一致しません');ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths={mjs:runtime.mjsURL,...(runtime.wasmURL?{wasm:runtime.wasmURL}:{})};ort.env.wasm.wasmBinary=runtime.wasmURL?undefined:runtime.wasmBinary;
 const model=await readModel();abort(signal);session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],freeDimensionOverrides:{batch_size:1,num_channels:3,height:224,width:224}});ort.env.wasm.wasmBinary=undefined;runtime.wasmBinary=null;abort(signal);
 const cache=new Map();let disposed=false;return{spec:DINO_SPEC,cache,
 async encode(image,{template=false,cacheKey='',signal:innerSignal}={}){abort(innerSignal);need(!disposed,'AI特徴比較は終了しています');let key;
 if(template){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',image.rgba));key=cacheKey+':'+image.width+'x'+image.height+':'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');abort(innerSignal);if(cache.has(key))return cache.get(key);}
 const input=new ort.Tensor('float32',dinoInput(image,{template}),[1,3,224,224]);let output;
 try{output=await session.run({pixel_values:input});abort(innerSignal);const t=output.last_hidden_state;need(t&&t.dims.length===3&&t.dims[0]===1&&t.dims[1]===257&&t.dims[2]===384,'AI出力の形が不正です');const v=new Float32Array(384);let norm=0;for(let i=0;i<384;i++){need(Number.isFinite(t.data[i]),'AI出力が有限値ではありません');v[i]=t.data[i];norm+=v[i]*v[i];}need(norm>0,'AI特徴量が空です');norm=Math.sqrt(norm);for(let i=0;i<384;i++)v[i]/=norm;if(key){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,v);}return v;
 }finally{input.dispose?.();if(output)for(const t of Object.values(output))t.dispose?.();}},
 async dispose(){if(disposed)return;disposed=true;cache.clear();try{await session.release();}finally{runtime.dispose?.();}}
 };
 }catch(e){try{await session?.release();}finally{if(runtime.ort?.env?.wasm)runtime.ort.env.wasm.wasmBinary=undefined;runtime.wasmBinary=null;runtime.dispose?.();}throw e;}
}
