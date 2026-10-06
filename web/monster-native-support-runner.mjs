import{nativeBodyExtentEvidence}from'./monster-native-extent-evidence.mjs?v=enc-motion-at-20261006-1156';
// Optional bounded worker-side source-native evaluator. No production caller.
import{readMonsterAssets}from'./monster-assets.mjs';
import{readNSBCA}from'./monster-animation.mjs?v=stored-pivot-source-20261006-0800';
import{prepareNativeBodyEnvelope,placeNativeBodyEnvelopeOnFloors}from'./monster-native-body-placement.mjs?v=enc-motion-at-20261006-1156';
import{readSdkInitialMaterialGlobals}from'./map-browser-preview/rom-sdk-initial-material.mjs';
import{readInitialMode1RasterProfile}from'./map-browser-preview/integer/initial-mode1-integer-preview.mjs?v=automatic-playback-source-cache-20261006-1100';
import{prepareNativeBodyProgram,projectNativeBodyPolygons,rasterNativeBody}from'./monster-native-body.mjs?v=enc-motion-at-20261006-1156';
import{createNativeBodyBillboardState}from'./monster-native-billboard.mjs?v=native-body-20261006-0212';
import{bindFrozenBodyProjection}from'./monster-perspective-input.mjs?v=native-body-20261006-0212';
import{comparePerspectiveBody}from'./monster-perspective-body.mjs?v=native-body-20261006-0212';
const need=(v,m)=>{if(!v)throw Error(m);},clone=v=>structuredClone(v),pause=()=>new Promise(r=>setTimeout(r,0));
const frameKey=f=>JSON.stringify(['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'].map(k=>f?.[k]));
/** Bind this cache to one already verified ROM/project/catalog epoch. Destroy it
 * on any source/revision change. It contains only source programs/animations,
 * never pixels, fits or identity decisions. A separately bounded LRU retains
 * private emitted-envelope seeds, keyed by every projection input. These
 * source geometry seeds carry no frame scores, region or floor decisions. */
