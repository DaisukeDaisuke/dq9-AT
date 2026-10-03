import fs from'node:fs/promises';import{createHash}from'node:crypto';import{resolve}from'node:path';import{prepareIndexIdentification,STREAM_KERNEL_SHA256}from'../web/at-identify-index-engine.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function loadPreparedIndexJob(directory){
 const manifest=JSON.parse(await fs.readFile(resolve(directory,'manifest.json'),'utf8')),bytes=await fs.readFile(resolve(directory,'prepared-request.json'));
 if(manifest.schema!=='dq9-at-index-job-preparation-v1'||manifest.status!=='prepared-not-executed'||sha(bytes)!==manifest.requestSHA256)throw Error('Prepared request identity mismatch');
 const expected=['at-identify-index-form.mjs','at-identify-index-engine.mjs','at-identify-form.mjs','at-identify-engine.mjs','at-observation-compiler.mjs'];if(!Array.isArray(manifest.dependencies)||manifest.dependencies.length!==expected.length)throw Error('Dependency list mismatch');
 for(const name of expected){const entry=manifest.dependencies.find(x=>x.path==='web/'+name),actual=await fs.readFile(new URL('../web/'+name,import.meta.url));if(!entry||sha(actual)!==entry.sha256)throw Error('Prepared source changed: '+name);}
 const tables=await fs.readFile(new URL('../web/data/enc.json',import.meta.url)),wasmBytes=await fs.readFile(new URL('../web/wasm/at_identify_stream.wasm',import.meta.url));if(sha(tables)!==manifest.tablesSHA256||sha(wasmBytes)!==STREAM_KERNEL_SHA256||manifest.kernelSHA256!==STREAM_KERNEL_SHA256)throw Error('Prepared data/kernel changed');
 const request=JSON.parse(bytes);for(const branch of request.experiment?.branches??[])for(const event of branch.events??[])for(const key of ['possibleMask','unresolvedMask']){const a=event[key];if(!Array.isArray(a)||a.length!==32768||a.some(x=>x!==0&&x!==1))throw Error('Invalid persisted event mask');event[key]=Uint8Array.from(a);}
 const checked=prepareIndexIdentification(request);return{request:checked.request,wasmBytes,manifest,initialCheckpoint:checked.checkpoint};
}
