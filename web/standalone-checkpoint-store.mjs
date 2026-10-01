// Private, append-only detector checkpoints. No network, training, or cache eviction.
export const CHECKPOINT_VERSION = 'dq9-private-detector-checkpoint-v1';
export const CHECKPOINT_DB_NAME = 'dq9-private-detector-checkpoints-v1';
export const CHECKPOINT_LIMITS = Object.freeze({maxPartBytes:250000000, maxHeaderBytes:1024*1024, maxBytes:750000000, maxRecords:4});
const MODEL_KIND = 'dq9-tiny-yolov2-coco-tfjs4-v1';
const MAGIC = new TextEncoder().encode('DQ9CKP01');
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
const now = () => performance.now();
const fail = (message, code='INVALID_CHECKPOINT') => {const e = new Error(message); e.code=code; throw e;};
const need = (test,message,code) => {if(!test) fail(message,code);};
const uint = (n,max=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n>=0 && n<=max;
const hash = s => typeof s==='string' && /^[a-f0-9]{64}$/.test(s);
const plain = x => x!==null && typeof x==='object' && [Object.prototype,null].includes(Object.getPrototypeOf(x));
function keys(x,expected,label) {need(plain(x)&&Object.keys(x).sort().join('|')===expected.split(' ').sort().join('|'),`Invalid ${label} fields`);}
function abort(signal) {if(signal?.aborted){const e=new Error('Checkpoint cancelled before commit'); e.name='AbortError'; e.code='ABORTED'; throw e;}}
function emit(fn,event) {try{fn?.(event);}catch{/* Observer errors cannot change a commit. */}}

// Strict canonical JSON: reject holes/non-finite values instead of JSON.stringify coercion.
export function checkpointCanonical(value) {
 const seen=new Set(); let nodes=0;
 function walk(v,depth) {
  need(++nodes<=100000 && depth<=24,'Checkpoint JSON is excessive');
  if(v===null || typeof v==='boolean' || typeof v==='string') return JSON.stringify(v);
  if(typeof v==='number'){need(Number.isFinite(v),'Non-finite checkpoint JSON'); return JSON.stringify(v);}
  need(typeof v==='object'&&!seen.has(v)&&Object.getOwnPropertySymbols(v).length===0,'Invalid or cyclic checkpoint JSON'); seen.add(v);
  let result;
  if(Array.isArray(v)) {
   need(Object.keys(v).length===v.length,'Sparse/extended checkpoint array');
   for(let i=0;i<v.length;i++) need(Object.hasOwn(v,i)&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,i),'value'),'Sparse/accessor checkpoint array');
   result='['+Array.from(v,x=>walk(x,depth+1)).join(',')+']';
  } else {
   need(plain(v)&&Object.getOwnPropertySymbols(v).length===0,'Checkpoint JSON must contain plain objects');
   const names=Object.keys(v).sort();
   for(const k of names) need(k!=='__proto__'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'),'Unsafe checkpoint JSON property');
   result='{'+names.map(k=>JSON.stringify(k)+':'+walk(v[k],depth+1)).join(',')+'}';
  }
  seen.delete(v); return result;
 }
 const result=walk(value,0); need(encoder.encode(result).byteLength<=CHECKPOINT_LIMITS.maxHeaderBytes,'Checkpoint metadata exceeds 1MiB'); return result;
}
export async function checkpointSHA256(value) {
 const bytes=value instanceof ArrayBuffer || ArrayBuffer.isView(value) ? value : encoder.encode(checkpointCanonical(value));
 need(globalThis.crypto?.subtle,'Secure-context Web Crypto is required');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
}
function cloneJSON(x) {return JSON.parse(checkpointCanonical(x));}

