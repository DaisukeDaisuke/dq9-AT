import {resolveVideoMinimapCandidates} from './video-minimap-candidates.mjs?v=capture-gate-reseed-20261006-0850';
// A cached map is a search hypothesis, never a temporal assertion. Every hit
// requires fresh whole-minimap registration and physical-marker/floor hypotheses or fixed-display-anchor evidence.
export class VideoMapContinuity {
 constructor(){this.entry=null;this.stats={probes:0,hits:0,misses:0,nameSearches:0,invalidations:0};}
 reset(){this.entry=null;this.stats.invalidations++;}
 key(input,romSHA256){const f=input.frameEvidence;return f?.sourceId&&romSHA256?JSON.stringify([romSHA256,f.sourceId,f.sourceEpoch??null,input.layout,input.sourceImage.width,input.sourceImage.height]):null;}
 remember(input,evidence,result){const key=this.key(input,evidence.romSHA256);
  if(!key||this.entry&&this.entry.key!==key)this.reset();
  // Failed current observations are never returned as a map. Keep just the last
  // same-session hypothesis dormant, so a visible frame can revalidate it even
  // when its name panel is hidden. A newly located or anchor-observed candidate set replaces it.
  if(key&&evidence.maps?.length&&(result.located?.length||result.unlocated?.length))this.entry={key,evidence,originFrame:evidence.continuity?.originFrame??input.frameEvidence};
 }

 async probe({input,alignment,isCurrent=()=>true}){
  if(!isCurrent())throw new DOMException('Map continuity cancelled','AbortError');
  const key=this.key(input,alignment.romSHA256),entry=this.entry;
  if(!key||!entry||key!==entry.key){if(entry)this.reset();return null;}
  this.stats.probes++;
  const selections=new Map(),accepted=[],revalidatedMaps=[];
  const renderer={compose:(_catalog,path)=>{if(alignment.referenceCache.cache.has(path))alignment.imageHits++;else alignment.imageMisses++;return alignment.referenceCache.image(path,2097152);}};
  for(const candidate of entry.evidence.maps){
   if(!isCurrent())throw new DOMException('Map continuity cancelled','AbortError');
   const record=alignment.records.find(r=>r.key===candidate.key);if(!record){revalidatedMaps.push({recordKey:candidate.key,status:'unknown',unsupported:'ROM record unavailable'});continue;}
   try{const scene=alignment.scene(record),selection=await resolveVideoMinimapCandidates({record,catalog:alignment.catalog,renderer,matcher:alignment.matcher,floors:scene.floors,...input,isCurrent});selections.set(record.key,selection);const survived=Boolean(selection.accepted.length||selection.anchorOnly?.length||selection.physicalMarkerHypotheses?.length);revalidatedMaps.push({recordKey:record.key,mapId:record.mapId,status:survived?'surviving-map-hypothesis':'no-accepted-map-hypothesis',diagnostics:selection.diagnostics});if(survived)accepted.push(selection);}
   catch(error){if(error.name==='AbortError')throw error;revalidatedMaps.push({recordKey:record.key,mapId:record.mapId,status:'unknown',unsupported:error.message});}
  }
  if(!isCurrent())throw new DOMException('Map continuity cancelled','AbortError');
  // Fixed-display-anchor maps remain surviving map alternatives even without
  // actor XZ. They cannot silently make a physical-coordinate alias unique.
  // Reuse is only a bounded search hypothesis: all prior candidates (including
  // failed/unknown alternatives) and every non-equivalent reference stay intact.
  // No chosen physical record or unique map identity is required.
  if(!accepted.length){this.stats.misses++;return null;}
  this.stats.hits++;
  const evidence={...entry.evidence,kind:'known-ROM-map-template-candidates',frameEvidence:entry.originFrame,templateFrameEvidence:input.frameEvidence,scope:'The full prior name-candidate set is reused when at least one candidate passes fresh same-frame full-minimap registration and physical marker/floor hypothesis or fixed-display-anchor checks; each current failure or unknown remains explicit. Name evidence belongs to originFrame; other map identities remain unsearched and no identity is certified.',status:'known-map-template-revalidated',continuity:{kind:'same-frame-known-minimap-revalidation',originFrame:entry.originFrame,currentFrame:input.frameEvidence,aliases:accepted.length===1?accepted[0].diagnostics?.equivalentGroups??[]:[],revalidatedMaps,survivingRecordKeys:revalidatedMaps.filter(r=>r.status==='surviving-map-hypothesis').map(r=>r.recordKey),candidateSetPreserved:true,stats:{...this.stats},nameEvidenceReused:true,nameReadOnCurrentFrame:false,unsearchedMapsPossible:true,mapIdentityCertified:false,minimumProvenATCalls:0}};
  return{evidence,prevalidatedMaps:{frameId:input.frameId,sourceImage:input.sourceImage,selections}};
 }
}
