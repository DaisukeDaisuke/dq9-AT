// Scratch-only known-initial-seed terminal-index adapter. The legacy numeric
// state-interval backend is reused for validation, never for index coverage.
import {prepare as prepareLegacy} from './at-identify-engine.mjs';
export const PROGRESS_INTERVAL_MS=100;
export const STREAM_KERNEL_SHA256='fe39118a209b516d55456ded498a2dfc627cf473d248c29dd176e5316a9ca955';
const MAX64=18446744073709551615n, PERIOD31=2147483648n, PERIOD32=4294967296n;
const clone=x=>structuredClone(x), assert=(v,m)=>{if(!v)throw Error(m);};
const integer=n=>Number.isSafeInteger(n), text=x=>typeof x==='string'&&x.trim().length>0;
function index(v,label){assert(typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v),`${label}: canonical decimal string required`);const n=BigInt(v);assert(n<=MAX64,`${label}: uint64 maximum exceeded`);return n;}
export function snapshotWasm(bytes){
 const shared=typeof SharedArrayBuffer!=='undefined'&&(bytes instanceof SharedArrayBuffer||bytes?.buffer instanceof SharedArrayBuffer);
 assert(!shared,'Shared WASM storage unsupported');assert(bytes instanceof ArrayBuffer||ArrayBuffer.isView(bytes),'WASM byte storage required');
 return Uint8Array.from(ArrayBuffer.isView(bytes)?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):new Uint8Array(bytes));
}
// Same unsigned affine skip-ahead arithmetic as existing at_core.c. Count is
// reduced only by the full32-bit period, never by the output-equivalence period.
export function stateAtTerminalIndex(seed,position){
 assert(integer(seed)&&seed>=0&&seed<=0xffffffff,'Initial seed must be uint32');let n=BigInt(position);assert(n>=0n&&n<=MAX64,'Index must be uint64');n%=PERIOD32;
 let a=0x41c64e6d,c=0x3039,am=1,ac=0;
 while(n){if(n&1n){ac=(Math.imul(ac,a)+c)>>>0;am=Math.imul(am,a)>>>0;}c=Math.imul(c,(a+1)>>>0)>>>0;a=Math.imul(a,a)>>>0;n>>=1n;}
 return (Math.imul(seed,am)+ac)>>>0;
}
export function prepareIndexIdentification(raw){
 const request=clone(raw),{experiment,domain,budget,materialization}=request??{};
 assert(domain?.kind==='known-origin-terminal-indices','Explicit known-origin-terminal-indices domain required');
 const origin=domain.origin;assert(origin?.kind==='initial-state-before-draw-1','Explicit initial state before draw1 origin required');
 assert(integer(origin.initialSeed)&&origin.initialSeed>=0&&origin.initialSeed<=0xffffffff&&text(origin.provenance),'Supplied uint32 initial seed and provenance required');
 const first=index(domain.first,'First terminal index'),last=index(domain.last,'Last terminal index');
 assert(first>=1n,'Terminal draw index0 is not a post-draw event; first index must be at least1');assert(last>=first,'Ordered inclusive terminal index range required');
 assert(last-first+1n<=PERIOD31,'A single domain may contain at most2^31 terminal indices; split larger ranges explicitly');assert(text(domain.provenance),'Index-range provenance required');
 assert(domain.predecessorPolicy==='post-boot-events-only','Explicit post-boot-events-only policy required');
 if(experiment?.origin!==null&&experiment?.origin!==undefined)assert(experiment.origin.initialSeed===origin.initialSeed,'Compiled experiment origin conflicts with the supplied initial seed');
 assert(budget&&integer(budget.maxInspectedIndices)&&budget.maxInspectedIndices>=0,'Nonnegative safe-integer index inspection budget required');
 assert(materialization&&integer(materialization.maxCandidatesTotal)&&materialization.maxCandidatesTotal>=0&&materialization.maxCandidatesTotal<=100000,'Explicit total candidate materialization cap0..100000 required');
 const legacy=prepareLegacy({experiment,domain:{kind:'all-output-classes'},budget:{maxInspectedStates:budget.maxInspectedIndices,maxWallTimeMs:budget.maxWallTimeMs,chunkStates:budget.chunkIndices},branchPriority:request.branchPriority});
 const intervals=[{first:String(first),last:String(last)}];
 const branches=legacy.checkpoint.branches.map((old,i)=>{
  const {candidateClassesFound,sampleClasses,sampleFullStateLifts,searchedIntervals,unsearchedIntervals,oneEventClassWithinDomain,...metadata}=old;
  const b={...metadata,coordinateSystem:'absolute-terminal-draw-index-from-supplied-origin',candidateIndicesFound:candidateClassesFound,sampleCandidates:[],sampleLimit:16,searchedIndexIntervals:[],unsearchedIndexIntervals:clone(intervals),outsidePriorPossible:true,oneCandidateIndexWithinDomain:false,absoluteIndexProven:false,indexCorrespondenceConditionalOnSuppliedSeed:true,predecessorPolicy:'post-boot-events-only',warmupDraws:null,firstAllowedPredecessorEventIndex:'1',candidateMaterialization:{format:'uint32-relative-index-offsets-and-full-states',baseTerminalIndex:String(first),materializedCount:0,indexOffsets:new Uint32Array(0),states32:new Uint32Array(0),sharedRequestLimit:materialization.maxCandidatesTotal,allFoundCandidatesMaterialized:candidateClassesFound==='0',candidateExportCompleteWithinDeclaredDomain:false,truncated:false}};
  if(b.status==='pending'&&legacy.plans[i].ordered.length===1){b.status='unresolved';b.reason='This streaming adapter supports2..32 event chains; single-event index scanning is not implemented';b.candidateIndicesFound=null;}
  return b;
 });
 const checkpoint={schema:'bounded-at-terminal-index-identification-v1',sequence:0,status:'running',coordinateSystem:'absolute-terminal-draw-index-from-supplied-origin',domain:clone(domain),origin:clone(origin),originValidatedFromGame:false,domainLength:String(last-first+1n),inspectedIndices:'0',warmupInspections:'0',periods:{fullStateDraws:'4294967296',outputClassDraws:'2147483648',domainLengthAtMostOneOutputCycle:true},branches,materializationBudget:clone(materialization),materializedCandidateRecordsTotal:0,sightings:clone(legacy.checkpoint.sightings),associationAlternatives:clone(legacy.checkpoint.associationAlternatives),coverage:clone(legacy.checkpoint.coverage),coverageVerified:false,branchCountsSummed:false,unexcludedAlternativeBranchIds:branches.map(b=>b.branchId),globallyUnique:false,absoluteIndexProven:false,currentVideoStateRecovered:false,eventToObservationPropagationPerformed:false,kernelReviewStatus:'independently accepted research kernel',adapterReviewStatus:'independently accepted local adapter',progressIntervalMs:PROGRESS_INTERVAL_MS,budgetScope:'terminal-index inspections across branches; at most256 predecessor draws per searched branch are tracked separately; wall time checked between chunks'};
 return{request,plans:legacy.plans,order:legacy.order,first,last,budget:clone(budget),materialization:clone(materialization),checkpoint:summarize(checkpoint)};
}
function summarize(c){
 for(const b of c.branches){
  b.searchCompleteWithinDomain=b.status==='complete';b.eventStateOnly=true;b.eventToObservationPropagationPerformed=false;
  const count=b.candidateIndicesFound===null?null:BigInt(b.candidateIndicesFound),m=b.candidateMaterialization;
  b.samplesTruncated=count===null?null:count>BigInt(b.sampleCandidates.length);
  m.truncated=count===null?null:count>BigInt(m.materializedCount);m.allFoundCandidatesMaterialized=count!==null&&count===BigInt(m.materializedCount);
  m.candidateExportCompleteWithinDeclaredDomain=b.searchCompleteWithinDomain&&m.allFoundCandidatesMaterialized;
  b.oneCandidateIndexWithinDomain=b.searchCompleteWithinDomain&&count===1n;
 }
 // Every finite index prior leaves outside-prior possibilities; even a zero
 // conditional count cannot erase an unconstrained observation association.
 c.unexcludedAlternativeBranchIds=c.branches.map(b=>b.branchId);return c;
}
export function cancelIndexCheckpoint(checkpoint){const c=clone(checkpoint);c.status='cancelled';for(const b of c.branches)if(['pending','searching','budget-stopped'].includes(b.status))b.status='cancelled';return summarize(c);}
function sample(seed,at){const state32=stateAtTerminalIndex(seed,at);return{terminalIndex:String(at),state32,low31Class:state32&0x7fffffff,outputEquivalentState32:(state32^0x80000000)>>>0,outputEquivalentIndexModuloFullCycle:String((at+PERIOD31)%PERIOD32),sameIndexHasOneStateUnderSuppliedSeed:true,absoluteIndexProven:false};}
function append(xs,first,last){const tail=xs.at(-1);if(tail&&BigInt(tail.last)+1n===first)tail.last=String(last);else xs.push({first:String(first),last:String(last)});}
export async function runIndexIdentification(request,wasmBytes,emit=()=>{}){
 // Both snapshots happen synchronously before the first await.
 const p=prepareIndexIdentification(request),bytes=snapshotWasm(wasmBytes),c=p.checkpoint;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');assert(digest===STREAM_KERNEL_SHA256,'Frozen streaming kernel hash mismatch');
 const {module,instance}=await WebAssembly.instantiate(bytes,{});assert(WebAssembly.Module.imports(module).length===0,'Unexpected streaming kernel imports');const e=instance.exports;
 for(const name of ['mask_address','gap_min_address','gap_max_address','output_address','begin','scan_chunk','total_processed','total_matches'])assert(typeof e[name]==='function',`Streaming kernel export missing: ${name}`);
 c.kernelSHA256=digest;let inspected=0n,materialized=0;const start=performance.now(),buffers=new Map();let lastProgressAt=start;
 const progress=()=>{for(const [bi,buffer]of buffers)if(buffer.dirty){const m=c.branches[bi].candidateMaterialization;m.indexOffsets=Uint32Array.from(buffer.offsets);m.states32=Uint32Array.from(buffer.states);buffer.dirty=false;}c.sequence++;summarize(c);emit(clone(c));lastProgressAt=performance.now();};progress();
 for(const bi of p.order){
  const b=c.branches[bi],plan=p.plans[bi];if(b.status!=='pending')continue;
  if(inspected>=BigInt(p.budget.maxInspectedIndices)||performance.now()-start>=p.budget.maxWallTimeMs){b.status='budget-stopped';b.reason='Computational budget reached before this branch';continue;}
  const packed=new Uint32Array(e.memory.buffer,e.mask_address(),32768);packed.fill(0);for(let j=0;j<plan.ordered.length;j++)for(let r=0;r<32768;r++)if(plan.ordered[j].possibleMask[r])packed[r]|=(1<<j)>>>0;
  const mins=new Uint32Array(e.memory.buffer,e.gap_min_address(),32),maxs=new Uint32Array(e.memory.buffer,e.gap_max_address(),32);mins.fill(0);maxs.fill(0);plan.gaps.forEach((g,i)=>{mins[i]=g.min;maxs[i]=g.max;});
  const maxLag=plan.gaps.reduce((n,g)=>n+g.max,0),warmup=Number(p.first-1n<BigInt(maxLag)?p.first-1n:BigInt(maxLag));
  b.warmupDraws=warmup;b.warmupIndexInterval=warmup?{first:String(p.first-BigInt(warmup)),last:String(p.first-1n)}:null;
  assert(e.begin(plan.ordered.length,stateAtTerminalIndex(c.origin.initialSeed,p.first)&0x7fffffff,warmup)===1,'Frozen kernel rejected validated index chain');
  c.warmupInspections=String(BigInt(c.warmupInspections)+BigInt(warmup));b.status='searching';let cursor=p.first,count=0n;const offsets=[],states=[],buffer={offsets,states,dirty:false};buffers.set(bi,buffer);
  while(cursor<=p.last){
   const remaining=BigInt(p.budget.maxInspectedIndices)-inspected;if(remaining<=0n||performance.now()-start>=p.budget.maxWallTimeMs){b.status='budget-stopped';b.reason=remaining<=0n?'Terminal-index inspection budget reached':'Wall-time budget reached';break;}
   const size=Math.min(p.budget.chunkIndices,Number(remaining),Number(p.last-cursor+1n)),found=e.scan_chunk(size)>>>0;assert(found!==0xffffffff,'Streaming kernel rejected validated chunk');count+=BigInt(found);
   if(found&&(b.sampleCandidates.length<16||materialized<p.materialization.maxCandidatesTotal)){
    const bits=new Uint8Array(e.memory.buffer,e.output_address(),Math.ceil(size/8));
    outer:for(let byte=0;byte<bits.length;byte++)if(bits[byte])for(let bit=0;bit<8;bit++){
     const local=byte*8+bit;if(local>=size)break;if(!(bits[byte]&(1<<bit)))continue;
     const at=cursor+BigInt(local);let s;
     if(b.sampleCandidates.length<16){const record=sample(c.origin.initialSeed,at);b.sampleCandidates.push(record);s=record.state32;}
     if(materialized<p.materialization.maxCandidatesTotal){offsets.push(Number(at-p.first));states.push(s??stateAtTerminalIndex(c.origin.initialSeed,at));materialized++;buffer.dirty=true;}
     if(b.sampleCandidates.length>=16&&materialized>=p.materialization.maxCandidatesTotal)break outer;
    }
   }
   const last=cursor+BigInt(size)-1n;append(b.searchedIndexIntervals,cursor,last);cursor=last+1n;
   b.unsearchedIndexIntervals=cursor<=p.last?[{first:String(cursor),last:String(p.last)}]:[];inspected+=BigInt(size);b.candidateIndicesFound=String(count);c.inspectedIndices=String(inspected);
   b.candidateMaterialization.materializedCount=offsets.length;c.materializedCandidateRecordsTotal=materialized;
   assert(e.total_processed()===cursor-p.first&&e.total_matches()===count,'Kernel cumulative counters disagree with acknowledged coverage');
   if(cursor>p.last)b.status='complete';
   // Count every completed chunk internally. Only acknowledged progress is safe
   // for cancellation; an unacknowledged tail remains unsearched in the host.
   if(cursor<=p.last&&performance.now()-lastProgressAt>=PROGRESS_INTERVAL_MS){progress();await new Promise(resolve=>setTimeout(resolve,0));}
  }
 }
 for(const b of c.branches)if(b.status==='pending')b.status='budget-stopped';c.status=c.branches.some(b=>b.status==='budget-stopped')?'budget-stopped':'complete';progress();return clone(c);
}
// JSON output materializes only the explicitly bounded handoff, never all found
// matches. Its flags distinguish complete coverage from complete export.
export function indexResultForJSON(checkpoint){const c=clone(checkpoint);for(const b of c.branches){const m=b.candidateMaterialization;m.indexOffsets=Array.from(m.indexOffsets);m.states32=Array.from(m.states32);}return c;}
