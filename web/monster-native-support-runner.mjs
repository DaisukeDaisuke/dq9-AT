import{verifyNativeDrawAnimationSource,nativeDrawAnimationTerms,bindNativeDrawAnimationTerms}from'./monster-native-draw-animation.mjs?v=conditional-draw-links-20261007-0847';
import{originalComponentMaskSHA256}from'./original-component-mask-binding.mjs?v=shrine-beam-20261008-a9738d0c';
import{sourcePixelComparisonBinding}from'./native-pixel-comparison-binding.mjs?v=native-scene-link-20261007-0354';
import{verifyNativeAnimationSource,readNativeRate0Animation}from'./monster-native-animation.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import{verifyNativeJointBlendSource}from'./monster-native-joint-blend.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import{createNativeBodyJointPlan}from'./monster-native-joint-plan.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import{nativeBodyExtentEvidence}from'./monster-native-extent-evidence.mjs?v=source-rate1-curves-20261008-2e3ba48d';
// Optional bounded worker-side source-native evaluator. No production caller.
import{readMonsterAssets}from'./monster-assets.mjs';
import{readNSBCA}from'./monster-animation.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import{prepareNativeBodyEnvelope,placeNativeBodyEnvelopeOnFloors}from'./monster-native-body-placement.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import{readSdkInitialMaterialGlobals}from'./map-browser-preview/rom-sdk-initial-material.mjs';
import{readInitialMode1RasterProfile}from'./map-browser-preview/integer/initial-mode1-integer-preview.mjs?v=fair-source-yield-20261007-0247';
import{prepareNativeBodyProgram,projectNativeBodyPolygons,rasterNativeBody}from'./monster-native-body.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import{createNativeBodyBillboardState}from'./monster-native-billboard.mjs?v=native-body-20261006-0212';
import{bindFrozenBodyProjection}from'./monster-perspective-input.mjs?v=native-body-20261006-0212';
import{comparePerspectiveBody}from'./monster-perspective-body.mjs?v=shrine-beam-20261008-a9738d0c';
const need=(v,m)=>{if(!v)throw Error(m);},clone=v=>structuredClone(v),pause=()=>new Promise(r=>setTimeout(r,0));
const frameKey=f=>JSON.stringify(['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'].map(k=>f?.[k]));
/** Bind this cache to one already verified ROM/project/catalog epoch. Destroy it
 * on any source/revision change. It contains only source programs/animations,
 * never pixels, fits or identity decisions. A separately bounded LRU retains
 * private emitted-envelope seeds, keyed by every projection input. These
 * source geometry seeds carry no frame scores, region or floor decisions. */
