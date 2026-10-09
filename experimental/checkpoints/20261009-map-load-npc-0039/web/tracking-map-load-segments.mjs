import {assertProductionATInput} from './production-at-input-policy.mjs';
import {prepareConditionalDestinationLoad} from './map-transition.mjs';
import {bindMapEntryInstructions} from './map-entry-source-binding.mjs';
const prepared=new WeakSet(),copy=structuredClone;
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export async function createConditionalMapLoadSegmentReader({project,rom,romSHA256}){
 if(!(rom instanceof Uint8Array)||await sha(rom)!==romSHA256)throw Error('Owned ROM bytes/identity required');
 const instructionBinding=await bindMapEntryInstructions(rom);
 return function read(input,{primitiveHypotheses=[]}={}){
  assertProductionATInput({input,primitiveHypotheses});
  const result={schema:'conditional-map-load-AT-segments-v1',segments:[],unresolved:[],currentATRecovered:false,unknownAlternativeRetained:true};
  const before=input?.entryWitnessFrames?.before,after=input?.entryWitnessFrames?.after;
  if(!before||!after||!input.fromMap||!input.map||before.sourcePTS>after.sourcePTS||!['romSHA256','sourceId','sourceEpoch','timelineSegment'].every(k=>before[k]===after[k])||before.romSHA256!==romSHA256){result.unresolved.push({reason:'Exact same-source entry witnesses and origin/destination map alternatives required'});return result;}
  // Missing primitives remain a packet requirement. The existing F06 absence
  // branch may resolve without them; no zero/false story values are supplied.
  const alternatives=primitiveHypotheses.length?primitiveHypotheses:[null];
  for(const primitive of alternatives){try{
   const source=prepareConditionalDestinationLoad(project,{fromMapId:input.fromMap.mapId,toMapId:input.map.mapId,primitive});
   const segment=freeze({schema:'source-bound-conditional-map-load-AT-segment-v1',romSHA256,entryWitnessFrames:copy(input.entryWitnessFrames),fromMap:copy(input.fromMap),toMap:copy(input.map),entrySignal:copy(input.entrySignal??null),source,instructionBinding,calls:source.npc.calls,seedRelation:'original AT stream advances by calls; no reseed inferred',missingPrefix:['earlier event post-state to reached loader','cleanup and pool/cache/allocation branch consumers'],missingSuffix:['pickup/treasure or other loader consumers outside NPC segment','loader completion to later event draw','intervening actor/global update order'],nativeRuntimePacketConstructed:false,conditionsMeasured:false,unknownAlternativeRetained:true,currentATRecovered:false});
   prepared.add(segment);result.segments.push(segment);
  }catch(error){result.unresolved.push({fromMap:copy(input.fromMap),toMap:copy(input.map),primitiveHypothesis:copy(primitive),reason:error.message,missingPrimitivePacket:primitive===null&&error.message==='Missing primitive context'?['story[3]','networkWord','quest185','eventFlags89/90']:[],unknownAlternativeRetained:true});}}
  return result;
 };
}
export function isPreparedConditionalMapLoadSegment(segment){return prepared.has(segment);}
function span(x){if(x===undefined)return {min:0n,max:null,reason:'Unobserved source consumers remain unbounded'};if(x?.kind!=='conditional-source-call-span'||typeof x.provenance!=='string'||!x.provenance)throw Error('Explicit source conditional call span required');const min=BigInt(x.min),max=x.max===null?null:BigInt(x.max);if(min<0n||(max!==null&&max<min))throw Error('Invalid call span');return {min,max,provenance:x.provenance};}
// Existing destination-inclusive AT engine edge format. Unknown sides stay
// unbounded; the final +1 is the later observed selection draw itself.
export function mapLoadCallsBetweenPostStates(segment,{prefix,suffix}={}){
 if(!prepared.has(segment))throw Error('Fresh source-prepared immutable segment required');
 const a=span(prefix),b=span(suffix),n=BigInt(segment.calls)+1n;
 return {callsBetweenPostStates:{min:String(a.min+n+b.min),max:a.max===null||b.max===null?null:String(a.max+n+b.max)},provenance:'Conditional ROM destination NPC segment plus explicit surrounding source call spans; later event draw included',conditions:segment.source.conditions,unresolvedParts:[...(a.max===null?['prefix']:[]),...(b.max===null?['suffix']:[])],assumptionsMeasured:false,sourceSegment:segment};
}

