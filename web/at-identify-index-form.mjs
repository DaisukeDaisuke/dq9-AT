import {buildFormRequest} from './at-identify-form.mjs';
import {parseSeed} from './at-core.mjs';
import {prepareIndexIdentification,cancelIndexCheckpoint} from './at-identify-index-engine.mjs';
function decimal(s,label){if(typeof s!=='string'&&typeof s!=='bigint'&&!(typeof s==='number'&&Number.isSafeInteger(s)))throw Error(`${label}: exact string, BigInt or safe-integer input required`);const v=String(s).trim();if(!/^(0|[1-9][0-9]*)$/.test(v))throw Error(`${label}: canonical decimal required`);return v;}
export function buildIndexModeFormRequest(form,tables){
 if(form.searchMode!=='known-origin-terminal-indices')throw Error('Explicit index search mode required');
 // Reuse the public form's observation/compiler validation and alternative
 // branches. Its temporary validation domain is discarded, never reported.
 const base=buildFormRequest({...form,domainMode:'all',maxStates:form.maxIndices,chunkStates:form.chunkIndices},tables);
 const request={experiment:base.experiment,domain:{kind:'known-origin-terminal-indices',origin:{kind:'initial-state-before-draw-1',initialSeed:parseSeed(form.initialSeed),provenance:String(form.seedProvenance??'').trim()},first:decimal(form.firstIndex,'First index'),last:decimal(form.lastIndex,'Last index'),predecessorPolicy:'post-boot-events-only',provenance:String(form.indexProvenance??'').trim()},budget:{maxInspectedIndices:base.budget.maxInspectedStates,maxWallTimeMs:base.budget.maxWallTimeMs,chunkIndices:base.budget.chunkStates},materialization:{maxCandidatesTotal:Number(decimal(form.maxCandidates,'Candidate materialization cap'))}};
 prepareIndexIdentification(request);return request;
}
export function createIndexModeController({loadResources,startSearch,onState=()=>{}}){
 let epoch=0,job=null,abort=null;
 const cancel=()=>{epoch++;abort?.abort();abort=null;if(job){const checkpoint=job.checkpoint();job.cancel();job=null;onState({phase:'cancelled',checkpoint:cancelIndexCheckpoint(checkpoint)});}else onState({phase:'cancelled',checkpoint:null});};
 const run=async form=>{const snapshot=structuredClone(form),mine=++epoch;abort?.abort();job?.cancel();job=null;abort=new AbortController();onState({phase:'loading',checkpoint:null});
  try{const resources=await loadResources(abort.signal);if(mine!==epoch)return null;const request=buildIndexModeFormRequest(snapshot,resources.tables);job=startSearch(request,{wasmBytes:resources.wasmBytes,onProgress:checkpoint=>{if(mine===epoch)onState({phase:'running',checkpoint});}});onState({phase:'running',checkpoint:job.checkpoint()});const result=await job.result;if(mine!==epoch)return null;job=null;abort=null;onState({phase:result.status,checkpoint:result});return result;}
  catch(error){if(mine!==epoch)return null;job?.cancel();job=null;abort=null;onState({phase:'failed',checkpoint:null,error:String(error?.message??error)});return null;}
 };
 return{run,cancel};
}
export function indexCoverageFraction(branch){const length=xs=>xs.reduce((n,r)=>n+BigInt(r.last)-BigInt(r.first)+1n,0n),done=length(branch.searchedIndexIntervals),left=length(branch.unsearchedIndexIntervals);return done+left?Number(done)/Number(done+left):0;}
