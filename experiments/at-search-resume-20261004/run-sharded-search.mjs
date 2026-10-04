import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runIndexIdentification,indexResultForJSON,STREAM_KERNEL_SHA256} from '../../web/at-identify-index-engine.mjs';
import {readCandidateResult} from '../../web/at-candidate-forecast.mjs';

// Isolated single-branch runner. Only complete, byte-verified saved shards count.
// A crash within a shard leaves that whole shard pending. This trades duplicate
// computation for conservative coverage; it does not resume WASM internal state.
const [requestFile,out,firstText,lastText,shardText,maxShardsText='9999']=process.argv.slice(2);
assert(requestFile&&out&&firstText&&lastText&&shardText,'request out first last shardSize [maxShardsThisProcess]');
const sha=b=>createHash('sha256').update(b).digest('hex');
const requestBytes=await fs.readFile(requestFile),raw=JSON.parse(requestBytes);
assert.equal(raw.experiment.branches.length,1,'Multiple association branches require separate coverage; not supported by this runner');
const first=BigInt(firstText),last=BigInt(lastText),size=BigInt(shardText),limit=Number(maxShardsText);
assert(first>=1n&&last>=first&&last-first<2147483648n&&size>=1n&&size<=2147483648n);
assert(Number.isSafeInteger(limit)&&limit>=0);
const wasm=await fs.readFile(new URL('../../web/wasm/at_identify_stream.wasm',import.meta.url));
assert.equal(sha(wasm),STREAM_KERNEL_SHA256);
const binding={requestSHA256:sha(requestBytes),kernelSHA256:sha(wasm),first:String(first),last:String(last),shardSize:String(size),branchId:raw.experiment.branches[0].id};
await fs.mkdir(out,{recursive:true});
async function atomic(name,value){const tmp=path.join(out,name+'.pending');const f=await fs.open(tmp,'w');try{await f.writeFile(JSON.stringify(value,null,2));await f.sync();}finally{await f.close();}await fs.rename(tmp,path.join(out,name));}
let state;try{state=JSON.parse(await fs.readFile(path.join(out,'checkpoint.json')));assert.deepEqual(state.binding,binding,'Changed request/kernel/domain cannot reuse this checkpoint');}catch(e){if(e.code!=='ENOENT')throw e;state={schema:'isolated-single-branch-shards-v1',binding,completed:[],globallyUnique:false,currentVideoStateRecovered:false,productionLedgerChanged:false};}
let cursor=first,candidateCount=0n,fullyExported=true;
for(const entry of state.completed){
 assert.equal(entry.first,String(cursor));const end=BigInt(entry.last);assert(end>=cursor&&end<=last);
 const bytes=await fs.readFile(path.join(out,entry.file));assert.equal(sha(bytes),entry.sha256);
 const r=readCandidateResult(JSON.parse(bytes)),b=r.branches[0];
 assert.equal(r.status,'complete');assert.equal(r.domain.first,entry.first);assert.equal(r.domain.last,entry.last);
 assert.equal(r.origin.initialSeed,raw.domain.origin.initialSeed);assert.equal(b.branchId,binding.branchId);
 assert.deepEqual(b.searchedIndexIntervals,[{first:entry.first,last:entry.last}]);assert.deepEqual(b.unsearchedIndexIntervals,[]);
 candidateCount+=BigInt(b.candidateIndicesFound);fullyExported&&=b.candidateMaterialization.allFoundCandidatesMaterialized;
 cursor=end+1n;
}
let done=0;const start=performance.now();
while(cursor<=last&&done<limit){
 const end=cursor+size-1n<last?cursor+size-1n:last;const req=structuredClone(raw);
 for(const branch of req.experiment.branches)for(const e of branch.events){e.possibleMask=Uint8Array.from(e.possibleMask);e.unresolvedMask=Uint8Array.from(e.unresolvedMask);}
 req.domain.first=String(cursor);req.domain.last=String(end);
 req.domain.provenance='Explicit computational shard of original request; not a proved live consumption bound';
 req.budget={maxInspectedIndices:Number(end-cursor+1n),maxWallTimeMs:180000,chunkIndices:1000000};
 const result=indexResultForJSON(await runIndexIdentification(req,wasm));readCandidateResult(result);
 assert.equal(result.status,'complete','Incomplete shard stays pending, never counted as covered');
 const b=result.branches[0];assert.deepEqual(b.unsearchedIndexIntervals,[]);
 const name=`shard-${cursor}-${end}.json`;await atomic(name,result);
 const bytes=await fs.readFile(path.join(out,name));
 state.completed.push({first:String(cursor),last:String(end),file:name,sha256:sha(bytes),candidateCount:b.candidateIndicesFound,allFoundCandidatesMaterialized:b.candidateMaterialization.allFoundCandidatesMaterialized});
 await atomic('checkpoint.json',state); // file then manifest; orphan files are not ACKs
 candidateCount+=BigInt(b.candidateIndicesFound);fullyExported&&=b.candidateMaterialization.allFoundCandidatesMaterialized;cursor=end+1n;done++;
 console.log(JSON.stringify({savedShards:state.completed.length,through:String(cursor-1n),next:String(cursor),candidateCount:String(candidateCount)}));
}
const receipt={binding,status:cursor>last?'complete-domain':'paused-at-saved-boundary',completedShards:state.completed.length,newShardsThisProcess:done,unsearched:cursor<=last?[{first:String(cursor),last:String(last)}]:[],candidateCount:String(candidateCount),allFoundCandidatesMaterialized:fullyExported,elapsedThisProcessMs:performance.now()-start,globalAbsoluteIndexUnique:false,currentVideoStateRecovered:false,productionLedgerChanged:false};
await atomic('latest-receipt.json',receipt);console.log(JSON.stringify(receipt));
