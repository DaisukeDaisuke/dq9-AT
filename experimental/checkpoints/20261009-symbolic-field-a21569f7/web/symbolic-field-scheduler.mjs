// Source-bound, seed-free selected-field scheduler component. A video timestamp
// is never a source invocation count. Deferred branches retain their original
// timer/input; a resolved local zero does not close other world consumers.
import {decodeActorArm9} from './actor-rom-mining.mjs';
import {decodeMapEntryOverlay} from './map-entry-source-binding.mjs';
import {assertProductionATInput} from './production-at-input-policy.mjs';
const owned=new WeakSet(),hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
const need=(v,m)=>{if(!v)throw Error(m);},copy=structuredClone;
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const ranges=[
 ['selected-field-reset','arm9',0x0202821c,140,'bf01f0edb9a0bc9e08debcdf027006f06a106d3fbda3fff60e0986d53a3ed496'],
 ['source-clock-initializer-and-setter','arm9',0x0200ff80,224,'9b6a1cbd4e1e55de10ec3a277c0d677bcbdfe65caba3d6982377f636b84b18f5'],
 ['source-clock-reader','arm9',0x0201006c,8,'d2a08d5fd4932aa55140064c13ff5a83b7467855a48f8553d35b513179f6d743'],
 ['complete-field-scheduler','arm9',0x02074568,2416,'ac479da1a8deeac5cc7cbf5f4287734ecb5ab2e189627d21b8036ab1250da4a5'],
 ['table-candidates-and-selection','arm9',0x02075050,280,'cbbe70197f91ae4cbc59a0103a78445d65579c7e9c224c691bc0096ba32e061b'],
 ['ATRandInt-one-update','arm9',0x02031ea8,84,'4ea4d67380f9fe3bb907b4a872c35a0b49df5cbc1da329769a1a4560b716e3cb'],
 ['graph-result-active-write','overlay17',0x021b507c,244,'1b7984679f3659548400dc7cddb82b0a4af4244186056fbd1185074c04ad28ff']
];
const immediate=w=>{const n=w&255,r=((w>>>8)&15)*2;return ((n>>>r)|(n<<(32-r)))>>>0;};
export async function bindSourceFieldScheduler({rom,romSHA256}){
 need(rom instanceof Uint8Array&&/^[a-f0-9]{64}$/.test(romSHA256??'')&&await hash(rom)===romSHA256,'Owned ROM bytes and identity required for scheduler source');
 const images={arm9:decodeActorArm9(rom),overlay17:decodeMapEntryOverlay(rom)},sourceRanges=[];
 for(const [name,image,address,bytes,expected]of ranges){const r=images[image],b=r.bytes.subarray(address-r.base,address-r.base+bytes);need(b.length===bytes&&await hash(b)===expected,'Unsupported scheduler source: '+name);sourceRanges.push({name,image,address,bytes,sha256:expected});}
 const a=images.arm9,d=new DataView(a.bytes.buffer,a.bytes.byteOffset,a.bytes.byteLength),word=p=>d.getUint32(p-a.base,true);
 const clockCap=word(0x02010058),clockDivisor=immediate(word(0x0200fff8)),threshold=immediate(word(0x020745dc)),initialClock=immediate(word(0x0200ff80)),resetTimer=immediate(word(0x0202822c));
 need(clockCap===50000&&clockDivisor===1000&&threshold===1000&&resetTimer===0&&initialClock===33,'Unsupported scheduler source constants');
 const value=freeze({schema:'ROM-field-scheduler-binding-v1',romSHA256,sourceRanges,resetTimer,threshold,clock:{initial:initialClock,elapsedCap:clockCap,divisor:clockDivisor,delta:{min:0,max:Math.floor(clockCap/clockDivisor)}},timerComparison:'signed-int32-less-than',selectedFieldOnly:true});owned.add(value);return value;
}
export function isBoundSourceFieldScheduler(value){return owned.has(value);}
const conditions=[
 'This selected field takes the fresh uncached 0202821c reset branch; successful ordinary graph initialization subsequently selects this graph',
 'The clock word is initialized by 0200ff80 or updated by 0200ffac; no other writer substitutes a clock value',
 'No intervening writer changes this field timer, and no prior scheduler invocations are omitted from the counted prefix',
 'Each counted invocation is this selected field scheduler; upstream active/story returns are retained and are not silently forced to pass'
];
export function prepareGraphPresentSchedulerDomain(source,binding){
 need(owned.has(binding),'Fresh owned scheduler instruction binding required');
 if(!source?.graph||source.romSHA256!==binding.romSHA256||source.record?.mapId>=40000&&source.record.mapId<50000)return {schema:'conditional-graph-scheduler-domain-v1',status:'unresolved-graph-source',reason:'Ordinary static graph source unavailable',unknownAlternativeRetained:true};
 const guaranteed=Math.floor((binding.threshold-1-binding.resetTimer)/binding.clock.delta.max);
 return {schema:'conditional-graph-scheduler-domain-v1',status:'conditional-source-domain-prepared',romSHA256:binding.romSHA256,record:copy(source.record),graph:{path:source.graph.path,nodeCount:source.graph.nodes.length},sourceRanges:copy(binding.sourceRanges),origin:{kind:'conditional-fresh-selected-field-reset',timerDomain:[binding.resetTimer,binding.resetTimer],ATState:'unresolved-symbolic-reference'},clockDeltaDomain:copy(binding.clock.delta),sourceInvocationCount:{min:0,max:null,measured:false,inferredFromVideoPTS:false},prefix:{maximumGuaranteedZeroDrawInvocations:guaranteed,forEachCount:{countDomain:{min:0,max:guaranteed},timerRelation:'0 <= timer <= count * maximumClockDelta',maximumClockDelta:binding.clock.delta.max,ATCalls:{min:'0',max:'0'}},firstPotentialTimerFrontier:guaranteed+1,minimumInvocationsBeforeConditionalNaturalWeightedEvent:guaranteed+1,frontierMeansDrawOccurred:false},conditions:conditions.slice(),conditionsMeasured:false,unresolved:['Fresh/cached/allocation and actual graph-load path','Number and order of source scheduler invocations','Free-slot, party, geometry and table branches after timer gate','Other actor, NPC, global, loader and network consumers'],wholeIntervalATCalls:{min:'0',max:null},currentATRecovered:false,unknownAlternativeRetained:true};
}
function values(domain,max,what){need(Array.isArray(domain)&&domain.length===2&&domain.every(Number.isSafeInteger)&&domain[0]>=0&&domain[1]>=domain[0]&&domain[1]<=max,what+' domain invalid');need(domain[1]-domain[0]<65536,what+' finite-domain budget exceeded');return Array.from({length:domain[1]-domain[0]+1},(_,i)=>domain[0]+i);}
function compact(values){const sorted=[...values].sort((a,b)=>a-b),out=[];for(const n of sorted){const p=out.at(-1);if(p&&p[1]+1===n)p[1]=n;else out.push([n,n]);}return out;}
/** Execute the existing scheduler for finite timer/clock alternatives.
 * Unknown seed is an opaque reference, never zero. Singleton-index draws advance
 * the reference without inventing outputs; output-dependent branches suspend.
 * Exact correlated timer/call states are kept internally, not Cartesian hulls.
 */