export function createNativeBodySupportRunner({project,rom,catalog,romSHA256,maxCacheBytes,maxPrograms}){
 need(project?.sdk&&project?.nfs&&rom instanceof Uint8Array&&catalog&&/^[a-f0-9]{64}$/.test(romSHA256),'Explicit verified ROM/project/catalog required');need(Number.isSafeInteger(maxCacheBytes)&&maxCacheBytes>0&&Number.isSafeInteger(maxPrograms)&&maxPrograms>0,'Explicit source preparation cache bounds required');
 const cache=new Map(),envelopeSeeds=new Map(),materialGlobals=readSdkInitialMaterialGlobals(project.sdk),profile=readInitialMode1RasterProfile(project,rom);let bytes=0,envelopeBytes=0,disposed=false,hits=0,misses=0,envelopeHits=0,envelopeMisses=0,envelopeEvictions=0;
 function prepared(c){const key=JSON.stringify([c.modelId,c.variant]);if(cache.has(key)){const x=cache.get(key);cache.delete(key);cache.set(key,x);hits++;return x;}misses++;const asset=readMonsterAssets(project.nfs,catalog,[{modelId:c.modelId,variant:c.variant}]).models[0],program=prepareNativeBodyProgram({asset,sdk:project.sdk,materialGlobals,allowTexturedTranslucent:true}),size=asset.model.bytes.byteLength+asset.animations.reduce((n,a)=>n+a.bytes.byteLength,0)+program.materials.reduce((n,m)=>n+(m.texture?.rgba6665.byteLength??0)+(m.texture?.alpha5.byteLength??0),0)+program.nodes.count*512+program.sbc.commands.length*128+program.shapes.reduce((n,s)=>n+s.gx.commands.length*128,0),value={asset,program,animations:new Map(),size};
  need(size<=maxCacheBytes,'Source preparation exceeds explicit worker cache budget');while(cache.size>=maxPrograms||bytes+size>maxCacheBytes){const k=cache.keys().next().value;bytes-=cache.get(k).size;cache.delete(k);}cache.set(key,value);bytes+=size;return value;
 }
 function sourceAnimation(source,pose){if(pose.clip==='bind')return null;if(!source.animations.has(pose.clip)){const a=source.asset.animations.find(a=>a.name===pose.clip);need(a,'Named source clip absent');source.animations.set(pose.clip,readNSBCA(a.bytes));}return source.animations.get(pose.clip);}
 // Cache only the exact region-independent source replay, never placements.
 // Non-JSON values are ineligible rather than colliding with null/undefined.
 function envelopeSeed(source,request,bound,animation){
  const p=request.pose,b=request.billboardProfile,cacheable=Number.isInteger(p.actorScaleFx)&&Number.isInteger(p.yawFx)&&(p.frame===null||Number.isInteger(p.frame))&&(!source.program.billboardSource||(b?.kind==='conditional-ordinary-ROM-initial-templates'&&Number.isInteger(b.globalFlags)&&Number.isInteger(b.contextFlags)&&b.callbackOverride===false));
  const key=cacheable?JSON.stringify([request.candidate.modelId,request.candidate.variant,p.clip,p.frame,p.actorScaleFx,p.yawFx,bound.camera.viewFx,bound.camera.projectionFx,bound.alignment.dx,bound.alignment.dy,source.program.billboardSource?[b.kind,b.globalFlags,b.contextFlags,b.callbackOverride]:null]):null;
  let value=key===null?null:envelopeSeeds.get(key);
  if(value){envelopeSeeds.delete(key);envelopeSeeds.set(key,value);envelopeHits++;}
  else{envelopeMisses++;const envelope=prepareNativeBodyEnvelope(source.program,{camera:bound.camera,alignment:bound.alignment,actorScaleFx:p.actorScaleFx,yawFx:p.yawFx,animation,frame:p.frame,billboardProfile:b});
   // Source programs/animations remain solely in their original bounded cache.
   envelope.program=null;envelope.nativeInput.animation=null;envelope.billboardProfile=null;
   const size=4096+envelope.seedVertices.length*768+(key?.length??0)*2;value={envelope,size};
   // Oversized valid seeds still run, but are never admitted to this LRU.
   if(key!==null&&size<=maxCacheBytes){while(envelopeSeeds.size>=maxPrograms||envelopeBytes+size>maxCacheBytes){const oldest=envelopeSeeds.keys().next().value;envelopeBytes-=envelopeSeeds.get(oldest).size;envelopeSeeds.delete(oldest);envelopeEvictions++;}envelopeSeeds.set(key,value);envelopeBytes+=size;}
  }
  // Each job owns a mutable copy, so outside state mutation cannot poison the LRU.
  const e=value.envelope;return {...e,nativeInput:{...e.nativeInput,camera:bound.camera},alignment:{...bound.alignment},billboardProfile:b,geometrySource:clone(e.geometrySource),seedVertices:e.seedVertices.map(v=>({clipBase:v.clipBase.slice(),clipResponse:v.clipResponse.map(r=>r.slice())}))};
 }
 // This continuation is private to one retained frozen request. The source
 // program/animation cache is the same one used by evaluate, never a new cache.
 function proposeNativeEnvelope(request,{state=null,signal,getCurrentFrame,shouldYield}={}){
  need(typeof getCurrentFrame==='function'&&typeof shouldYield==='function','Frozen-frame guard and current slice budget required');
  const key=frameKey(request.frame),guard=()=>{if(disposed||signal?.aborted||frameKey(getCurrentFrame())!==key)throw new DOMException('Source-native envelope cancelled or stale','AbortError');};guard();
  need(request.frame?.romSHA256===romSHA256,'Envelope ROM differs from source runner');
  if(state)need(state.request===request,'Envelope continuation belongs to another frozen request');
  const bound=bindFrozenBodyProjection(request);state??={request,envelope:null,planeIndex:0,completedSteps:0};
  const result={state,placements:[],unresolved:[],complete:false,completedSteps:state.completedSteps};
  if(shouldYield())return result;
  if(!state.envelope){const source=prepared(request.candidate),animation=sourceAnimation(source,request.pose);guard();if(shouldYield())return result;
   state.envelope=envelopeSeed(source,request,bound,animation);
   state.completedSteps++;guard();result.completedSteps=state.completedSteps;if(shouldYield())return result;
  }
  // Advance through non-intersecting planes until one proposal is available.
  // A plane cursor survives budget yields. Fairness remains one render proposal
  // per visit rather than charging every empty floor as a rendered proposal.
  // Preparation and each floor solve are cooperative indivisible segments.
  const source=prepared(request.candidate),animation=sourceAnimation(source,request.pose),envelope={...state.envelope,program:source.program,nativeInput:{...state.envelope.nativeInput,animation}};
  while(state.planeIndex<request.floorPlan.planes.length&&!shouldYield()){guard();const floorPlan={...request.floorPlan,planes:[request.floorPlan.planes[state.planeIndex]]},placed=placeNativeBodyEnvelopeOnFloors(envelope,request.region,floorPlan);state.planeIndex++;state.completedSteps++;guard();result.placements.push(...placed.placements);result.unresolved.push(...placed.unresolved);if(result.placements.length)break;}
  result.completedSteps=state.completedSteps;result.complete=state.planeIndex===request.floorPlan.planes.length;return result;
 }
 return{proposeNativeEnvelope,dispose(){cache.clear();envelopeSeeds.clear();bytes=envelopeBytes=0;disposed=true;},get stats(){return{entries:cache.size,estimatedBytes:bytes,maxCacheBytes,maxPrograms,hits,misses,disposed,envelopeSeeds:{entries:envelopeSeeds.size,estimatedBytes:envelopeBytes,maxCacheBytes,maxEntries:maxPrograms,hits:envelopeHits,misses:envelopeMisses,evictions:envelopeEvictions}};},async evaluate(request,{signal,getCurrentFrame,budget,yieldTask=pause,onProgress=()=>{}}={}){
  need(!disposed,'Source-native runner disposed');need(request?.frame?.romSHA256===romSHA256&&Array.isArray(request.candidates)&&Array.isArray(request.branches)&&request.branches.length>0,'Source-native request identity/candidates/branches required');need(Number.isFinite(budget?.wallTimeMs)&&budget.wallTimeMs>0&&Number.isSafeInteger(budget?.maxProposals)&&budget.maxProposals>0,'Explicit per-job time and proposal bounds required');need(typeof getCurrentFrame==='function','Current frozen-frame identity guard required');
  need(new Set(request.candidates.map(c=>c.modelId)).size===request.candidates.length&&new Set(request.branches.map(b=>b.branchId)).size===request.branches.length,'Distinct candidates and background branches required');need(request.videoRGBA?.length===49152*4,'Frozen native video RGBA required');const started=performance.now(),key=frameKey(request.frame),branches=[];let attempts=0,budgetStopped=false;
  const guard=()=>{if(disposed||signal?.aborted||frameKey(getCurrentFrame())!==key)throw new DOMException('Source-native body job cancelled or stale','AbortError');};
  guard();for(const branch of request.branches){const bound=bindFrozenBodyProjection({frame:request.frame,cameraFrame:branch.frame,camera:branch.camera,alignment:branch.alignment,sourceFloorFrame:branch.sourceFloorFrame});if(branch.fog)need(['same-frame-source-mode2-actor-fog','same-frame-source-mode1-actor-fog'].includes(branch.fog.snapshot?.kind)&&frameKey(branch.fog.snapshot.frame)===key,'Actor fog differs from frozen frame');need(branch.backgroundRGBA?.length===49152*4&&branch.validMask?.length===49152&&branch.assumptions&&Array.isArray(branch.unknownAlternatives),'Branch pixels, valid mask and assumptions required');const output={branchId:branch.branchId,assumptions:clone(branch.assumptions),unknownAlternatives:clone(branch.unknownAlternatives),candidates:[]};branches.push(output);
   for(const candidate of request.candidates){guard();const result={modelId:candidate.modelId,variant:candidate.variant,testedProposals:0,best:null,unsupported:[]};output.candidates.push(result);const proposals=branch.proposalsByModel?.[candidate.modelId];if(!Array.isArray(proposals)){result.unsupported.push({reason:'Source placement proposals unavailable for this candidate/branch'});continue;}
    if(attempts>=budget.maxProposals||performance.now()-started>=budget.wallTimeMs)budgetStopped=true;if(budgetStopped){result.unsupported.push({reason:'Not evaluated: explicit worker job budget exhausted',remainingProposals:proposals.length});continue;}let source;try{source=prepared(candidate);}catch(error){result.unsupported.push({scope:'source-program',reason:error.message});continue;}
    for(let i=0;i<proposals.length;i++){guard();if(attempts>=budget.maxProposals||performance.now()-started>=budget.wallTimeMs){budgetStopped=true;result.unsupported.push({reason:'Not evaluated: explicit worker job budget exhausted',remainingProposals:proposals.length-i});break;}const p=proposals[i];attempts++;
     try{const pose=p.pose,animation=sourceAnimation(source,pose);let billboardState=null;if(source.program.billboardSource){need(branch.billboardProfile?.kind==='conditional-ordinary-ROM-initial-templates','Explicit conditional billboard context unavailable');billboardState=createNativeBodyBillboardState(source.program.billboardSource,{...branch.billboardProfile,templates:source.program.billboardSource.initialTemplates});}
      let destination=null;if(source.program.materials.some(m=>m.texture?.translucent)&&typeof branch.getBodyDestination==='function'){destination=await branch.getBodyDestination({assertCurrent:guard,shouldYield:()=>performance.now()-started>=budget.wallTimeMs,yieldTask,onSegment:segment=>{if(Number.isSafeInteger(segment.completedSteps))result.preparationCompletedSteps=Math.max(result.preparationCompletedSteps??0,segment.completedSteps);}});guard();if(destination?.kind==='native-body-destination-pending'){need(Number.isSafeInteger(destination.completedSteps)&&destination.completedSteps>=0,'Destination progress is invalid');result.preparationCompletedSteps=Math.max(result.preparationCompletedSteps??0,destination.completedSteps);result.preparationPending=clone(destination);budgetStopped=true;break;}if(performance.now()-started>=budget.wallTimeMs){budgetStopped=true;break;}need(destination?.binding?.kind==='same-frozen-source-destination-v1'&&frameKey(destination.binding.frame)===key,'Scene destination differs from frozen frame');}
      const projected=projectNativeBodyPolygons(source.program,{camera:bound.camera,positionFx:p.positionFx,actorScaleFx:pose.actorScaleFx,yawFx:pose.yawFx,animation,frame:pose.frame,billboardState}),rendered=rasterNativeBody(source.program,projected,{profile,fog:branch.fog??null,alignment:bound.alignment,destination});if(!rendered.ready){result.unsupported.push({proposalId:p.id,reason:rendered.reason,errors:rendered.errors,unsupportedDestination:rendered.unsupportedDestination,...(rendered.stats?{sceneCompositionStats:rendered.stats}:{})});}
      else{const fit=comparePerspectiveBody(rendered,{videoRGBA:request.videoRGBA,backgroundRGBA:branch.backgroundRGBA,validMask:branch.validMask,region:request.region}),row={proposalId:p.id,pose:clone(pose),positionFx:p.positionFx.slice(),fit:{...fit,bodyMaskRuns:undefined},nativeBodyExtent:nativeBodyExtentEvidence({projected,rendered,alignment:bound.alignment,comparisonValidMask:branch.validMask,frame:request.frame}),...(destination?{sceneComposition:{sourceAcceptedSubset:rendered.sourceAcceptedSubset,stats:rendered.stats,binding:clone(destination.binding),sourceOrder:clone(destination.sourceOrder),partialBodyNotScored:false}}:{})};result.testedProposals++;if(!result.best||fit.pixelErrorReduction>result.best.fit.pixelErrorReduction)result.best=row;}
     }catch(error){if(error.name==='AbortError')throw error;result.unsupported.push({proposalId:p.id,reason:error.message});}await yieldTask();guard();
    }onProgress({branchId:branch.branchId,modelId:candidate.modelId,attempts,budgetStopped,elapsedMs:performance.now()-started});
   }
  }guard();return{kind:'per-candidate-source-native-body-support',renderer:'source-integer-original-GX-body-subset',frame:clone(request.frame),branches,attempts,budgetStopped,elapsedMs:performance.now()-started,complete:false,identityCertified:false,noEventPossible:true,minimumProvenATCalls:0};
 }};
}
