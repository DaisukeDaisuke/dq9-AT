import {createNativeOrdinaryTurnResolver,createNativeOrdinaryTurnSequenceResolver} from './native-turn-phase.mjs?v=ordinary-turn-20261009-e76d366f';
import {enumerateNativeRouteChoiceHypotheses} from './tracking-native-route-choice.mjs?v=ordinary-turn-20261009-e76d366f';
import {connectConditionalNativeRouteChoices,composeConditionalNativeRouteSequence} from './tracking-native-route-chain.mjs?v=motion-closure-20261008-89e290ef';
import {fieldNativeFacing,fieldNativeDistance} from './field-preferred-node.mjs';
import {fingerprint} from './tracking-at-runner.mjs';
const clone=structuredClone;
const SCHEMA='source-native-route-cursor-with-clock-sequences-v3';
// Pages contain source event hypotheses only. The complete observation is owned
// once by the controller; neither pages nor scalar cursor copy its pixels.
async function pageAccess(store,inputHash,pages,current){
 const cache=new Map();
 const get=async index=>{const ref=pages.find(p=>index>=p.first&&index<p.first+p.count);if(!ref)throw Error('Route row page reference missing');let rows=cache.get(ref.key);if(!rows){const saved=await store.load(ref.key);current();if(!saved)throw Error('Route row page missing');const {checksum,...payload}=saved;if(checksum!==ref.checksum||payload.inputHash!==ref.key||payload.owner!==inputHash||await fingerprint(payload)!==checksum||payload.rows.length!==ref.count)throw Error('Route row page identity/checksum differs');rows=payload.rows;cache.set(ref.key,rows);while(cache.size>2)cache.delete(cache.keys().next().value);}return rows[index-ref.first];};
 const append=async rows=>{if(!rows.length)return;const first=pages.reduce((n,p)=>n+p.count,0),key=`tracking-native-route-page:${inputHash}:${first}`,payload={schema:'native-route-row-page-v1',inputHash:key,owner:inputHash,sequence:1,rows},checksum=await fingerprint(payload);current();const old=await store.load(key);current();if(old){if(old.checksum!==checksum||await fingerprint(Object.fromEntries(Object.entries(old).filter(([k])=>k!=='checksum')))!==checksum)throw Error('Immutable route row page differs');}else await store.save(key,{...payload,checksum});current();pages.push({key,first,count:rows.length,checksum});cache.set(key,rows);};
 return{get,append};
}
export async function advanceNativeRouteEnumeration(inputs,source,{store,resume=null,engineRevision,observationIdentity=null,isCurrent=()=>true,maximumRouteRows=4096,maximumPairEvaluations=32768,maximumChains=32,maximumEvents=32,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 if(!store?.load||!store?.save||typeof engineRevision!=='string'||!engineRevision)throw Error('Durable route store and source engine identity required');
 if(![maximumRouteRows,maximumPairEvaluations,maximumChains].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isSafeInteger(maximumEvents)||maximumEvents<2||maximumEvents>32)throw Error('Invalid route slice bounds');
 const current=()=>{if(!isCurrent())throw new DOMException('Native route cursor superseded','AbortError');};current();
 const {romSHA256,resources,trig,motionKernel,fieldKernel,sourceBinding}=source;
 const candidates=(inputs?.perSightingPriorCandidates??[]).flatMap(r=>r.candidates??[]).filter(c=>c.conditionalATInput?.priorSelectionLinks?.length&&c.conditionalATInput?.incomingSelectionLinks?.length);
 if(new Set(candidates.map(c=>c.id)).size!==candidates.length)throw Error('Ambiguous native route candidate identity');
 const turnAvailable=Boolean(motionKernel.sourceBinding&&typeof motionKernel.e?.monster_motion_turn_angle==='function');
 const turnSequenceAvailable=turnAvailable&&Boolean(motionKernel.sourceBinding.ordinaryClockPhaseDomain);
 const jobs=candidates.flatMap((candidate,index)=>[{index,mode:'stable'},...(turnAvailable?[{index,mode:'ordinary-turn'}]:[]),...(turnSequenceAvailable?[{index,mode:'ordinary-turn-sequence'}]:[])]);
 const limits={maximumRouteRows,maximumPairEvaluations,maximumChains,maximumEvents};
 const inputHash=await fingerprint({schema:SCHEMA,engineRevision,observationIdentity,romSHA256,sourceBindingKind:sourceBinding?.kind??null,turnAvailable,turnSequenceAvailable,inputs,resources,limits});current();
 if(resume&&(resume.schema!==SCHEMA||resume.inputHash!==inputHash))throw Error('Native route cursor input/source identity differs');
 const state=resume?clone(resume):{schema:SCHEMA,inputHash,sequence:0,phase:'choices',candidateCursor:0,choices:jobs.map(()=>null),exhausted:jobs.map(()=>false),turnSupportPages:{},pages:[],rowCount:0,batchStart:0,dfs:null,totalRowsVisited:0,totalPairEvaluations:0,totalChains:0,depthLimitReached:false};
 if(state.choices.length!==jobs.length||state.exhausted.length!==jobs.length)throw Error('Native route candidate cursor differs');
 if(!['choices','chains','complete'].includes(state.phase)||!['sequence','rowCount','batchStart','totalRowsVisited','totalPairEvaluations','totalChains'].every(k=>Number.isSafeInteger(state[k])&&state[k]>=0)||state.batchStart>state.rowCount||!state.exhausted.every(x=>typeof x==='boolean')||!Number.isSafeInteger(state.candidateCursor)||state.candidateCursor<0||state.candidateCursor>=Math.max(1,jobs.length))throw Error('Invalid native route checkpoint counters');
 let pageRows=0;for(const p of state.pages){if(p.first!==pageRows||!Number.isSafeInteger(p.count)||p.count<=0||p.key!==`tracking-native-route-page:${inputHash}:${p.first}`||!/^[a-f0-9]{64}$/.test(p.checksum??''))throw Error('Invalid native route page reference');pageRows+=p.count;}if(pageRows!==state.rowCount)throw Error('Native route page coverage differs');
 if(state.phase==='chains'){const d=state.dfs;if(!d||!Number.isSafeInteger(d.latest)||d.latest< -1||d.latest>=state.rowCount||!Array.isArray(d.stack)||d.stack.length>maximumEvents||d.stack.some(f=>!Array.isArray(f.sequence)||!f.sequence.length||f.sequence.length>maximumEvents||f.sequence.some(i=>!Number.isSafeInteger(i)||i<0||i>=state.rowCount)||!Number.isSafeInteger(f.nextPrior)||f.nextPrior< -1||f.nextPrior>=state.rowCount||typeof f.extended!=='boolean'))throw Error('Invalid native route chain frontier');}
 if(state.phase==='complete'&&(!state.exhausted.every(Boolean)||state.dfs))throw Error('Route checkpoint claims premature exhaustion');
 const output={schema:'automatic-conditional-native-route-chains-v1',turningHypothesesAvailable:turnAvailable,chains:[],deferred:[],budgetStopped:false,routeRows:0,pairEvaluations:0,chainRowVisits:0,unknownAlternativeRetained:true,currentVideoStateRecovered:false,sourceRuntimeInitialized:false,sourceClockKnown:false,minimumProvenATCalls:0,coverageComplete:false,budgets:limits,candidateIds:candidates.map(c=>c.id)};
 if(state.phase==='complete')return{...output,resumeCursor:state,progressed:false,enumerationCompleteWithinSuppliedSupport:true};
 const pendingSupport=new Map(),loadedSupport=new Map();
 if(!state.turnSupportPages||typeof state.turnSupportPages!=='object')throw Error('Turning support ownership references missing');
 const saveSupport=async()=>{for(const[key,value]of pendingSupport){const payload={schema:'source-turn-support-page-v1',owner:inputHash,key,value},checksum=await fingerprint(payload),storageKey=`tracking-turn-support:${inputHash}:${await fingerprint(key)}`;current();const prior=state.turnSupportPages[key];if(prior&&prior.checksum!==checksum)throw Error('Source turning support changed');const saved=await store.load(storageKey);current();if(saved){if(saved.checksum!==checksum||await fingerprint(saved.payload)!==checksum)throw Error('Turning support page changed');}else await store.save(storageKey,{inputHash:storageKey,sequence:1,payload,checksum});current();state.turnSupportPages[key]={key:storageKey,checksum};loadedSupport.set(key,value);}pendingSupport.clear();};
 const getSupport=async key=>{if(loadedSupport.has(key))return loadedSupport.get(key);const ref=state.turnSupportPages[key];if(!ref)throw Error('Turning evidence not owned');const saved=await store.load(ref.key);current();if(!saved||saved.checksum!==ref.checksum||await fingerprint(saved.payload)!==ref.checksum||saved.payload.owner!==inputHash||saved.payload.key!==key)throw Error('Turning evidence identity/checksum differs');loadedSupport.set(key,saved.payload.value);return saved.payload.value;};
 const page=await pageAccess(store,inputHash,state.pages,current),args={romSHA256,resources,motionKernel,fieldKernel,sourceFacing:a=>fieldNativeFacing(a,trig),sourceDistance:fieldNativeDistance};
 const sequenceArgs=turnSequenceAvailable?{...args,turnPhaseResolver:createNativeOrdinaryTurnSequenceResolver({motionKernel,sourceFacing:args.sourceFacing}),onTurnSupport:(key,value)=>pendingSupport.set(key,clone(value))}:null;
 const turnArgs=turnAvailable?{...args,turnPhaseResolver:createNativeOrdinaryTurnResolver({motionKernel,sourceFacing:args.sourceFacing}),onTurnSupport:(key,value)=>pendingSupport.set(key,clone(value))}:null;
 if(state.phase==='choices'){
  const rows=[],iterators=new Map();state.batchStart=state.rowCount;
  while(state.exhausted.some(x=>!x)&&output.routeRows<maximumRouteRows){
   const index=state.candidateCursor;state.candidateCursor=(index+1)%jobs.length;if(state.exhausted[index])continue;
   if(!iterators.has(index))iterators.set(index,enumerateNativeRouteChoiceHypotheses(candidates[jobs[index].index],jobs[index].mode==='ordinary-turn'?turnArgs:jobs[index].mode==='ordinary-turn-sequence'?sequenceArgs:args,{resume:state.choices[index],onCursor:c=>{state.choices[index]=c;}}));
   const next=iterators.get(index).next();if(next.done){state.exhausted[index]=true;continue;}
   output.routeRows++;state.totalRowsVisited++;if(next.value.kind==='conditional-event')rows.push(next.value);else output.deferred.push(next.value);
   if(output.routeRows%64===0){await yieldTask();current();}
  }
  await saveSupport();await page.append(rows);state.rowCount+=rows.length;
  if(rows.length){state.phase='chains';state.dfs={latest:state.rowCount-1,stack:[]};}
  else if(state.exhausted.every(Boolean))state.phase='complete';
 }
 if(state.phase==='chains'){
  const dfs=state.dfs,linkOptions={resources,sourceDistance:fieldNativeDistance,sourceBinding};
  async function emit(frame){if(frame.sequence.length<2||!frame.sequence.some(i=>i>=state.batchStart))return;const rows=[];for(const i of frame.sequence)rows.push(await page.get(i));const chain=composeConditionalNativeRouteSequence(rows,linkOptions);if(chain.kind==='conditional-chain'){const supports={};for(const row of rows){const key=row.reference.conditionalTurningSupportReference;if(key)supports[key]=await getSupport(key);}chain.sourceEvidence.turnSupportRegistry=supports;output.chains.push(chain);state.totalChains++;}}
  while((dfs.latest>=0||dfs.stack.length)&&output.chainRowVisits<maximumPairEvaluations&&output.chains.length<maximumChains){
   current();if(!dfs.stack.length){dfs.stack.push({sequence:[dfs.latest--],nextPrior:state.rowCount-1,extended:false});}
   const frame=dfs.stack.at(-1);
   if(frame.sequence.length===maximumEvents||frame.nextPrior<0){if(frame.sequence.length===maximumEvents)state.depthLimitReached=true;if(frame.sequence.length===maximumEvents||!frame.extended)await emit(frame);dfs.stack.pop();continue;}
   const priorIndex=frame.nextPrior--,head=await page.get(frame.sequence[0]),prior=await page.get(priorIndex);
   output.chainRowVisits++;if(output.chainRowVisits%64===0){await yieldTask();current();}
   if(prior.reference.to.sourcePTS>head.reference.from.sourcePTS)continue;
   output.pairEvaluations++;state.totalPairEvaluations++;
   const link=connectConditionalNativeRouteChoices(prior,head,linkOptions);
   if(link.kind==='conditional-chain'){frame.extended=true;dfs.stack.push({sequence:[priorIndex,...frame.sequence],nextPrior:state.rowCount-1,extended:false});}
   if(output.pairEvaluations%64===0){await yieldTask();current();}
  }
  if(dfs.latest<0&&!dfs.stack.length){state.dfs=null;state.phase=state.exhausted.every(Boolean)?'complete':'choices';}
 }
 current();state.sequence++;
 output.budgetStopped=state.phase!=='complete';output.enumerationCompleteWithinSuppliedSupport=state.phase==='complete';output.depthLimitReached=state.depthLimitReached;output.maximalSequenceEnumerationComplete=state.phase==='complete'&&!state.depthLimitReached&&inputs?.enumeration?.budgetStopped===false;output.unenumeratedAlternativesRetainedAsUnknown=true;output.shorterPrefixesAndOtherConsumerOrdersRetainedAsUnknown=true;output.maximumEvents=maximumEvents;output.candidateEnumeration=jobs.map((job,i)=>({candidateId:candidates[job.index].id,motionHypothesis:job.mode,cursor:clone(state.choices[i]),exhausted:state.exhausted[i],unvisitedAlternativesRetainedAsUnknown:!state.exhausted[i]}));
 return{...output,resumeCursor:state,progressed:true};
}
