import {prepare,runIdentification} from './at-identify-engine.mjs';
import {prepareIndexIdentification,runIndexIdentification,indexResultForJSON} from './at-identify-index-engine.mjs';
const copy=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
function normal(v){if(ArrayBuffer.isView(v))return Array.from(v);if(Array.isArray(v))return v.map(normal);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normal(v[k])]));return v;}
export async function fingerprint(v){const bytes=typeof v==='string'?new TextEncoder().encode(v):new TextEncoder().encode(JSON.stringify(normal(v)));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function missing(domain,records,index){let out=domain.map(r=>({first:BigInt(r.first),last:BigInt(r.last)}));for(const {range} of records){const a=BigInt(range.first),z=BigInt(range.last);need(out.some(r=>a>=r.first&&z<=r.last),'ACK ranges overlap or exceed declared domain');out=out.flatMap(r=>z<r.first||a>r.last?[r]:[...(a>r.first?[{first:r.first,last:a-1n}]:[]),...(z<r.last?[{first:z+1n,last:r.last}]:[])]);}return out.map(r=>({first:index?String(r.first):Number(r.first),last:index?String(r.last):Number(r.last)}));}
// Persist is an awaited atomic replace contract. Native progress is deliberately
// unACKed; only fully finished subdomains enter the durable ledger. A thrown
// persist leaves the old ACK authoritative. Worker termination may discard work.
export async function runTrackingSearch({request,identity,wasmBytes,resume=null,persist,onProgress=()=>{},signal}){
 request=copy(request);identity=copy(identity);need(typeof persist==='function','Atomic durable checkpoint writer required');need(identity?.bundleSHA256&&identity?.romSHA256&&identity?.engineRevision&&identity?.observationRevision!==undefined,'Bundle/ROM/engine/revision identity required');
 const index=request.domain.kind==='known-origin-terminal-indices',initial=index?prepareIndexIdentification(request).checkpoint:prepare(request).checkpoint;
 const domain=index?[{first:request.domain.first,last:request.domain.last}]:prepare(request).intervals;
 const wasm=Uint8Array.from(wasmBytes);const wasmSHA256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',wasm))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const inputHash=await fingerprint({request,identity,wasmSHA256});let ack={schema:'tracking-at-ack-v1',inputHash,sequence:0,records:[],identity,wasmSHA256};
 if(resume){const {checksum,...payload}=copy(resume);need(await fingerprint(payload)===checksum,'ACK checksum mismatch');need(payload.schema===ack.schema&&payload.inputHash===inputHash,'Stale observation/predicate/domain/origin/engine revision');ack=payload;}
 const branchIds=new Set(initial.branches.map(b=>b.branchId));for(const r of ack.records){need(branchIds.has(r.branchId)&&r.result.branchId===r.branchId&&r.result.status==='complete','Invalid ACK branch record');const spans=index?r.result.searchedIndexIntervals:r.result.searchedIntervals;need(spans.length===1&&String(spans[0].first)===String(r.range.first)&&String(spans[0].last)===String(r.range.last),'ACK result coverage mismatch');}
 for(const b of initial.branches)missing(domain,ack.records.filter(r=>r.branchId===b.branchId),index);
 let spent=0,materialized=ack.records.reduce((n,r)=>n+(r.result.candidateMaterialization?.materializedCount??0),0);const start=performance.now(),max=index?request.budget.maxInspectedIndices:request.budget.maxInspectedStates,chunk=index?request.budget.chunkIndices:request.budget.chunkStates;
 const singletonCache=new Map();let singletonEvaluations=0,singletonReuses=0;
 const numericKeys=['status','candidateClassesFound','sampleClasses','sampleFullStateLifts','samplesTruncated','searchCompleteWithinDomain','searchedIntervals','unsearchedIntervals','oneEventClassWithinDomain'];
 for(const r of ack.records)if(r.result.numericReuseKey){const numeric={};for(const k of numericKeys)numeric[k]=copy(r.result[k]);singletonCache.set(r.result.numericReuseKey,numeric);}
 const envelope=async()=>({...copy(ack),checksum:await fingerprint(ack)});
 for(const b of initial.branches){if(b.status!=='pending')continue;const source=request.experiment.branches.find(x=>x.id===b.branchId),analytic=!index&&source.events.length===1;
  while(true){const remaining=missing(domain,ack.records.filter(r=>r.branchId===b.branchId),index);if(!remaining.length)break;if(signal?.aborted||performance.now()-start>=request.budget.maxWallTimeMs||(!analytic&&spent>=max))return {status:signal?.aborted?'cancelled':'budget-stopped',checkpoint:await envelope(),summary:summarize(ack,initial,domain,index)};
   const first=BigInt(remaining[0].first),end=BigInt(remaining[0].last),size=analytic?end-first+1n:BigInt(Math.min(chunk,max-spent)),last=end<first+size-1n?end:first+size-1n,range={first:index?String(first):Number(first),last:index?String(last):Number(last)};
   const q=copy(request);q.experiment.branches=[source];q.branchPriority=(q.branchPriority??[]).filter(x=>x.branchId===b.branchId);
   q.domain=index?{...q.domain,first:range.first,last:range.last}:{kind:'intervals',intervals:[range],provenance:'Exact unACKed subdomain of hashed original input'};
   // Each native run is at most one host chunk. Its output is ACKed only if complete.
   if(index){q.budget.maxInspectedIndices=Number(last-first+1n);q.materialization.maxCandidatesTotal=Math.max(0,request.materialization.maxCandidatesTotal-materialized);}else q.budget.maxInspectedStates=analytic?0:Number(last-first+1n);
   q.budget.maxWallTimeMs=Math.max(0,request.budget.maxWallTimeMs-(performance.now()-start));
   let result,cacheKey;
   if(analytic){
    const mask=source.events[0].possibleMask,bytes=mask instanceof Uint8Array?mask:Uint8Array.from(mask);
    const maskSHA256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    cacheKey=await fingerprint({maskSHA256,range,wasmSHA256,romSHA256:identity.romSHA256,tablesSHA256:identity.tablesSHA256??null});
    if(singletonCache.has(cacheKey)){
     // Reuse only the numerical predicate/domain calculation. Event identity,
     // source assumptions and observation edges remain this branch's own.
     result={...copy(prepare(q).checkpoint.branches[0]),...copy(singletonCache.get(cacheKey)),computation:'exact singleton predicate/domain cache reuse',numericReuseKey:cacheKey};singletonReuses++;
    }
   }
   if(!result){const raw=index?indexResultForJSON(await runIndexIdentification(q,wasm)):await runIdentification(q,wasm);result=raw.branches[0];
    if(analytic&&result.status==='complete'){
     singletonEvaluations++;const numeric={};for(const k of numericKeys)numeric[k]=copy(result[k]);singletonCache.set(cacheKey,numeric);result.numericReuseKey=cacheKey;
    }
   }
   result.numericEvaluationStats={singletonEvaluations,singletonReuses};
   if(signal?.aborted)return {status:'cancelled',checkpoint:await envelope(),summary:summarize(ack,initial,domain,index)};
   if(result.status!=='complete')return {status:'budget-stopped',checkpoint:await envelope(),summary:summarize(ack,initial,domain,index)};
   const next={...copy(ack),sequence:ack.sequence+1,records:[...copy(ack.records),{branchId:b.branchId,range,result}]};const saved={...next,checksum:await fingerprint(next)};await persist(copy(saved));ack=next;spent+=analytic?0:Number(last-first+1n);materialized+=result.candidateMaterialization?.materializedCount??0;onProgress({status:'acknowledged',checkpoint:copy(saved),summary:summarize(ack,initial,domain,index)});
  }
 }
 return {status:'complete',checkpoint:await envelope(),summary:summarize(ack,initial,domain,index)};
}
function summarize(ack,initial,domain,index){return {branches:initial.branches.map(b=>{const records=ack.records.filter(r=>r.branchId===b.branchId),unsearched=missing(domain,records,index),active=b.status==='pending',countKey=index?'candidateIndicesFound':'candidateClassesFound';const count=active?String(records.reduce((n,r)=>n+BigInt(r.result[countKey]),0n)):null;const samples=index?records.flatMap(r=>r.result.sampleCandidates).slice(0,16):records.flatMap(r=>r.result.sampleClasses).slice(0,16);const candidates=index?records.flatMap(r=>{const m=r.result.candidateMaterialization;return m.indexOffsets.map((offset,i)=>({terminalIndex:String(BigInt(m.baseTerminalIndex)+BigInt(offset)),state32:m.states32[i]}));}):[];return {branchId:b.branchId,status:active?(unsearched.length?'pending':'complete'):b.status,reason:b.reason??null,eventBoundaryId:b.eventBoundaryId,assumptions:copy(b.assumptions),eventProvenance:b.eventEvidence.map(e=>({eventId:e.id,source:e.eventEvidence?.source??null,producer:e.eventEvidence?.automaticProducer??null,modelId:e.eventEvidence?.modelId??null,sightingIds:copy(e.eventEvidence?.sightingIds??[])})),candidateCount:count,samples,examplesOnly:!index,materializedCandidates:index?candidates:undefined,allFoundCandidatesMaterialized:index&&count!==null?BigInt(candidates.length)===BigInt(count):false,unsearchedIntervals:unsearched,searchCompleteWithinDomain:active&&!unsearched.length,outsidePriorPossible:b.outsidePriorPossible,eventStateOnly:true,currentVideoStateRecovered:false};}),branchCountsSummed:false,currentVideoStateRecovered:false,globallyUnique:false,eventToObservationPropagationPerformed:false,ackSequence:ack.sequence};}