export function createNativeBodySupportRunner({project,rom,catalog,romSHA256,maxCacheBytes,maxPrograms}){
 need(project?.sdk&&project?.nfs&&rom instanceof Uint8Array&&catalog&&/^[a-f0-9]{64}$/.test(romSHA256),'Explicit verified ROM/project/catalog required');need(Number.isSafeInteger(maxCacheBytes)&&maxCacheBytes>0&&Number.isSafeInteger(maxPrograms)&&maxPrograms>0,'Explicit source preparation cache bounds required');
 const cache=new Map(),envelopeSeeds=new Map(),materialGlobals=readSdkInitialMaterialGlobals(project.sdk),profile=readInitialMode1RasterProfile(project,rom);let bytes=0,envelopeBytes=0,disposed=false,hits=0,misses=0,envelopeHits=0,envelopeMisses=0,envelopeEvictions=0,phaseSourceRules=null,phaseResourcesPrepared=0,drawAnimationSourceRules=null;
 function prepared(c){const key=JSON.stringify([c.modelId,c.variant]);if(cache.has(key)){const x=cache.get(key);cache.delete(key);cache.set(key,x);hits++;return x;}misses++;const asset=readMonsterAssets(project.nfs,catalog,[{modelId:c.modelId,variant:c.variant}]).models[0],program=prepareNativeBodyProgram({asset,sdk:project.sdk,materialGlobals,allowTexturedTranslucent:true}),size=asset.model.bytes.byteLength+asset.animations.reduce((n,a)=>n+a.bytes.byteLength,0)+program.materials.reduce((n,m)=>n+(m.texture?.rgba6665.byteLength??0)+(m.texture?.alpha5.byteLength??0),0)+program.nodes.count*512+program.sbc.commands.length*128+program.shapes.reduce((n,s)=>n+s.gx.commands.length*128,0),value={key,asset,program,animations:new Map(),phaseAnimations:new Map(),size};
  need(size<=maxCacheBytes,'Source preparation exceeds explicit worker cache budget');while(cache.size>=maxPrograms||bytes+size>maxCacheBytes){const k=cache.keys().next().value;bytes-=cache.get(k).size;cache.delete(k);}cache.set(key,value);bytes+=size;return value;
 }
 function sourceAnimation(source,pose){if(pose.clip==='bind')return null;if(!source.animations.has(pose.clip)){const a=source.asset.animations.find(a=>a.name===pose.clip);need(a,'Named source clip absent');source.animations.set(pose.clip,readNSBCA(a.bytes));}return source.animations.get(pose.clip);}
 function phaseRules(){return phaseSourceRules??={animation:verifyNativeAnimationSource(project.sdk),blend:verifyNativeJointBlendSource(project.sdk)};}
 async function phaseAnimation(source,clip,guard){
  if(source.phaseAnimations.has(clip))return source.phaseAnimations.get(clip);
  const resource=source.asset.animations.find(a=>a.name===clip);need(resource,'Named phase source clip absent');const animation=readNativeRate0Animation(resource.bytes,phaseRules().animation),extra=1024+animation.rotations.reduce((n,r)=>n+(r?64+r.refs.length*8:0),0);need(source.size+extra<=maxCacheBytes,'Explicit phase source exceeds bounded preparation cache');
  const digest=await crypto.subtle.digest('SHA-256',resource.bytes);guard();const resourceSHA256=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),entry={animation,resourceSHA256};
  if(cache.get(source.key)===source){while(bytes+extra>maxCacheBytes){const k=[...cache.keys()].find(k=>k!==source.key);need(k!==undefined,'Explicit phase source cache admission unavailable');bytes-=cache.get(k).size;cache.delete(k);}bytes+=extra;source.size+=extra;}
  // Reuse the exact parsed integer arrays rather than retaining a second copy.
  source.animations.set(clip,animation.parsed);source.phaseAnimations.set(clip,entry);phaseResourcesPrepared++;return entry;
 }
 function poseInput(source,pose){
  if(pose.drawAnimationCondition!==undefined){
   need(pose.frame===null&&pose.phaseFx===undefined&&pose.phaseCondition===undefined&&pose.clip===pose.drawAnimationCondition?.current?.clip,'Draw animation condition cannot mix single-clip pose inputs');
   const terms=bindNativeDrawAnimationTerms(drawAnimationSourceRules??=verifyNativeDrawAnimationSource(project.sdk),pose.drawAnimationCondition,source.phaseAnimations);
   return{animation:null,frame:null,jointPlan:createNativeBodyJointPlan(source.program,{sdk:project.sdk,source:phaseRules().blend,terms,defaultCallbackBinding:true})};
  }
  if(pose.phaseFx===undefined)return{animation:sourceAnimation(source,pose),frame:pose.frame};
  const entry=source.phaseAnimations.get(pose.clip),c=pose.phaseCondition;need(entry&&pose.frame===null&&Number.isInteger(pose.phaseFx)&&c?.kind==='conditional-source-native-FX12-phase'&&c.phaseFx===pose.phaseFx&&c.resourceFlags===entry.animation.resourceFlags&&c.resourceSHA256===entry.resourceSHA256&&c.currentPhaseKnown===false&&c.defaultCallbackAssumed===true,'Explicit phase source/condition binding differs');
  return{animation:null,frame:null,jointPlan:createNativeBodyJointPlan(source.program,{sdk:project.sdk,source:phaseRules().blend,terms:[{animation:entry.animation,phaseFx:pose.phaseFx,weightFx:4096}],defaultCallbackBinding:true})};
 }
 // One source clip is an indivisible bounded preparation segment. The caller
 // retains this cursor and every failed clip once; no phase bank is allocated.
 async function prepareNativePhaseDomain(request,{state=null,signal,getCurrentFrame,shouldYield}={}){
  need(typeof getCurrentFrame==='function'&&typeof shouldYield==='function','Frozen phase preparation guard/budget required');const key=frameKey(request.frame),guard=()=>{if(disposed||signal?.aborted||frameKey(getCurrentFrame())!==key)throw new DOMException('Source-native phase cancelled or stale','AbortError');};guard();need(request.frame?.romSHA256===romSHA256&&Array.isArray(request.clips),'Bound source phase clips required');if(state)need(state.request===request,'Phase preparation belongs to another frozen request');state??={request,index:0,clips:[],unsupported:[],completedSteps:0};
  if(state.index<request.clips.length&&!shouldYield()){const condition=request.clips[state.index];try{const source=prepared(request.candidate),entry=await phaseAnimation(source,condition.clip,guard);guard();need(entry.animation.kind==='source-native-rate0-animation-v1','Sparse scale integer expansion does not support the fractional phase domain');state.clips.push({clip:condition.clip,numFrames:entry.animation.parsed.numFrames,resourceFlags:entry.animation.resourceFlags,resourceSHA256:entry.resourceSHA256,...(condition.actionCondition?{actionCondition:clone(condition.actionCondition)}:{})});}catch(error){if(error.name==='AbortError')throw error;state.unsupported.push({clip:condition.clip,reason:error.message,...(condition.actionCondition?{actionCondition:clone(condition.actionCondition)}:{})});}state.index++;state.completedSteps++;}
  return{state,complete:state.index===request.clips.length,completedSteps:state.completedSteps,clips:clone(state.clips),unsupported:clone(state.unsupported)};
 }
 async function preparePoseResources(source,pose,guard){
  if(pose.drawAnimationCondition!==undefined){
   // Validate the whole condition before decoding either clip. The same ordered
   // terms feed envelope replay, final replay and the cache key.
   const terms=nativeDrawAnimationTerms(pose.drawAnimationCondition);
   for(const t of terms){await phaseAnimation(source,t.clip,guard);guard();}
  }else if(pose.phaseFx!==undefined){await phaseAnimation(source,pose.clip,guard);guard();}
 }
 async function proposeNativeDrawAnimationEnvelope(request,options){
  const key=frameKey(request.frame),guard=()=>{if(disposed||options.signal?.aborted||frameKey(options.getCurrentFrame())!==key)throw new DOMException('Source-native draw animation cancelled or stale','AbortError');};guard();
  need(request.pose?.drawAnimationCondition!==undefined,'Explicit conditional draw animation required');
  need(request.frame?.romSHA256===romSHA256,'Draw animation ROM differs from source runner');
  const inputKey=JSON.stringify([frameKey(request.frame),request.candidate,request.pose,request.camera,request.alignment,request.billboardProfile]);
  if(options.state){need(options.state.request===request,'Envelope continuation belongs to another frozen request');need(options.state.drawAnimationInputKey===inputKey,'Draw animation input changed during envelope continuation');}
  need(typeof options.shouldYield==='function','Frozen draw animation preparation budget required');
  const terms=nativeDrawAnimationTerms(request.pose.drawAnimationCondition),state=options.state??{request,envelope:null,planeIndex:0,completedSteps:0,drawAnimationInputKey:inputKey,drawAnimationPreparedClips:[]},source=prepared(request.candidate);
  // Each clip remains its own bounded source preparation segment. Cold-cache
  // rebuilding is charged to wall time but does not replay a served proposal.
  for(const t of terms){if(options.shouldYield())return{state,placements:[],unresolved:[],complete:false,completedSteps:state.completedSteps};await phaseAnimation(source,t.clip,guard);guard();if(!state.drawAnimationPreparedClips.includes(t.clip)){state.drawAnimationPreparedClips.push(t.clip);state.completedSteps++;}}
  return proposeNativeEnvelope(request,{...options,state});
 }
 async function proposeNativePhaseEnvelope(request,options){const key=frameKey(request.frame),guard=()=>{if(disposed||options.signal?.aborted||frameKey(options.getCurrentFrame())!==key)throw new DOMException('Source-native phase cancelled or stale','AbortError');};guard();const source=prepared(request.candidate);await phaseAnimation(source,request.pose.clip,guard);guard();return proposeNativeEnvelope(request,options);}
 // Cache only the exact region-independent source replay, never placements.
 // Non-JSON values are ineligible rather than colliding with null/undefined.
 function envelopeSeed(source,request,bound,nativePose){
  const p=request.pose,b=request.billboardProfile,cacheable=Number.isInteger(p.actorScaleFx)&&Number.isInteger(p.yawFx)&&(p.frame===null||Number.isInteger(p.frame))&&(!source.program.billboardSource||(b?.kind==='conditional-ordinary-ROM-initial-templates'&&Number.isInteger(b.globalFlags)&&Number.isInteger(b.contextFlags)&&b.callbackOverride===false));
  const key=cacheable?JSON.stringify([request.candidate.modelId,request.candidate.variant,p.clip,p.drawAnimationCondition!==undefined?['explicit-draw-links',nativeDrawAnimationTerms(p.drawAnimationCondition)]:p.phaseFx===undefined?p.frame:['explicit-phase',p.phaseFx,p.phaseCondition.resourceFlags,p.phaseCondition.resourceSHA256],p.actorScaleFx,p.yawFx,bound.camera.viewFx,bound.camera.projectionFx,bound.alignment.dx,bound.alignment.dy,source.program.billboardSource?[b.kind,b.globalFlags,b.contextFlags,b.callbackOverride]:null]):null;
  let value=key===null?null:envelopeSeeds.get(key);
  if(value){envelopeSeeds.delete(key);envelopeSeeds.set(key,value);envelopeHits++;}
  else{envelopeMisses++;const envelope=prepareNativeBodyEnvelope(source.program,{camera:bound.camera,alignment:bound.alignment,actorScaleFx:p.actorScaleFx,yawFx:p.yawFx,...nativePose,billboardProfile:b});
   // Source programs/animations remain solely in their original bounded cache.
   envelope.program=null;envelope.nativeInput.animation=null;if(Object.hasOwn(envelope.nativeInput,'jointPlan'))envelope.nativeInput.jointPlan=null;envelope.billboardProfile=null;
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
  if(!state.envelope){const source=prepared(request.candidate),nativePose=poseInput(source,request.pose);guard();if(shouldYield())return result;
   state.envelope=envelopeSeed(source,request,bound,nativePose);
   state.completedSteps++;guard();result.completedSteps=state.completedSteps;if(shouldYield())return result;
  }
  // Advance through non-intersecting planes until one proposal is available.
  // A plane cursor survives budget yields. Fairness remains one render proposal
  // per visit rather than charging every empty floor as a rendered proposal.
  // Preparation and each floor solve are cooperative indivisible segments.
  const source=prepared(request.candidate),nativePose=poseInput(source,request.pose),envelope={...state.envelope,program:source.program,nativeInput:{...state.envelope.nativeInput,...nativePose}};
  while(state.planeIndex<request.floorPlan.planes.length&&!shouldYield()){guard();const floorPlan={...request.floorPlan,planes:[request.floorPlan.planes[state.planeIndex]]},placed=placeNativeBodyEnvelopeOnFloors(envelope,request.region,floorPlan);state.planeIndex++;state.completedSteps++;guard();result.placements.push(...placed.placements);result.unresolved.push(...placed.unresolved);if(result.placements.length)break;}
  result.completedSteps=state.completedSteps;result.complete=state.planeIndex===request.floorPlan.planes.length;return result;
 }
 return{proposeNativeEnvelope,proposeNativePhaseEnvelope,proposeNativeDrawAnimationEnvelope,prepareNativePhaseDomain,dispose(){cache.clear();envelopeSeeds.clear();bytes=envelopeBytes=0;disposed=true;},get stats(){return{entries:cache.size,estimatedBytes:bytes,maxCacheBytes,maxPrograms,hits,misses,disposed,...(phaseResourcesPrepared?{explicitPhase:{preparedResources:phaseResourcesPrepared,cachedAnimations:[...cache.values()].reduce((n,s)=>n+s.phaseAnimations.size,0),sourceVerified:Boolean(phaseSourceRules)}}:{}),envelopeSeeds:{entries:envelopeSeeds.size,estimatedBytes:envelopeBytes,maxCacheBytes,maxEntries:maxPrograms,hits:envelopeHits,misses:envelopeMisses,evictions:envelopeEvictions}};},async evaluate(request,{signal,getCurrentFrame,budget,yieldTask=pause,onProgress=()=>{}}={}){
  need(!disposed,'Source-native runner disposed');need(request?.frame?.romSHA256===romSHA256&&Array.isArray(request.candidates)&&Array.isArray(request.branches)&&request.branches.length>0,'Source-native request identity/candidates/branches required');need(Number.isFinite(budget?.wallTimeMs)&&budget.wallTimeMs>0&&Number.isSafeInteger(budget?.maxProposals)&&budget.maxProposals>0,'Explicit per-job time and proposal bounds required');need(typeof getCurrentFrame==='function','Current frozen-frame identity guard required');
  need(new Set(request.candidates.map(c=>c.modelId)).size===request.candidates.length&&new Set(request.branches.map(b=>b.branchId)).size===request.branches.length,'Distinct candidates and background branches required');need(request.videoRGBA?.length===49152*4,'Frozen native video RGBA required');const started=performance.now(),key=frameKey(request.frame),branches=[];let attempts=0,budgetStopped=false;
  const guard=()=>{if(disposed||signal?.aborted||frameKey(getCurrentFrame())!==key)throw new DOMException('Source-native body job cancelled or stale','AbortError');};
  guard();const originalMaskSHA256=await originalComponentMaskSHA256(request.region?.originalProposalSupport);guard();for(const branch of request.branches){const bound=bindFrozenBodyProjection({frame:request.frame,cameraFrame:branch.frame,camera:branch.camera,alignment:branch.alignment,sourceFloorFrame:branch.sourceFloorFrame});if(branch.fog)need(['same-frame-source-mode2-actor-fog','same-frame-source-mode1-actor-fog'].includes(branch.fog.snapshot?.kind)&&frameKey(branch.fog.snapshot.frame)===key,'Actor fog differs from frozen frame');need(branch.backgroundRGBA?.length===49152*4&&branch.validMask?.length===49152&&branch.assumptions&&Array.isArray(branch.unknownAlternatives),'Branch pixels, valid mask and assumptions required');const output={branchId:branch.branchId,assumptions:clone(branch.assumptions),unknownAlternatives:clone(branch.unknownAlternatives),candidates:[]};branches.push(output);const comparisonBinding=await sourcePixelComparisonBinding({sourcePixelSHA256:request.frame.fullRGBA_SHA256,videoRGBA:request.videoRGBA,backgroundRGBA:branch.backgroundRGBA,validMask:branch.validMask},branch.comparisonBinding);guard();
   for(const candidate of request.candidates){guard();const mode1Scene=branch.getBodyDestination?.mode1SceneRequested===true,result={modelId:candidate.modelId,variant:candidate.variant,testedProposals:0,best:null,unsupported:[],...(mode1Scene?{isolatedBodySupport:{kind:'prior-isolated-body-source-support',testedProposals:0,best:null,unsupported:[]}}:{})};output.candidates.push(result);const proposals=branch.proposalsByModel?.[candidate.modelId];if(!Array.isArray(proposals)){result.unsupported.push({reason:'Source placement proposals unavailable for this candidate/branch'});if(mode1Scene)result.isolatedBodySupport.unsupported.push(clone({reason:'Source placement proposals unavailable for this candidate/branch'}));continue;}
    if(attempts>=budget.maxProposals||performance.now()-started>=budget.wallTimeMs)budgetStopped=true;if(budgetStopped){result.unsupported.push({reason:'Not evaluated: explicit worker job budget exhausted',remainingProposals:proposals.length});if(mode1Scene)result.isolatedBodySupport.unsupported.push(clone({reason:'Not evaluated: explicit worker job budget exhausted',remainingProposals:proposals.length}));continue;}let source;try{source=prepared(candidate);}catch(error){const failure={scope:'source-program',reason:error.message};result.unsupported.push(failure);if(mode1Scene)result.isolatedBodySupport.unsupported.push(clone(failure));continue;}
    for(let i=0;i<proposals.length;i++){guard();if(attempts>=budget.maxProposals||performance.now()-started>=budget.wallTimeMs){budgetStopped=true;result.unsupported.push({reason:'Not evaluated: explicit worker job budget exhausted',remainingProposals:proposals.length-i});if(mode1Scene)result.isolatedBodySupport.unsupported.push(clone({reason:'Not evaluated: explicit worker job budget exhausted',remainingProposals:proposals.length-i}));break;}const p=proposals[i];attempts++;let isolatedRecorded=false;
     try{const pose=p.pose;if(pose.drawAnimationCondition!==undefined){await preparePoseResources(source,pose,guard);}else if(pose.phaseFx!==undefined){await phaseAnimation(source,pose.clip,guard);guard();}const nativePose=poseInput(source,pose);let billboardState=null;if(source.program.billboardSource){need(branch.billboardProfile?.kind==='conditional-ordinary-ROM-initial-templates','Explicit conditional billboard context unavailable');billboardState=createNativeBodyBillboardState(source.program.billboardSource,{...branch.billboardProfile,templates:source.program.billboardSource.initialTemplates});}
      let destination=null,destinationFailure=null;if((mode1Scene||source.program.materials.some(m=>m.texture?.translucent))&&typeof branch.getBodyDestination==='function'){try{destination=await branch.getBodyDestination({assertCurrent:guard,shouldYield:()=>performance.now()-started>=budget.wallTimeMs,yieldTask,onSegment:segment=>{if(Number.isSafeInteger(segment.completedSteps))result.preparationCompletedSteps=Math.max(result.preparationCompletedSteps??0,segment.completedSteps);}});guard();if(destination?.kind==='native-body-destination-pending'){need(Number.isSafeInteger(destination.completedSteps)&&destination.completedSteps>=0,'Destination progress is invalid');result.preparationCompletedSteps=Math.max(result.preparationCompletedSteps??0,destination.completedSteps);result.preparationPending=clone(destination);budgetStopped=true;break;}if(performance.now()-started>=budget.wallTimeMs){budgetStopped=true;break;}need(destination?.binding?.kind==='same-frozen-source-destination-v1'&&frameKey(destination.binding.frame)===key,'Scene destination differs from frozen frame');}catch(error){if(error.name==='AbortError'||!mode1Scene)throw error;destinationFailure=error.message;destination=null;}}
      const projected=projectNativeBodyPolygons(source.program,{camera:bound.camera,positionFx:p.positionFx,actorScaleFx:pose.actorScaleFx,yawFx:pose.yawFx,...nativePose,billboardState}),rendered=rasterNativeBody(source.program,projected,{profile,fog:branch.fog??null,alignment:bound.alignment,destination});
      const record=(image,target,scene)=>{if(!image.ready){target.unsupported.push({proposalId:p.id,reason:image.reason,errors:image.errors,unsupportedDestination:image.unsupportedDestination,...(image.stats?{sceneCompositionStats:image.stats}:{})});return;}const fit=comparePerspectiveBody(image,{videoRGBA:request.videoRGBA,backgroundRGBA:branch.backgroundRGBA,validMask:branch.validMask,region:request.region,sourcePixelSHA256:request.frame.fullRGBA_SHA256,...(request.region.originalProposalSupport!==undefined?{originalProposalSupport:request.region.originalProposalSupport}:{})}),row={proposalId:p.id,pose:clone(pose),positionFx:p.positionFx.slice(),fit:{...fit,...(fit.originalProposalSupport?{originalProposalSupport:{...fit.originalProposalSupport,originalComponentMaskSHA256:originalMaskSHA256}}:{}),comparisonBinding:clone(comparisonBinding),bodyMaskRuns:undefined},nativeBodyExtent:nativeBodyExtentEvidence({projected,rendered:image,alignment:bound.alignment,comparisonValidMask:branch.validMask,frame:request.frame}),...(scene?{sceneComposition:{sourceAcceptedSubset:image.sourceAcceptedSubset,stats:image.stats,binding:clone(scene.binding),sourceOrder:clone(scene.sourceOrder),...(scene.postActorEffect?{postActorEffectHypothesis:clone(scene.postActorEffect.hypothesis),postActorEffectOrder:clone(scene.postActorEffect.sourceOrder),currentPhaseProven:false,currentEnableFadeOffsetsObserved:false}:{}),partialBodyNotScored:false}}:{})};target.testedProposals++;if(!target.best||fit.pixelErrorReduction>target.best.fit.pixelErrorReduction)target.best=row;};
      if(mode1Scene){record(rendered.isolatedBody??rendered,result.isolatedBodySupport,null);isolatedRecorded=true;}
      if(destinationFailure)result.unsupported.push({proposalId:p.id,scope:'conditional-mode1-MSE-destination',reason:destinationFailure,unsupportedDestination:true,partialBodyNotScored:true});else record(rendered,result,destination);
     }catch(error){if(error.name==='AbortError')throw error;const failure={proposalId:p.id,reason:error.message};result.unsupported.push(failure);if(mode1Scene&&!isolatedRecorded)result.isolatedBodySupport.unsupported.push(clone(failure));}await yieldTask();guard();
    }onProgress({branchId:branch.branchId,modelId:candidate.modelId,attempts,budgetStopped,elapsedMs:performance.now()-started});
   }
  }guard();return{kind:'per-candidate-source-native-body-support',renderer:'source-integer-original-GX-body-subset',frame:clone(request.frame),branches,attempts,budgetStopped,elapsedMs:performance.now()-started,complete:false,identityCertified:false,noEventPossible:true,minimumProvenATCalls:0};
 }};
}