export function advanceSymbolicFieldScheduler(scheduler,binding,{ATReference,timerDomain,stateDomains,updates,tables={},maximumTransitions=1000000,maximumStates=65536}){
 assertProductionATInput({ATReference,timerDomain,stateDomains,updates});
 need(owned.has(binding)&&scheduler&&typeof scheduler.stepSymbolic==='function'&&scheduler.e&&scheduler.kernel,'Owned source binding and existing symbolic scheduler required');
 need(ATReference&&typeof ATReference==='object'&&!Array.isArray(ATReference)&&typeof ATReference.kind==='string','Opaque symbolic AT reference required');
 need(Array.isArray(updates)&&updates.length<=256&&Number.isSafeInteger(maximumTransitions)&&maximumTransitions>0&&maximumTransitions<=1000000&&Number.isSafeInteger(maximumStates)&&maximumStates>0&&maximumStates<=65536,'Bounded explicit update hypotheses required');
 need((timerDomain===undefined)!==(stateDomains===undefined),'Supply an initial timer domain or carried correlated state domains');
 let states=new Map(),transitions=0;const records=[];
 const groups=stateDomains??[{calls:'0',timers:[timerDomain]}];need(Array.isArray(groups)&&groups.length>0&&groups.length<=maximumStates,'Bounded carried state domain required');
 for(const group of groups){need(typeof group.calls==='string'&&/^(0|[1-9][0-9]*)$/.test(group.calls)&&BigInt(group.calls)<=BigInt(Number.MAX_SAFE_INTEGER-2304)&&Array.isArray(group.timers)&&group.timers.length>0,'Explicit nonnegative local call offset and timer intervals required');const position=BigInt(group.calls);for(const interval of group.timers)for(const timer of values(interval,0x7fffffff,'Timer')){states.set(timer+':'+position,{timer,position});need(states.size<=maximumStates,'Initial state budget exceeded');}}
 const correlated=ss=>{const groups=new Map();for(const s of ss.values()){const key=String(s.position);if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(s.timer);}return [...groups].sort((a,b)=>Number(BigInt(a[0])-BigInt(b[0]))).map(([calls,timers])=>({calls,timers:compact(timers)}));};
 const domain=ss=>{const timers=new Set(),counts=new Set();for(const s of ss.values()){timers.add(s.timer);counts.add(Number(s.position));}return{timerDomains:compact(timers),ATCallDomains:compact(counts),marginalDomainsOnly:true};};
 const output=(status,extra={})=>({schema:'symbolic-field-scheduler-progression-v1',status,ATReference,completedUpdates:records.length,...domain(states),stateDomains:correlated(states),records,ATReferenceRelation:{kind:'component-offset-plus-unresolved-other-consumers',otherATCalls:{min:'0',max:null}},componentScope:'completed selected-field paths only; reference advanced by ATCallDomains',wholeIntervalATCalls:{min:'0',max:null},numericSeedSupplied:false,sourceUpdateCountMeasured:false,conditions:conditions.slice(),conditionsMeasured:false,unknownAlternativeRetained:true,currentATRecovered:false,transitionsEvaluated:transitions,...extra});
 for(let index=0;index<updates.length;index++){
  const original=updates[index];need(original&&typeof original==='object','Explicit update hypothesis required');
  need([true,false,null,undefined].includes(original.active)&&[true,false,null,undefined].includes(original.storyAllowed),'Boolean or unknown activity/story gate required');
  const active=original.active==null?[false,true]:[original.active],story=original.storyAllowed==null?[false,true]:[original.storyAllowed];
  const supplied=original.clockDeltaDomain??[binding.clock.delta.min,binding.clock.delta.max],deltas=values(supplied,binding.clock.delta.max,'Clock');
  need(!['delta','elapsedLow','elapsedHigh'].some(k=>Object.hasOwn(original,k)),'Use an explicit source clock delta domain; elapsed words are not inferred');
  const next=new Map(),frontiers=new Map();let exhausted=null;
  outer:for(const before of states.values())for(const enabled of active)for(const allowed of story)for(const delta of enabled&&allowed?deltas:[0]){
   if(transitions>=maximumTransitions){exhausted='transition';break outer;}transitions++;
   const input={...original,active:enabled,storyAllowed:allowed,delta};delete input.clockDeltaDomain;
   const result=scheduler.stepSymbolic({seed:ATReference,...before},input,tables),position=BigInt(result.position);
   if(result.resolved){const key=result.timer+':'+position;if(!next.has(key)&&next.size>=maximumStates){exhausted='state';break outer;}next.set(key,{timer:result.timer,position});}
   else {const key=result.reason;let f=frontiers.get(key);if(!f){f={reason:key,timers:new Set(),predecessorTimers:new Set(),clockDeltas:new Set(),ATCalls:new Set(),cases:0,requestedDraw:result.requestedDraw?{kind:result.requestedDraw.kind,count:result.requestedDraw.count,positionIsInATCalls:true}:null};frontiers.set(key,f);}f.timers.add(result.timer);f.predecessorTimers.add(before.timer);f.clockDeltas.add(delta);f.ATCalls.add(Number(position));f.cases++;}
  }
  if(exhausted)return output(exhausted+'-budget-exhausted',{stoppedAtUpdate:index,refineOriginalInput:true,remainingAlternativesRetained:true,completedNextPaths:domain(next)});
  const summary={updateIndex:index,before:domain(states),completedNextPaths:domain(next),gatesMeasured:false,clockDeltaDomain:supplied.slice(),frontiers:[...frontiers.values()].map(f=>({...f,timers:compact(f.timers),predecessorTimers:compact(f.predecessorTimers),clockDeltas:compact(f.clockDeltas),ATCalls:compact(f.ATCalls),domainsAreMarginalProjections:true,refineOriginalInput:true}))};
  if(frontiers.size)return output('unresolved-source-frontier',{stoppedAtUpdate:index,completedNextPaths:domain(next),frontier:summary,refineOriginalInput:true,originalUpdate:copy(original)});
  records.push(summary);states=next;
 }
 return output('supplied-domain-prefix-resolved');
}
