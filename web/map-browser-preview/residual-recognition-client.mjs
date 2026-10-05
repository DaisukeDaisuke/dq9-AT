// Thin client for the existing ROM classifier Worker; no new proposal generator.
export class ResidualRecognitionClient{
 constructor(){this.sequence=0;this.epoch=0;this.worker=null;this.pending=null;this.romSHA=null;this.catalog=null;}
 cancel(){this.worker?.postMessage({type:'cancel'});if(this.pending){const p=this.pending;this.pending=null;p.reject(new DOMException('領域比較を中止しました','AbortError'));}}
 release(){this.cancel();this.worker?.terminate();this.worker=null;this.romSHA=null;this.catalog=null;}
 request(message,transfer=[],onProgress=()=>{}){this.cancel();return new Promise((resolve,reject)=>{const id='residual-compare-'+(++this.sequence);this.pending={id,resolve,reject,onProgress};this.worker.postMessage({...message,id,romEpoch:this.epoch},transfer);});}
 async load(rom,sha){if(this.romSHA===sha&&this.catalog)return this.catalog;this.release();this.worker=new Worker(new URL('../monster-recognition-worker.mjs?v=recognition-cache-20261005-1007',import.meta.url),{type:'module'});this.epoch++;
  this.worker.onmessage=({data:m})=>{const p=this.pending;if(!p||m.id!==p.id||m.romEpoch!==this.epoch)return;if(m.type==='progress'){p.onProgress(m);return;}if(m.type==='error'){this.pending=null;p.reject(Error(m.message));return;}if(m.type==='loaded'||m.type==='result'){this.pending=null;p.resolve(m);}};
  this.worker.onerror=e=>{const p=this.pending;this.pending=null;p?.reject(Error(e.message||'既存ROM比較Workerでエラー'));};
  const copy=rom.slice(),answer=await this.request({type:'load',rom:copy.buffer},[copy.buffer]);this.catalog=new Map(answer.catalog.map(r=>[r.modelId,r.speciesCandidates]));this.romSHA=sha;return this.catalog;
 }
 async classify(request,onProgress){const {residualEvidence,...recognitionRequest}=request;const copy={...recognitionRequest,crop:{...request.crop,rgba:request.crop.rgba.slice()}};const answer=await this.request({type:'recognize',...copy},[copy.crop.rgba.buffer],onProgress);return answer.result;}
}
