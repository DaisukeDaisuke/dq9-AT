import {MapPositionMatcher} from './map-position.mjs';
const normalizeName=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'');
/** Only returned Akinator paths/character alternatives nominate names. No fuzzy search. */
export function mapCandidatesFromAkinator(result,records){
 if(result?.route!=='glyph-akinator')return {mapIds:[],names:[],provenance:[],reason:'font-akinator-result-required',normalization:'NFKC + remove whitespace only'};
 const names=new Map();for(const r of records){const name=normalizeName(r.name);if(!names.has(name))names.set(name,[]);names.get(name).push(r);}
 const provenance=[],seen=new Set();const add=(text,source,details)=>{const normalized=normalizeName(text);if(!normalized||!names.has(normalized))return;const key=source+':'+normalized;if(seen.has(key))return;seen.add(key);provenance.push({source,text,normalized,mapIds:[...new Set(names.get(normalized).map(r=>r.mapId))],...details});};
 add(result.sequence,'akinator-selected-sequence',{textResolved:!!result.textResolved,complete:!!result.complete,reason:result.reason});
 for(const [i,h]of(result.hypotheses||[]).entries())add(h.sequence,'akinator-sequence-hypothesis',{hypothesis:i,fontId:h.fontId,threshold:h.threshold,complete:h.complete,reconstructionDifference:h.reconstructionDifference});
 const positions=(result.characters||[]).map(c=>new Set((c.alternatives||[]).map(a=>normalizeName(a.char))));
 if(positions.length)for(const [name]of names){const chars=[...name];if(chars.length===positions.length&&chars.every((c,i)=>positions[i].has(c)))add(name,'akinator-character-alternative-path',{positions:positions.length,combinationObservedAsSequence:false,characters:chars.map((char,index)=>({index,char,alternatives:(result.characters[index].alternatives||[]).filter(a=>normalizeName(a.char)===char).map(a=>({char:a.char,fontId:a.fontId,glyphIndex:a.glyphIndex,scale:a.scale,difference:a.difference}))}))});}
 return {mapIds:[...new Set(provenance.flatMap(p=>p.mapIds))],names:[...new Set(provenance.map(p=>p.normalized))],provenance,reason:provenance.length?'font-candidate-name-join':'no-exact-name-for-font-candidates',normalization:'NFKC + remove whitespace only',fontTextResolved:!!result.textResolved,confidenceCalibrated:false,...(result.cpuOneFrame?{textBackend:'cpu-reference',unsearchedTextPossible:true}: {})};
}
export function planCandidateReferences(project,mapIds,{maxMapIds=16,maxReferences=8}={}){
 const ids=[...new Set(mapIds.filter(Number.isInteger))],groups=new Map(),unknown=[];
 for(const [i,mapId]of ids.entries()){
  if(i>=maxMapIds){unknown.push({mapId,reason:'map-id-budget'});continue;}
  const records=project.records.filter(r=>r.mapId===mapId),candidates=records.flatMap(r=>r.candidates||[]);
  if(!records.length||!candidates.length){unknown.push({mapId,reason:records.length?'descriptor-unavailable':'map-id-unknown'});continue;}
  for(const c of candidates){if(!groups.has(c.path))groups.set(c.path,{descriptor:c.path,mapIds:[],bindings:[]});const g=groups.get(c.path);if(!g.mapIds.includes(mapId))g.mapIds.push(mapId);g.bindings.push({mapId,relation:c.relation});}
 }
 const references=[...groups.values()];for(const g of references.slice(maxReferences))for(const mapId of g.mapIds)unknown.push({mapId,descriptor:g.descriptor,reason:'reference-budget'});
 return {mapIds:ids,references:references.slice(0,maxReferences),unknown,attemptedAllReferences:references.length<=maxReferences&&ids.length<=maxMapIds};
}
function estimatedPixels(project,path){const d=project.descriptors.get(path);if(!d)return null;const parts=d.placements.map(p=>{const layer=d.layers.find(l=>l.id===p.layerId),a=layer&&project.getAsset(layer.path);return a?.info?{x:p.tileX*8,y:p.tileY*8,w:a.info.width,h:a.info.height}:null;});if(!parts.length||parts.some(p=>!p))return null;return (Math.max(...parts.map(p=>p.x+p.w))-Math.min(...parts.map(p=>p.x)))*(Math.max(...parts.map(p=>p.y+p.h))-Math.min(...parts.map(p=>p.y)));}
export class CandidateMapMatcher {
 constructor(instance,project,renderer){this.project=project;this.renderer=renderer;this.matcher=new MapPositionMatcher(instance);this.cache=new Map();this.cacheBytes=0;}
 clear(){this.cache.clear();this.cacheBytes=0;}
 image(path,maxPixels){if(this.cache.has(path)){const im=this.cache.get(path);if(im.width*im.height>maxPixels)throw Error('reference-pixel-budget');this.cache.delete(path);this.cache.set(path,im);return im;}const estimate=estimatedPixels(this.project,path);if(estimate!==null&&estimate>maxPixels)throw Error('reference-pixel-budget');const im=this.renderer.compose(this.project,path);if(im.width*im.height>maxPixels)throw Error('reference-pixel-budget');while(this.cache.size>=8||this.cacheBytes+im.rgba.byteLength>33554432){const first=this.cache.keys().next().value;if(first===undefined)break;this.cacheBytes-=this.cache.get(first).rgba.byteLength;this.cache.delete(first);}this.cache.set(path,im);this.cacheBytes+=im.rgba.byteLength;return im;}
 match(frame,candidates,{stamp=null,scales=[.5],excluded=[],maxMapIds=16,maxReferences=8,maxPixels=2097152,maxMilliseconds=1200}={}){
  if(!Array.isArray(scales)||!scales.length||scales.length>6||scales.some(s=>!Number.isFinite(s)||s<=0||s>4))throw Error('One to six bounded scale hypotheses required');
  if(frame.width!==128||frame.height!==96||frame.rgba?.length!==128*96*4)throw Error('Bounded 128x96 same-capture frame required');
  maxMapIds=Math.max(1,Math.min(16,Math.floor(maxMapIds)||16));maxReferences=Math.max(1,Math.min(8,Math.floor(maxReferences)||8));maxPixels=Math.max(1,Math.min(2097152,Math.floor(maxPixels)||2097152));maxMilliseconds=Math.max(1,Math.min(5000,Number(maxMilliseconds)||1200));
  const started=performance.now(),plan=planCandidateReferences(this.project,candidates.mapIds||[],{maxMapIds,maxReferences}),rankings=[],unknown=[...plan.unknown,...(candidates.unsearchedTextPossible===true?[{mapId:null,reason:'unsearched-font-hypotheses'}]:[])];
  for(const g of plan.references){if(performance.now()-started>=maxMilliseconds){unknown.push(...g.mapIds.map(mapId=>({mapId,descriptor:g.descriptor,reason:'time-budget'})));continue;}
   try{const image=this.image(g.descriptor,maxPixels);this.matcher.setReference({...image,mapId:null,descriptor:g.descriptor});let registration=this.matcher.match(frame,{scales,excluded,maxMilliseconds:Math.max(0,maxMilliseconds-(performance.now()-started))});if(!registration.resolved&&!registration.search?.budgetExhausted){const fallback=this.matcher.match(frame,{scales,excluded,coarseSeeds:24,maxMilliseconds:Math.max(0,maxMilliseconds-(performance.now()-started))});registration={...(fallback.search?.budgetExhausted&&(registration.best?.score??-Infinity)>(fallback.best?.score??-Infinity)?registration:fallback),resolved:fallback.resolved,search:fallback.search,fallback:{reason:'initial-registration-ambiguous',initialBest:registration.best??null,initialCandidates:registration.candidates,initialSearch:registration.search}};}if(registration.search?.budgetExhausted)unknown.push(...g.mapIds.map(mapId=>({mapId,descriptor:g.descriptor,reason:'registration-time-budget'})));rankings.push({...g,imageWidth:image.width,imageHeight:image.height,originPixel:image.originPixel,worldToMapScale:image.descriptor?.worldToMapScale??null,registration,bestScore:registration.best?.score??null,status:registration.best?'evaluated':'insufficient-image-overlap'});if(!registration.best)unknown.push(...g.mapIds.map(mapId=>({mapId,descriptor:g.descriptor,reason:'insufficient-image-overlap'})));}
   catch(error){unknown.push(...g.mapIds.map(mapId=>({mapId,descriptor:g.descriptor,reason:error.message})));}
  }
  // Finish the inexpensive passes for every nominated reference first. Only
  // unresolved references spend the remaining shared deadline on a denser grid.
  for(const r of rankings){
   if(r.registration.resolved||r.registration.search?.budgetExhausted)continue;
   const remaining=maxMilliseconds-(performance.now()-started);
   if(remaining<=0){unknown.push(...r.mapIds.map(mapId=>({mapId,descriptor:r.descriptor,reason:'registration-dense-fallback-time-budget'})));continue;}
   try{
    const image=this.image(r.descriptor,maxPixels);this.matcher.setReference({...image,mapId:null,descriptor:r.descriptor});
    const prior=r.registration,dense=this.matcher.match(frame,{scales,excluded,denseTranslation:true,maxMilliseconds:remaining});
    r.registration={...(dense.search?.budgetExhausted&&(prior.best?.score??-Infinity)>(dense.best?.score??-Infinity)?prior:dense),resolved:dense.resolved,search:dense.search,fallback:{reason:'coarse-registration-unresolved',initialBest:prior.best??null,initialCandidates:prior.candidates,initialSearch:prior.search}};
    r.bestScore=r.registration.best?.score??null;r.status=r.registration.best?'evaluated':'insufficient-image-overlap';
    if(dense.search?.budgetExhausted)unknown.push(...r.mapIds.map(mapId=>({mapId,descriptor:r.descriptor,reason:'registration-dense-fallback-'+(dense.search.budgetReason||'time-budget')})));
   }catch(error){unknown.push(...r.mapIds.map(mapId=>({mapId,descriptor:r.descriptor,reason:error.message})));}
  }
  rankings.sort((a,b)=>(b.bestScore??-Infinity)-(a.bestScore??-Infinity));const best=rankings[0],next=rankings[1],margin=best?.bestScore!=null&&next?.bestScore!=null?best.bestScore-next.bestScore:null;
  const descriptorCandidate=!!best?.registration.resolved&&(next?margin>=.08:true),allCandidatesEvaluated=unknown.length===0,resolvedMapId=descriptorCandidate&&allCandidatesEvaluated&&best.mapIds.length===1?best.mapIds[0]:null;
  return {kind:'video-map-disambiguation',stamp:structuredClone(stamp),candidateSource:structuredClone(candidates),requestedMapIds:plan.mapIds,rankings,unknown,bestDescriptor:best?.descriptor??null,bestMapIds:best?.mapIds??[],crossReferenceMargin:margin,descriptorCandidate,resolvedMapId,allCandidatesEvaluated,registrationSearch:{translationDomainComplete:false,planComplete:unknown.length===0&&rankings.every(g=>g.registration.search?.planComplete),method:'coarse seeds6/24 for all references; unresolved references retry a bounded dense grid within the same deadline'},mapIdentityResolved:resolvedMapId!==null,reason:!plan.mapIds.length?'no-font-map-candidates':!rankings.length?'references-unavailable':!descriptorCandidate?'image-match-ambiguous':unknown.length?'unsearched-candidates-retained':best.mapIds.length>1?'shared-reference-map-aliases':'single-map-image-candidate',elapsedMilliseconds:performance.now()-started,confidenceCalibrated:false,worldPositionKnown:false,minimumProvenATCalls:0,automaticATConsumption:false};
 }
}
