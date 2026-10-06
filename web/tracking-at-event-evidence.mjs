import {collectNativeTrackingBodySupport} from './tracking-native-body-support.mjs?v=enc-motion-at-20261006-1156';
import {sightingBodyMapCompatibility} from './map-browser-preview/conditional-body-map-compatibility.mjs?v=enc-motion-at-20261006-1156';
import {trackingSightingMapProvenance} from './map-browser-preview/map-hypothesis-provenance.mjs?v=native-body-20261006-0212';
// Automatic *conditional* source-model predicates, never native event certificates.
// A visible entity's selection can precede its first sighting by an unknown time.
// Singleton event-state domains are finite without inventing an inter-event gap.
const clone=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
export function collectTrackingSightings(bundle){
 need(bundle?.schema==='headless-monster-observation-bundle-v1','Observation bundle required');
 const rows=(bundle.sightings??[]).map(s=>({s,plan:bundle.source?.modelPlan,mapProvenance:trackingSightingMapProvenance(bundle,s)}));
 for(const v of bundle.videoObservations??[])for(const f of v.timeline?.frames??[])for(const s of f.sightings??[])rows.push({s,plan:f.modelPlan,mapProvenance:trackingSightingMapProvenance(bundle,s,f)});
 const seen=new Map(),groups=new Map();
 for(const {s,plan,mapProvenance} of rows){need(typeof s.id==='string','Sighting identity required');if(seen.has(s.id)){need(JSON.stringify(seen.get(s.id).s)===JSON.stringify(s),'Conflicting immutable sighting');continue;}
  const h=s.tentativeImageTrack,associated=h?.trackId!==undefined&&h?.trackId!==null&&Array.isArray(h.sourceIdentity)&&h.sourceIdentity.length===3&&h.sourceIdentity.every(x=>x!==null&&x!==undefined);
  const key=JSON.stringify(associated?[h.sourceIdentity,h.trackId]:['unassociated',s.id]);
  if(!groups.has(key))groups.set(key,{key,sourceIdentity:associated?clone(h.sourceIdentity):null,trackId:associated?h.trackId:null,rows:[]});
  const row={s:clone(s),plan:clone(plan),mapProvenance:clone(mapProvenance)};groups.get(key).rows.push(row);seen.set(s.id,row);
 }
 return {rows:[...seen.values()],groups:[...groups.values()]};
}
export function deriveTrackingEventEvidence(bundle){
 const {groups,rows}=collectTrackingSightings(bundle),singleEvents=[],tracks=[],deferred=[];
 for(const [index,group]of groups.entries()){
  const candidates=new Map();
  for(const {s,plan,mapProvenance}of group.rows){
   const prediction=s.conditionalBodyPrediction,fit=prediction?.bodyFit,mapCompatibility=sightingBodyMapCompatibility(bundle,s,plan,mapProvenance);
   const supported=prediction?.kind==='conditional-ROM-body-model-prediction'&&typeof prediction.modelId==='string'&&prediction.agreement===true&&prediction.appearanceModelId===prediction.modelId&&prediction.bodyModelId===prediction.modelId&&Number.isFinite(fit?.pixelErrorReduction)&&fit.pixelErrorReduction>0&&fit.spatialSupportRank>=2&&fit.bodySpatiallyDegenerate!==true;
   const alias=supported?(s.modelAliases??[]).find(a=>a.modelId===prediction.modelId):null;
   const model=alias?plan?.models?.find(m=>m.modelId===alias.modelId):null;
   const species=prediction?.speciesCandidates?.map(a=>a.monsterId)??[];
   const canRun=Boolean(mapCompatibility.jointlySupported&&model&&species.length&&species.every(n=>Number.isInteger(n)&&(alias.speciesCandidates??[]).some(a=>a.monsterId===n))&&mapCompatibility.tableSpeciesAlternatives.length);
   deferred.push({sightingId:s.id,mapHypothesisProvenance:clone(mapProvenance),mapCompatibility:clone(mapCompatibility),sourcePTS:s.sourcePTS??null,modelIds:(s.modelAliases??[]).map(a=>a.modelId).filter(id=>!canRun||id!==prediction.modelId),reason:!mapCompatibility.jointlySupported&&mapCompatibility.modelId?'Joint body/species/table evidence deferred: '+mapCompatibility.status+'. Model, failed/unsearched map and other spawn-route alternatives remain unknown.':canRun?'Other ranked aliases retained as deferred alternatives, not rejected.':'No supported conditional ROM-body/species prediction with matching own-frame model/table provenance.',noEventPossible:true,unclassifiedRanksPreserved:true});
   if(!canRun)continue;
   if(!candidates.has(alias.modelId))candidates.set(alias.modelId,{pairs:new Map(),sources:[]});const c=candidates.get(alias.modelId);
   for(const pair of mapCompatibility.tableSpeciesAlternatives)c.pairs.set(`${pair.tableId}/${pair.monsterId}`,clone(pair));
   c.sources.push({sightingId:s.id,mapHypothesisProvenance:clone(mapProvenance),mapCompatibility:clone(mapCompatibility),sourcePTS:s.sourcePTS??null,frameKey:s.frameKey??null,modelId:alias.modelId,mapIds:clone(plan.mapIds??s.mapCandidates??[]),origins:clone(model.origins??[]),conditionalBodyPrediction:s.conditionalBodyPrediction?{modelId:s.conditionalBodyPrediction.modelId??null,appearanceModelId:s.conditionalBodyPrediction.appearanceModelId??null,bodyModelId:s.conditionalBodyPrediction.bodyModelId??null,agreement:s.conditionalBodyPrediction.agreement??null,pixelErrorReduction:s.conditionalBodyPrediction.bodyFit?.pixelErrorReduction??null,spatialSupportRank:s.conditionalBodyPrediction.bodyFit?.spatialSupportRank??null,identityCertified:false,noEventPossible:true}:null});
  }
  const sightingIds=group.rows.map(r=>r.s.id);
  tracks.push({sightingIds,sourceIdentity:group.sourceIdentity,trackId:group.trackId,firstVisibilityIsBirth:false,independentDrawCertified:false,latentEventCountConditional:1,eventToSightingCalls:{min:'0',max:null}});
  for(const [modelId,c]of [...candidates].sort(([a],[b])=>String(a).localeCompare(String(b)))){
   if(!c.pairs.size)continue;
   singleEvents.push({id:`automatic-body-event-${index}-${encodeURIComponent(modelId)}`,status:'conditional-source-model-evidence',sightingIds,modelId,tableSpeciesAlternatives:[...c.pairs.values()].sort((a,b)=>a.tableId-b.tableId||a.monsterId-b.monsterId),provenance:'Conditional weighted selection of the ROM-body/DINO-agreement model and enc.json-joined predicted species; no-event/error alternatives remain; exact per-frame map/group/table/species alternatives are unioned, scores are not truth and sightings do not establish birth.',sourceEvidence:c.sources,nativeBirthObserved:false,independentDrawCertified:false,observationErrorPossible:true});
  }
 }
 singleEvents.sort((a,b)=>Number(b.sourceEvidence.some(s=>s.conditionalBodyPrediction?.modelId===b.modelId))-Number(a.sourceEvidence.some(s=>s.conditionalBodyPrediction?.modelId===a.modelId)));
 return {nativeBodySupportEvidence:collectNativeTrackingBodySupport(rows),schema:'automatic-tracking-event-evidence-v1',producer:'ROM-body-prediction-singleton-v2',singleEvents,tracks,deferred,chains:[],eventOrderKnown:false,interEventCalls:{min:'1',max:null},interEventGapScope:'Only if distinct latent weighted events exist; both orders remain possible, no draw count inferred from PTS.',eventToObservationCalls:{min:'0',max:null},unknownAlternativeRetained:true,minimumProvenATCalls:0,currentVideoStateRecovered:false,coverage:{eventHypothesesComplete:false,associationEnumerationComplete:false},scope:'Only supported conditional body predictions are scheduled. Other ranks are deferred and retained, not hard-pruned. Each scheduled branch is one conditional latent event boundary. It is not an intersection across tracks and never narrows the no-event/error/current-state universe.'};
}
export function automaticSingletonSearchOptions(tables){return {tables:clone(tables??{}),includeBroadSingletons:false,domain:{kind:'all-output-classes'},budget:{maxInspectedStates:0,maxWallTimeMs:2000,chunkStates:4096}};}
