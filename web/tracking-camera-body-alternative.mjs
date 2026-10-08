// Automatic hypothetical AT branch producer for video/ROM camera-body alternatives.
// It appends conditional singleton alternatives; it never changes a legacy
// prediction, claims a birth, intersects tracks or removes the unknown branch.
import {collectTrackingSightings} from './tracking-at-event-evidence.mjs?v=route-poses-20261008-d98f497f';
import {encounterModelCandidates} from './map-browser-preview/encounter-model-candidates.mjs';
const need=(v,m)=>{if(!v)throw Error(m);},clone=v=>structuredClone(v);
function sameFrame(alternative,provenance,sighting){const a=alternative?.frame,p=provenance?.frame;return a&&p&&a.romSHA256===p.romSHA256&&a.fullRGBA_SHA256===p.fullRGBA_SHA256&&a.sourceId===p.sourceId&&a.sourceEpoch===p.sourceEpoch&&a.timelineSegment===p.timelineSegment&&a.mediaTime===p.sourcePTS&&p.sourcePTS===sighting.sourcePTS&&p.frameKey===sighting.frameKey;}
export function deriveCameraBodySingletonAlternatives(bundle,{alternatives}){
 need(Array.isArray(alternatives)&&new Set(alternatives.map(a=>a.sightingId)).size===alternatives.length,'Distinct exact-sighting camera alternatives required');
 const {rows,groups}=collectTrackingSightings(bundle),known=new Set(rows.map(r=>r.s.id));need(alternatives.every(a=>known.has(a.sightingId)),'Camera alternative refers to an unknown sighting');
 const bySighting=new Map(alternatives.map(a=>[a.sightingId,a.comparison])),singleEvents=[],deferred=[],bindings=[];
 for(const group of groups){const models=new Map();for(const {s,plan,mapProvenance}of group.rows){const a=bySighting.get(s.id);if(!a)continue;const fail=reason=>deferred.push({sightingId:s.id,reason,comparisonKind:a?.kind??null,noEventPossible:true,unknownAlternativeRetained:true});
   if(a.kind!=='conditional-camera-body-alternative-v1'||typeof a.supportedModelId!=='string'||a.identityCertified!==false||a.noEventPossible!==true||a.minimumProvenATCalls!==0||!sameFrame(a,mapProvenance,s)){fail('Camera comparison has no same-frame provisional source-model alternative');continue;}
   const expected=mapProvenance.survivingBackgroundCandidates??[],actual=a.branches??[];
   if(!expected.length||actual.length!==expected.length||new Set(actual.map(b=>b.branchId)).size!==actual.length||expected.some(e=>!actual.some(b=>b.branchId===e.branchId&&b.recordKey===e.recordKey&&b.status==='conditional-tested-body-preference'&&b.bestTestedModelId===a.supportedModelId))){fail('Exact all-retained camera/map branch agreement is unavailable');continue;}
   const alias=s.modelAliases?.find(m=>m.modelId===a.supportedModelId),species=a.speciesCandidates;
   if(!alias||!Array.isArray(species)||!species.length||species.some(x=>!alias.speciesCandidates?.some(y=>y.monsterId===x.monsterId))){fail('Camera alternative species are not this sighting’s source-model aliases');continue;}
   const branchPairs=expected.map(b=>({branchId:b.branchId,recordKey:b.recordKey,mapId:b.mapId,...encounterModelCandidates(plan,a.supportedModelId,{mapId:b.mapId,speciesCandidates:species})}));
   if(branchPairs.some(b=>!b.tableSpeciesAlternatives.length||b.unresolvedOrigins.length)){fail('A retained camera branch lacks exact enc table/species provenance');continue;}
   if(!models.has(a.supportedModelId))models.set(a.supportedModelId,{sightingIds:[],pairs:new Map(),sources:[]});const model=models.get(a.supportedModelId);model.sightingIds.push(s.id);
   for(const b of branchPairs)for(const pair of b.tableSpeciesAlternatives)model.pairs.set(`${pair.tableId}/${pair.monsterId}`,clone(pair));
   model.sources.push({sightingId:s.id,frameKey:s.frameKey,sourcePTS:s.sourcePTS,modelId:a.supportedModelId,mapHypothesisProvenance:clone(mapProvenance),cameraBodyAlternative:clone(a),branchSpecificEncounterAlternatives:clone(branchPairs),legacyPredictionUsed:false,identityCertified:false,noEventPossible:true});
  }
  for(const[modelId,model]of models){const representative=group.rows[0].s.id,id='camera-body-alternative:'+encodeURIComponent(representative)+':'+encodeURIComponent(modelId);singleEvents.push({id,status:'conditional-source-model-evidence',sightingIds:model.sightingIds.slice(),modelId,tableSpeciesAlternatives:[...model.pairs.values()].sort((a,b)=>a.tableId-b.tableId||a.monsterId-b.monsterId),sourceEvidence:model.sources,provenance:'Separate video/ROM camera-conditioned best-tested model alternative, joined to every retained branch’s exact enc table/species pairs. One possible latent selection for this existing tentative track; no-event/error/player/background and unknown current state remain. This is not a replacement for the legacy prediction.',nativeBirthObserved:false,independentDrawCertified:false,observationErrorPossible:true,minimumProvenATCalls:0,noEventPossible:true});bindings.push({id,sourceIdentity:clone(group.sourceIdentity),trackId:group.trackId,sightingIds:model.sightingIds.slice(),latentEventCountConditional:1,repeatedSightingsCreateIndependentDraws:false});}
 }
 return{schema:'camera-body-singleton-alternatives-v1',singleEvents,deferred,bindings,chains:[],legacyPredictionsChanged:false,eventOrderKnown:false,independentDrawsCertified:0,minimumProvenATCalls:0,unknownAlternativeRetained:true,currentVideoStateRecovered:false,certifiedObservation:false,conditionalHypothesisOnly:true,scope:'Automatically scheduled separate conditional singleton hypotheses; never a hard/current-state constraint. Append to existing singleEvents; never replace them or the compiler’s no-event unknown branch. Shared tentative tracks coalesce; source predicates are unioned, not intersected.'};
}
export function appendCameraBodySingletonAlternatives(existing,addition){
 need(Array.isArray(existing)&&addition?.schema==='camera-body-singleton-alternatives-v1'&&addition.unknownAlternativeRetained===true&&addition.minimumProvenATCalls===0,'Existing singleton list and explicit alternative bundle required');
 const output=clone(existing),byId=new Map(output.map(e=>[e.id,e]));need(byId.size===output.length,'Duplicate existing singleton IDs');
 for(const event of addition.singleEvents){if(byId.has(event.id)){need(JSON.stringify(byId.get(event.id))===JSON.stringify(event),'Conflicting repeated camera alternative');continue;}const owned=clone(event);output.push(owned);byId.set(owned.id,owned);}
 return output;
}