const readers=new WeakMap();
export async function prepareVideoMapLoadATSegments(bundle,context,{isCurrent=()=>true}={}){
 const {mineAutomaticReplayFactors}=await import('./video-replay-factor-search.mjs');
 const result={schema:'video-entry-map-load-segments-v1',segments:[],unresolved:[],entryCandidates:0,unknownAlternativeRetained:true,currentATRecovered:false};
 const entries=mineAutomaticReplayFactors(bundle).entries.filter(e=>e.bindingReady&&e.fromMap&&e.fromMap.recordKey!==e.toMap.recordKey);result.entryCandidates=entries.length;
 if(!entries.length)return result;
 if(!context?.rom||!context?.project){result.unresolved.push({reason:'Owned ROM context unavailable'});return result;}
 let cached=readers.get(context.rom);
 if(!cached||cached.project!==context.project||cached.romSHA256!==context.romSHA256){cached={project:context.project,romSHA256:context.romSHA256,promise:createConditionalMapLoadSegmentReader(context)};readers.set(context.rom,cached);cached.promise.catch(()=>{if(readers.get(context.rom)===cached)readers.delete(context.rom);});}
 const read=await cached.promise;
 for(const entry of entries){if(!isCurrent())throw new DOMException('Map load source preparation cancelled','AbortError');const r=read({...entry,map:entry.toMap});result.segments.push(...r.segments);result.unresolved.push(...r.unresolved);}
 return result;
}

// Both event alternatives keep their original species/table masks. This adds
// a disjunctive cross-map hypothesis, never intersects unrelated singletons.
export function connectMapLoadEventAlternatives(singleEvents,singleBranches,segments,{maximumBranches=32}={}){
 if(!Number.isSafeInteger(maximumBranches)||maximumBranches<1)throw Error('Positive map branch budget required');
 const output={branches:[],omittedPairs:0,unknownAlternativeRetained:true};
 const branchById=new Map(singleBranches.map(b=>[b.id,b]));
 const matches=(single,segment,side)=>{const anchor=segment.entryWitnessFrames[side==='before'?'before':'after'],record=(side==='before'?segment.fromMap:segment.toMap).recordKey;return single.sourceEvidence?.some(e=>{const p=e.mapHypothesisProvenance,f=p?.frame;return f&&['romSHA256','sourceId','sourceEpoch','timelineSegment'].every(k=>f[k]===anchor[k])&&(side==='before'?f.sourcePTS<=anchor.sourcePTS:f.sourcePTS>=anchor.sourcePTS)&&p.survivingBackgroundCandidates?.some(r=>r.recordKey===record);});};
 for(const [index,segment]of segments.entries()){
  if(!prepared.has(segment))throw Error('Unverified map-load segment');
  const gap=mapLoadCallsBetweenPostStates(segment);
  for(const a of singleEvents.filter(s=>matches(s,segment,'before')))for(const b of singleEvents.filter(s=>matches(s,segment,'after'))){
   const x=branchById.get(a.id),y=branchById.get(b.id);if(x?.events?.length!==1||y?.events?.length!==1||x.events[0].id===y.events[0].id)continue;
   if(output.branches.length>=maximumBranches){output.omittedPairs++;continue;}
   const events=[copy(x.events[0]),copy(y.events[0])];
   output.branches.push({id:'conditional-map-load:'+index+':'+a.id+':'+b.id,events,edges:[{from:events[0].id,to:events[1].id,...copy(gap)}],sightingEventBindings:{...x.sightingEventBindings,...y.sightingEventBindings},observationEdges:[...copy(x.observationEdges),...copy(y.observationEdges)],assumptions:[...x.assumptions,...y.assumptions,'Both latent selections belong to the selected before/after maps and straddle this conditional loader segment; native births and loader timestamps remain unproved','All surrounding update/loader consumers remain unbounded; this segment alone does not recover current AT']});
  }
 }
 return output;
}
