import {resolveVideoMinimapCandidates} from './video-minimap-candidates.mjs';
// A cached map is a search hypothesis, never a temporal assertion. Every hit
// requires a fresh whole-minimap registration and same-frame player/floor proof.
export class VideoMapContinuity {
 constructor(){this.entry=null;this.stats={probes:0,hits:0,misses:0,nameSearches:0,invalidations:0};}
 reset(){this.entry=null;this.stats.invalidations++;}
 key(input,romSHA256){const f=input.frameEvidence;return f?.sourceId&&romSHA256?JSON.stringify([romSHA256,f.sourceId,input.layout,input.sourceImage.width,input.sourceImage.height]):null;}
 remember(input,evidence,result){const key=this.key(input,evidence.romSHA256);
  if(!key||this.entry&&this.entry.key!==key)this.reset();
  // Failed current observations are never returned as a map. Keep just the last
  // same-session hypothesis dormant, so a visible frame can revalidate it even
  // when its name panel is hidden. A newly located candidate set replaces it.
  if(key&&evidence.maps?.length&&result.located?.length)this.entry={key,evidence,originFrame:evidence.continuity?.originFrame??input.frameEvidence};
 }

 async probe({input,alignment,isCurrent=()=>true}){
  const key=this.key(input,alignment.romSHA256),entry=this.entry;
  if(!key||!entry||key!==entry.key){if(entry)this.reset();return null;}
  this.stats.probes++;
  const selections=new Map(),accepted=[];
  const renderer={compose:(_catalog,path)=>{if(alignment.referenceCache.cache.has(path))alignment.imageHits++;else alignment.imageMisses++;return alignment.referenceCache.image(path,2097152);}};
  for(const candidate of entry.evidence.maps){
   if(!isCurrent())throw new DOMException('Map continuity cancelled','AbortError');
   const record=alignment.records.find(r=>r.key===candidate.key);if(!record)continue;
   try{const scene=alignment.scene(record),selection=await resolveVideoMinimapCandidates({record,catalog:alignment.catalog,renderer,matcher:alignment.matcher,floors:scene.floors,...input,isCurrent});selections.set(record.key,selection);if(selection.accepted.length)accepted.push(selection);}
   catch(error){if(error.name==='AbortError')throw error;this.stats.misses++;return null;}
  }
  if(!isCurrent())throw new DOMException('Map continuity cancelled','AbortError');
  // Multiple surviving records or non-equivalent references need fresh name
  // evidence. Descriptor aliases in the sole equivalent group stay intact.
  if(accepted.length!==1||!accepted[0].chosen){this.stats.misses++;return null;}
  this.stats.hits++;
  const evidence={...entry.evidence,kind:'known-ROM-map-template-candidates',frameEvidence:entry.originFrame,templateFrameEvidence:input.frameEvidence,scope:'Prior name candidates are retained only after fresh same-frame full-minimap registration, calibrated marker and floor checks. Name evidence belongs to originFrame; other map identities remain unsearched and no identity is certified.',status:'known-map-template-revalidated',continuity:{kind:'same-frame-known-minimap-revalidation',originFrame:entry.originFrame,currentFrame:input.frameEvidence,aliases:accepted[0].diagnostics.equivalentGroups,stats:{...this.stats},nameEvidenceReused:true,nameReadOnCurrentFrame:false,unsearchedMapsPossible:true,mapIdentityCertified:false,minimumProvenATCalls:0}};
  return{evidence,prevalidatedMaps:{frameId:input.frameId,sourceImage:input.sourceImage,selections}};
 }
}