export function validateCheckpointBinding(b) {
 checkpointCanonical(b);
 keys(b,'dataset model lossSHA256 preprocessSHA256 runtime batchSize inputShape','binding');
 keys(b.dataset,'planSHA256 contentChainSHA256 classMapSHA256 rendererSHA256 totalSamples completedSamples trainingSamples','dataset binding');
 for(const k of ['planSHA256','contentChainSHA256','classMapSHA256','rendererSHA256']) need(hash(b.dataset[k]),`Invalid dataset ${k}`);
 const d=b.dataset; need(uint(d.totalSamples,10000000)&&d.totalSamples>0&&d.completedSamples===d.totalSamples&&uint(d.trainingSamples,d.totalSamples)&&d.trainingSamples>0,'A completed nonempty dataset with explicit training sample count is required');
 keys(b.model,'kind sourceSHA256 classes','model binding');
 need(b.model.kind===MODEL_KIND&&b.model.classes===256&&hash(b.model.sourceSHA256),'Invalid model binding');
 need(hash(b.lossSHA256)&&hash(b.preprocessSHA256),'Explicit loss and preprocess hashes are required');
 keys(b.runtime,`name version backend precision${Object.hasOwn(b.runtime??{},'profileSHA256')?' profileSHA256':''}`,'runtime binding');
 if(Object.hasOwn(b.runtime,'profileSHA256')) need(hash(b.runtime.profileSHA256),'Invalid runtime profile SHA256');
 need(b.runtime.name==='tensorflow.js'&&/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(b.runtime.version),'Invalid TensorFlow.js runtime binding');
 need(['cpu','wasm','webgl','webgpu'].includes(b.runtime.backend)&&['float32','float16'].includes(b.runtime.precision),'Explicit backend and precision are required');
 need(uint(b.batchSize,256)&&b.batchSize>0,'Invalid batch size');
 need(Array.isArray(b.inputShape)&&b.inputShape.length===3&&b.inputShape[2]===3&&b.inputShape.slice(0,2).every(n=>uint(n,4096)&&n>=32&&n%32===0),'Input shape must be [H,W,3], dimensions divisible by 32');
 return b;
}
function validateState(s,b,step) {
 keys(s,`epoch nextBatch globalStep shuffleSeed cursor${Object.hasOwn(s??{},'validation')?' validation':''}`,'training state');
 if(Object.hasOwn(s,'validation')) need(plain(s.validation),'Validation state must be a plain JSON object');
 for(const k of ['epoch','nextBatch','globalStep','cursor']) need(uint(s[k]),`Invalid training ${k}`);
 need(uint(s.shuffleSeed,0xffffffff),'Invalid shuffle seed');
 const n=Math.ceil(b.dataset.trainingSamples/b.batchSize);
 need(s.nextBatch<=n&&s.cursor===Math.min(s.nextBatch*b.batchSize,b.dataset.trainingSamples),'Shuffle cursor/next batch mismatch');
 need(s.globalStep===s.epoch*n+s.nextBatch&&s.globalStep===step,'Epoch/global step/manifest step mismatch');
}
function modelSpecs() {
 const result=[],channels=[3,16,32,64,128,256,512,1024,512];
 for(let i=0;i<8;i++) {
  result.push({name:`model/conv${i}/conv/filters`,shape:[3,3,channels[i],channels[i+1]],dtype:'float32'});
  for(const suffix of ['conv/bias','bn/sub','bn/truediv']) result.push({name:`model/conv${i}/${suffix}`,shape:[channels[i+1]],dtype:'float32'});
 }
 result.push({name:'model/conv8/filters',shape:[1,1,512,1305],dtype:'float32'},{name:'model/conv8/bias',shape:[1305],dtype:'float32'});
 return result;
}
const MODEL_SPECS=modelSpecs();
function validateManifest(m,b,s,byteLength) {
 need(plain(m)&&m.kind===b.model.kind&&m.classes===b.model.classes&&m.tfjsVersion===b.runtime.version,'Model/runtime manifest binding mismatch');
 need(uint(m.step,2147483647)&&plain(m.provenance),'Invalid manifest step/provenance');
 validateState(s,b,m.step);
 keys(m.optimizer,'className config','optimizer'); need(m.optimizer.className==='Adam','Resumable Adam optimizer is required');
 keys(m.optimizer.config,'learningRate beta1 beta2 epsilon','Adam config');
 const c=m.optimizer.config; need(Number.isFinite(c.learningRate)&&c.learningRate>0&&Number.isFinite(c.epsilon)&&c.epsilon>0&&[c.beta1,c.beta2].every(v=>Number.isFinite(v)&&v>=0&&v<1),'Invalid Adam configuration');
 const specs=m.weightSpecs, count=MODEL_SPECS.length;
 need(Array.isArray(specs)&&(specs.length===count*3+1||(m.step===0&&specs.length===count+1)),'Missing/extra model or Adam tensors');
 const names=new Set(); let bytes=0;
 for(let i=0;i<specs.length;i++) {
  const spec=specs[i]; keys(spec,'name shape dtype','tensor specification');
  need(typeof spec.name==='string'&&spec.name.length<=256&&!names.has(spec.name),'Invalid/duplicate tensor name'); names.add(spec.name);
  need(Array.isArray(spec.shape)&&spec.shape.length<=4&&spec.shape.every(n=>uint(n,65536)&&n>0),'Invalid tensor shape');
  if(i<count) need(checkpointCanonical(spec)===checkpointCanonical(MODEL_SPECS[i]),'Model topology/order mismatch');
  else if(i===count) need(spec.name==='optimizer/iter'&&spec.dtype==='int32'&&spec.shape.length===0,'Missing Adam iteration scalar');
  else {
   const slot=i-count-1, j=slot%count, suffix=slot<count?'m':'v';
   need(new RegExp(`^optimizer/[^/]+/${suffix}$`).test(spec.name)&&spec.dtype==='float32'&&checkpointCanonical(spec.shape)===checkpointCanonical(MODEL_SPECS[j].shape),'Adam slot shape/order mismatch');
   if(suffix==='v') need(spec.name.slice(0,-1)===specs[count+1+j].name.slice(0,-1),'Adam slot pair mismatch');
  }
  bytes+=spec.shape.reduce((n,x)=>n*x,1)*4; need(uint(bytes,CHECKPOINT_LIMITS.maxPartBytes),'Excessive tensor bytes');
 }
 need(byteLength===bytes,'Tensor specification/payload byte length mismatch');
}
async function validatePayload(data,manifest,signal,progress) {
 need(data instanceof ArrayBuffer && data.byteLength>0,'Checkpoint payload must be an ArrayBuffer');
 const floats=new Float32Array(data), ints=new Int32Array(data); let offset=0, yieldedAt=0;
 for(const spec of manifest.weightSpecs) {
  const length=spec.shape.reduce((n,x)=>n*x,1);
  if(spec.dtype==='int32') need(ints[offset]===manifest.step,'Adam iteration/manifest step mismatch');
  else for(let end=offset+length,i=offset;i<end;i++) {
   need(Number.isFinite(floats[i]),'Non-finite checkpoint tensor');
   if(i-yieldedAt>=4*1024*1024) {yieldedAt=i; emit(progress,{phase:'validate-payload',validatedBytes:i*4,totalBytes:data.byteLength,committed:false}); await new Promise(r=>setTimeout(r,0)); abort(signal);}
  }
  offset+=length;
 }
 abort(signal);
}
function validateSeal(seal) {
 keys(seal,'version manifest binding trainingState byteLength dataSHA256','checkpoint seal');
 need(seal.version===CHECKPOINT_VERSION&&uint(seal.byteLength,CHECKPOINT_LIMITS.maxPartBytes)&&seal.byteLength>0&&hash(seal.dataSHA256),'Invalid checkpoint seal');
 validateCheckpointBinding(seal.binding); validateManifest(seal.manifest,seal.binding,seal.trainingState,seal.byteLength);
}
async function verify(record,expectedBinding,signal,progress) {
 need(record&&hash(record.id)&&record.data instanceof ArrayBuffer,'Missing/incomplete checkpoint','CHECKPOINT_MISSING');
 checkpointCanonical(record.seal); validateSeal(record.seal);
 validateCheckpointBinding(expectedBinding);
 need(checkpointCanonical(record.seal.binding)===checkpointCanonical(expectedBinding),'Checkpoint expectedBinding mismatch','BINDING_MISMATCH');
 need(record.data.byteLength===record.seal.byteLength,'Checkpoint payload length mismatch');
 need(await checkpointSHA256(record.seal)===record.id,'Checkpoint manifest/binding/state digest mismatch'); abort(signal);
 need(await checkpointSHA256(record.data)===record.seal.dataSHA256,'Checkpoint payload digest mismatch'); abort(signal);
 await validatePayload(record.data,record.seal.manifest,signal,progress);
 return record;
}
function request(r) {return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function openDB(indexedDB) {
 return new Promise((resolve,reject)=>{
  need(indexedDB?.open,'IndexedDB is unavailable'); const r=indexedDB.open(CHECKPOINT_DB_NAME,1); let blocked=false;
  r.onupgradeneeded=()=>{r.result.createObjectStore('checkpoints',{keyPath:'id'});r.result.createObjectStore('history',{keyPath:'id'});};
  r.onerror=()=>reject(r.error);r.onblocked=()=>{blocked=true;reject(Object.assign(new Error('Checkpoint database is blocked by another tab'),{code:'DB_BLOCKED'}));};
  r.onsuccess=()=>{if(blocked)r.result.close();else resolve(r.result);};
 });
}
function readDB(db,store,id) {return request(db.transaction(store,'readonly').objectStore(store).get(id));}
function historyDB(db) {return request(db.transaction('history','readonly').objectStore('history').getAll());}
function exposed(record,timings,extra={}) {return {id:record.id,data:record.data,manifest:record.seal.manifest,binding:record.seal.binding,trainingState:record.seal.trainingState,seal:record.seal,createdAt:record.createdAt,timings,...extra};}

export async function openCheckpointStore({indexedDB=globalThis.indexedDB,storage=globalThis.navigator?.storage,maxBytes=CHECKPOINT_LIMITS.maxBytes,maxRecords=CHECKPOINT_LIMITS.maxRecords,onProgress}={}) {
 need(uint(maxBytes,8*1024**3)&&maxBytes>0&&uint(maxRecords,64)&&maxRecords>0,'Invalid checkpoint history budget');
 const db=await openDB(indexedDB);let closed=false,busy=false;
 db.onversionchange=()=>{closed=true;db.close();};
 const ready=()=>need(!closed,'Checkpoint store is closed','STORE_CLOSED');
 async function operation(task) {ready();need(!busy,'A checkpoint operation is already running','STORE_BUSY');busy=true;try{return await task();}finally{busy=false;}}
 function append(record,size,signal,timings,progress) {
  return new Promise((resolve,reject)=>{
   abort(signal);ready();let tx;try{tx=db.transaction(['checkpoints','history'],'readwrite',{durability:'strict'});}catch(e){reject(e);return;}
   const started=now();let error=null,duplicate=false; const stop=()=>{error=Object.assign(new Error('Checkpoint cancelled before commit'),{name:'AbortError',code:'ABORTED'});try{tx.abort();}catch{}};
   signal?.addEventListener('abort',stop,{once:true});
   tx.onabort=()=>{signal?.removeEventListener('abort',stop);timings.writeMs=now()-started;reject(error??tx.error??new Error('Checkpoint transaction aborted'));};
   tx.onerror=()=>{};
   tx.oncomplete=()=>{signal?.removeEventListener('abort',stop);timings.writeMs=now()-started;resolve({duplicate,durability:tx.durability??'unspecified'});};
   const checkpoints=tx.objectStore('checkpoints'),history=tx.objectStore('history'),r=history.getAll();
   r.onsuccess=()=>{try{
    abort(signal);const rows=r.result;need(rows.every(x=>hash(x.id)&&uint(x.byteLength)&&x.byteLength>0),'Invalid checkpoint history');
    duplicate=rows.some(x=>x.id===record.id);if(duplicate)return;
    need(rows.length<maxRecords&&rows.reduce((n,x)=>n+x.byteLength,0)+size<=maxBytes,'Checkpoint history budget exhausted; no existing data was removed','CHECKPOINT_BUDGET');
    checkpoints.add(record);history.add({id:record.id,byteLength:size,createdAt:record.createdAt,globalStep:record.seal.trainingState.globalStep});
    emit(progress,{phase:'write-pending',id:record.id,bytes:size,committed:false}); abort(signal);
   }catch(e){error=e;try{tx.abort();}catch{}}};
   emit(progress,{phase:'write-start',id:record.id,bytes:size,committed:false});if(signal?.aborted)stop();
  });
 }
 async function readVerified(id,expectedBinding,signal,progress,timings) {
  need(hash(id),'Invalid checkpoint ID');abort(signal);const start=now(),record=await readDB(db,'checkpoints',id);timings.readMs=now()-start;
  const verifiedStart=now();await verify(record,expectedBinding,signal,progress);timings.verifyMs=now()-verifiedStart;return record;
 }
 async function save(encoded,{binding,trainingState,signal,onProgress:progress=onProgress}={}) {
  const started=now(),timings={validationMs:0,copyMs:0,hashMs:0,quotaMs:0,writeMs:0,readMs:0,verifyMs:0,totalMs:0};let committed=false,id;
  try {
   abort(signal);emit(progress,{phase:'validate',committed:false});
   const validationStart=now(),manifest=cloneJSON(encoded?.manifest),bound=cloneJSON(binding),state=cloneJSON(trainingState);
   validateCheckpointBinding(bound);need(encoded.data instanceof ArrayBuffer,'Encoded data must be an ArrayBuffer');validateManifest(manifest,bound,state,encoded.data.byteLength);
   const copyStart=now();let data=encoded.data.slice(0);timings.copyMs=now()-copyStart;
   await validatePayload(data,manifest,signal,progress);timings.validationMs=now()-validationStart-timings.copyMs;
   const hashStart=now();emit(progress,{phase:'hash',committed:false});
   const seal={version:CHECKPOINT_VERSION,manifest,binding:bound,trainingState:state,byteLength:data.byteLength,dataSHA256:await checkpointSHA256(data)};
   id=await checkpointSHA256(seal);timings.hashMs=now()-hashStart;abort(signal);
   const size=16+encoder.encode(checkpointCanonical({id,seal})).byteLength+data.byteLength;
   need(size<=CHECKPOINT_LIMITS.maxPartBytes,'Checkpoint exceeds 250MB single-part cap');
   const quotaStart=now(),estimate=await storage?.estimate?.();timings.quotaMs=now()-quotaStart;abort(signal);
   // Browser quota is advisory; the actual atomic transaction remains authoritative.
   if(Number.isFinite(estimate?.quota)&&Number.isFinite(estimate?.usage)&&estimate.quota-estimate.usage<size) {
    const existing=await readDB(db,'history',id);need(existing,'Insufficient origin quota; no existing data was removed','CHECKPOINT_QUOTA');
   }
   const outcome=await append({id,seal,data,createdAt:Date.now()},size,signal,timings,progress);committed=true;data=null;
   emit(progress,{phase:'committed',id,committed:true});
   // Once committed, cancellation cannot erase it. Always finish readback verification.
   emit(progress,{phase:'readback',id,committed:true});const record=await readVerified(id,bound,undefined,progress,timings);
   timings.totalMs=now()-started;emit(progress,{phase:'verified',id,committed:true,timings:{...timings}});
   return exposed(record,timings,{...outcome,committed:true,cancelledAfterCommit:!!signal?.aborted});
  } catch(e) {
   e.committed=committed;e.checkpointId=id??null;timings.totalMs=now()-started;e.timings=timings;
   emit(progress,{phase:e.name==='AbortError'?'cancelled':'failed',id:id??null,committed,code:e.code??e.name});throw e;
  }
 }
 return {
  saveCheckpoint(encoded,options) {return operation(()=>save(encoded,options));},
  readCheckpoint(id,{expectedBinding,signal,onProgress:progress=onProgress}={}) {return operation(async()=>{const started=now(),timings={readMs:0,verifyMs:0,totalMs:0},expected=cloneJSON(expectedBinding);validateCheckpointBinding(expected);const record=await readVerified(id,expected,signal,progress,timings);timings.totalMs=now()-started;return exposed(record,timings,{committed:true});});},
  exportCheckpoint(record,{expectedBinding=record?.binding,signal,onProgress:progress=onProgress}={}) {return operation(async()=>{
   const started=now();abort(signal);need(record?.data instanceof ArrayBuffer,'A verified checkpoint record is required');
   const snapshot={id:record.id,seal:cloneJSON(record.seal),data:record.data.slice(0)},expected=cloneJSON(expectedBinding);await verify(snapshot,expected,signal,progress);
   const header=encoder.encode(checkpointCanonical({id:snapshot.id,seal:snapshot.seal})),size=16+header.byteLength+snapshot.data.byteLength;
   need(size<=CHECKPOINT_LIMITS.maxPartBytes,'Checkpoint exceeds 250MB single-part cap');
   const prefix=new Uint8Array(16);prefix.set(MAGIC);const view=new DataView(prefix.buffer);view.setUint32(8,header.byteLength,true);view.setUint32(12,snapshot.data.byteLength,true);
   const file=new Blob([prefix,header,snapshot.data],{type:'application/octet-stream'});abort(signal);
   const result={file,name:`dq9-checkpoint-${snapshot.id}.dq9ckpt`,id:snapshot.id,bytes:file.size,parts:1,timings:{exportMs:now()-started}};
   emit(progress,{phase:'exported',id:snapshot.id,bytes:file.size,committed:true});return result;
  });},
  importCheckpoint(file,{expectedBinding,signal,onProgress:progress=onProgress}={}) {return operation(async()=>{
   const start=now(),expected=cloneJSON(expectedBinding);validateCheckpointBinding(expected);abort(signal);
   need(file&&uint(file.size,CHECKPOINT_LIMITS.maxPartBytes)&&file.size>16&&typeof file.arrayBuffer==='function','Invalid/oversized checkpoint file');
   emit(progress,{phase:'import-read',bytes:file.size,committed:false});const buffer=await file.arrayBuffer();abort(signal);
   need(buffer instanceof ArrayBuffer&&buffer.byteLength===file.size,'Checkpoint file size mismatch');const bytes=new Uint8Array(buffer),view=new DataView(buffer);
   need(MAGIC.every((x,i)=>bytes[i]===x),'Wrong checkpoint file format');const headerSize=view.getUint32(8,true),payloadSize=view.getUint32(12,true);
   need(headerSize>0&&headerSize<=CHECKPOINT_LIMITS.maxHeaderBytes&&16+headerSize+payloadSize===file.size,'Truncated/excessive checkpoint header');
   const text=decoder.decode(bytes.subarray(16,16+headerSize)),header=JSON.parse(text);keys(header,'id seal','file header');
   need(checkpointCanonical(header)===text,'Checkpoint header must use canonical JSON (no duplicate or ambiguous keys)');
   validateSeal(header.seal);need(header.seal.byteLength===payloadSize,'Checkpoint payload length mismatch');
   need(checkpointCanonical(header.seal.binding)===checkpointCanonical(expected),'Checkpoint expectedBinding mismatch','BINDING_MISMATCH');
   need(await checkpointSHA256(header.seal)===header.id,'Checkpoint manifest/binding/state digest mismatch');
   const data=buffer.slice(16+headerSize);need(await checkpointSHA256(data)===header.seal.dataSHA256,'Checkpoint payload digest mismatch');abort(signal);
   const importReadVerifyMs=now()-start;
   const result=await save({data,manifest:header.seal.manifest},{binding:expected,trainingState:header.seal.trainingState,signal,onProgress:progress});
   result.timings.importReadVerifyMs=importReadVerifyMs;result.timings.importTotalMs=now()-start;return result;
  });},
  async status() {ready();const rows=await historyDB(db),estimate=await storage?.estimate?.();return {namespace:CHECKPOINT_DB_NAME,version:1,busy,records:rows.length,bytes:rows.reduce((n,x)=>n+x.byteLength,0),maxRecords,maxBytes,history:rows,originQuota:Number.isFinite(estimate?.quota)?estimate.quota:null,originUsage:Number.isFinite(estimate?.usage)?estimate.usage:null,persisted:typeof storage?.persisted==='function'?await storage.persisted():null,evictionPolicy:'none; append-only; explicit quota failure',durability:'strict requested for each write; browser storage may still be evicted'};},
  close() {if(closed)return;need(!busy,'Wait for the checkpoint operation before closing','STORE_BUSY');closed=true;db.close();}
 };
}
