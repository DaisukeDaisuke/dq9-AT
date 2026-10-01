import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {Worker} from 'node:worker_threads';
const app=await fs.readFile(new URL('../web/app.mjs',import.meta.url),'utf8');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},ok=a=>{assert(a);checks++};
function section(a,b){const start=app.indexOf(a),end=app.indexOf(b,start);assert(start>=0&&end>start);return app.slice(start,end);}
const posted=[],downloads=[],messages=[],events=[];
const element=()=>({disabled:false,textContent:'',value:'',replaceChildren(){}}),ui=new Proxy({},{get:(o,k)=>o[k]??=element()});
let terminates=0;
const worker={postMessage:m=>posted.push(m),terminate:()=>terminates++};
const api=vm.runInNewContext(`let loadSerial=1,exitRequest=0,exitPending=null,metadata={},worker=null,selection=null,selectedAsset=null,requestId=0;\n${section('function release(){','\nasync function loadROM(')}\n${section('function requestExitExport(){',"\nui['export-exits'].onclick=")}\n({requestExitExport,finishExitExport,release,ready(w){worker=w;metadata={};ui['export-exits'].disabled=false},state(){return {loadSerial,exitPending,metadata}}})`,{ui,Option:class{},status:(...a)=>messages.push(a),download:(...a)=>downloads.push(a),pretty:JSON.stringify,clearPreview(){},renderList(){},window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type){this.type=type}}});
api.requestExitExport();eq(posted.length,0);
api.ready(worker);api.requestExitExport();eq(posted.length,1);ok(ui['export-exits'].disabled);api.requestExitExport();eq(posted.length,1);
const first=posted[0].requestId,result={summary:{exitRowCount:978}};
api.finishExitExport({type:'map-exits',requestId:first+1,result});eq(downloads.length,0);ok(ui['export-exits'].disabled);
api.finishExitExport({type:'map-exits',requestId:first,result});eq(downloads.length,1);eq(downloads[0][0],'dq9-map-exits-local.json');eq(ui['export-exits'].disabled,false);ok(messages.at(-1)[0].includes('978'));
api.requestExitExport();api.finishExitExport({type:'map-exits-error',requestId:posted.at(-1).requestId,message:'bounded-invalid-input'});eq(downloads.length,1);eq(ui['export-exits'].disabled,false);ok(messages.at(-1)[0].includes('bounded-invalid-input'));
api.requestExitExport();const old=posted.at(-1).requestId;api.release();eq(terminates,1);ok(ui['export-exits'].disabled);eq(api.state().exitPending,null);eq(events.at(-1).type,'dq9-rom-release');
api.finishExitExport({type:'map-exits',requestId:old,result});eq(downloads.length,1);
api.ready(worker);api.requestExitExport();const fresh=posted.at(-1).requestId;api.finishExitExport({type:'map-exits-error',requestId:old,message:'stale'});ok(ui['export-exits'].disabled);api.finishExitExport({type:'map-exits',requestId:fresh,result});eq(downloads.length,2);
api.ready({postMessage(){throw Error('post failure')},terminate(){}});api.requestExitExport();eq(api.state().exitPending,null);eq(ui['export-exits'].disabled,false);ok(messages.at(-1)[0].includes('post failure'));
for(const name of ['index.html','map-recognize.html']){
 const html=await fs.readFile(new URL('../web/'+name,import.meta.url),'utf8');eq((html.match(/id="export-exits"/g)||[]).length,1);ok(!html.includes('./data/map-exits-jp.json'));ok(html.includes('到達条件未確定'));
}
ok(app.includes("if(serial!==loadSerial)return;"));ok(app.includes("m.type==='map-exits'||m.type==='map-exits-error'"));

// Actual existing Worker module. The bridge permits only its local WASM request.
const bridge=`import{parentPort,workerData}from'node:worker_threads';import fs from'node:fs/promises';globalThis.self=globalThis;globalThis.postMessage=(m,t)=>parentPort.postMessage(m,t);globalThis.fetch=async path=>{if(path!=='./wasm/map_render.wasm')throw Error('Unexpected network request');const b=await fs.readFile(new URL('./wasm/map_render.wasm',workerData.module));return{ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}};await import(workerData.module);parentPort.on('message',m=>self.onmessage({data:m}));postMessage({type:'bridge-ready'});`;
const w=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge)),{type:'module',workerData:{module:new URL('../web/worker.mjs',import.meta.url).href}});
const queue=[],waiters=[];let failure=null;w.on('message',m=>{queue.push(m);for(const f of [...waiters])f()});w.on('error',e=>{failure=e;for(const f of [...waiters])f()});
function next(type){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Worker timeout: '+type))},30000);const cleanup=()=>{clearTimeout(timer);const i=waiters.indexOf(check);if(i>=0)waiters.splice(i,1)};const check=()=>{if(failure){cleanup();reject(failure);return}const i=queue.findIndex(m=>m.type===type);if(i>=0){const m=queue.splice(i,1)[0];cleanup();resolve(m)}};waiters.push(check);check()})}
let romChecks=0;
try{
 await next('bridge-ready');w.postMessage({type:'map-exits',requestId:91});const missing=await next('map-exits-error');eq(missing.requestId,91);ok(missing.message.includes('NDS'));
 if(process.argv[2]){
  const b=await fs.readFile(process.argv[2]),buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);w.postMessage({type:'load',buffer,csv:''},[buffer]);await next('loaded');w.postMessage({type:'map-exits',requestId:92});const r=await next('map-exits');eq(r.requestId,92);eq(r.result.summary.exitRowCount,978);eq(r.result.summary.traversalProvenCount,0);eq(r.result.exits.filter(e=>!e.target.firstMapId).length,3);romChecks=4;
 }
}finally{await w.terminate()}
console.log(JSON.stringify({passed:true,checks,romChecks,actualWorker:true,scope:'Explicit local action, duplicate/stale/error/release lifecycle and existing Worker transport; no browser visual or travel claim'}));
