// Cancellable, GPU-resident static orientation templates. No classifier, video
// loop, catalogue scan, persistent cache, or AT-observation side effect.
export const DEFAULT_TEMPLATE_VIEWS=Object.freeze(Array.from({length:8},(_,i)=>Object.freeze({yaw:i*Math.PI/4,pitch:Math.PI/4})));
export const TEMPLATE_LIMITS=Object.freeze({modelsPerJob:8,viewsPerModel:16,tileSizes:Object.freeze([32,64,128]),jobPixels:8*16*128*128,defaultCacheBytes:8*1024*1024,defaultCacheEntries:32,batchViews:2});
const abort=()=>new DOMException('Template generation cancelled','AbortError');
const check=signal=>{if(signal.aborted)throw abort();};
export class MonsterTemplateBank {
 constructor(renderer,{maxCacheBytes=TEMPLATE_LIMITS.defaultCacheBytes,maxEntries=TEMPLATE_LIMITS.defaultCacheEntries}={}){
  if(!renderer||typeof renderer.createTemplateAtlas!=='function')throw Error('A WebGPU template renderer is required');
  if(!Number.isInteger(maxCacheBytes)||maxCacheBytes<4096||maxCacheBytes>32*1024*1024||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>64)throw Error('Invalid GPU template cache budget');
  Object.assign(this,{renderer,maxCacheBytes,maxEntries,cache:new Map(),cacheBytes:0,tick:0,active:null,tail:Promise.resolve(),disposed:false,epoch:0});
 }
 plan(candidates,{sessionKey,views=DEFAULT_TEMPLATE_VIEWS,tileSize=64,candidateScope='explicit'}={}){
  if(this.disposed)throw Error('Template bank released');if(typeof sessionKey!=='string'||!sessionKey.length||sessionKey.length>200)throw Error('A current ROM-session key is required');
  if(!['explicit','encounter-context'].includes(candidateScope))throw Error('Candidate scope must be explicit or encounter-context');
  if(!Array.isArray(candidates)||candidates.length<1||candidates.length>TEMPLATE_LIMITS.modelsPerJob)throw Error('Supply 1..8 explicit/pruned models; whole-catalogue generation is not supported');
  if(!Array.isArray(views)||views.length<1||views.length>TEMPLATE_LIMITS.viewsPerModel||views.some(v=>!Number.isFinite(v?.yaw)||!Number.isFinite(v?.pitch)||Math.abs(v.yaw)>Math.PI*2||Math.abs(v.pitch)>Math.PI/2))throw Error('Choose 1..16 finite yaw/pitch views');
  if(!TEMPLATE_LIMITS.tileSizes.includes(tileSize))throw Error('Template tile size must be 32, 64, or 128');
  const orientations=views.map(({yaw,pitch})=>({yaw,pitch}));if(new Set(orientations.map(v=>JSON.stringify(v))).size!==views.length)throw Error('Duplicate template orientations');
  const columns=Math.min(4,views.length),rows=Math.ceil(views.length/columns),atlasBytes=columns*rows*tileSize*tileSize*4,pixels=candidates.length*views.length*tileSize*tileSize;
  if(pixels>TEMPLATE_LIMITS.jobPixels)throw Error('Template job pixel budget exceeded');
  const seen=new Set(),items=candidates.map(model=>{
   if(model?.format!=='dq9-monster-preview'||model.pose!=='static-model-bind-pose'||model.animationApplied!==false||model.recognitionEvidence!==false)throw Error('Only decoded static model previews are accepted');
   if(typeof model.modelId!=='string'||!model.modelId.length||!['regular','_f'].includes(model.variant))throw Error('Explicit model identity and variant required');
   if(!Array.isArray(model.speciesCandidates)||!model.speciesCandidates.length||model.speciesCandidates.some(s=>!Number.isInteger(s.monsterId)))throw Error('All model species aliases are required');
   const id=model.modelId+':'+model.variant;if(seen.has(id))throw Error('Duplicate template candidate '+id);seen.add(id);
   const key=JSON.stringify(['static-unlit-sphere-v1',sessionKey,model.modelId,model.variant,tileSize,orientations]);
   return{model,key,speciesCandidates:model.speciesCandidates.map(s=>({...s}))};
  });
  // A single returned lease pins every model in this bounded set.
  if(atlasBytes*items.length>this.maxCacheBytes||items.length>this.maxEntries)throw Error('Requested template set exceeds cache lease budget');
  return{items,views:orientations,tileSize,atlasBytes,pixels,candidateScope,sessionKey};
 }
 generate(candidates,options={}){
  let plan;try{plan=this.plan(candidates,options);}catch(error){return Promise.reject(error);}
  this.active?.controller.abort();const controller=new AbortController(),epoch=this.epoch,token={controller};
  const externalAbort=()=>controller.abort();if(options.signal?.aborted)controller.abort();else options.signal?.addEventListener('abort',externalAbort,{once:true});
  this.active=token;
  const task=this.tail.catch(()=>{}).then(()=>this.run(plan,controller.signal,epoch,options.onProgress));
  this.tail=task.catch(()=>{});
  return task.finally(()=>{options.signal?.removeEventListener('abort',externalAbort);if(this.active===token)this.active=null;});
 }
 evictFor(bytes){
  while(this.cacheBytes+bytes>this.maxCacheBytes||this.cache.size+1>this.maxEntries){const available=[...this.cache.values()].filter(e=>e.references===0).sort((a,b)=>a.used-b.used);if(!available.length)throw Error('GPU template cache is leased; release unused results before adding models');const victim=available[0];victim.atlas.destroy();this.cache.delete(victim.key);this.cacheBytes-=victim.atlas.byteLength;}
 }
 async run(plan,signal,epoch,onProgress=()=>{}){
  const held=[],stats={requestedModels:plan.items.length,generatedModels:0,cacheHits:0,renderedViews:0,jobPixels:plan.pixels,candidateScope:plan.candidateScope,recognitionEvidence:false},start=performance.now();
  const valid=()=>{check(signal);if(this.disposed||epoch!==this.epoch||this.renderer.disposed)throw abort();};
  const release=()=>{for(const entry of held)entry.references=Math.max(0,entry.references-1);};
  try{valid();for(let i=0;i<plan.items.length;i++){valid();const item=plan.items[i];let entry=this.cache.get(item.key);
   if(entry?.atlas.destroyed){this.cache.delete(item.key);this.cacheBytes-=entry.atlas.byteLength;entry=null;}
   const cacheHit=!!entry;if(entry){stats.cacheHits++;}else{
    this.evictFor(plan.atlasBytes);
    const atlas=await this.renderer.createTemplateAtlas(item.model,{views:plan.views,tileSize:plan.tileSize,batchViews:TEMPLATE_LIMITS.batchViews,signal,onProgress:progress=>{valid();onProgress({modelId:item.model.modelId,variant:item.model.variant,modelIndex:i,totalModels:plan.items.length,...progress,cacheHit:false});}});
    try{valid();if(atlas.byteLength!==plan.atlasBytes||atlas.renderedViews!==plan.views.length)throw Error('Incomplete or over-budget GPU template atlas');}catch(error){atlas.destroy();throw error;}
    entry={key:item.key,atlas,modelId:item.model.modelId,variant:item.model.variant,speciesCandidates:item.speciesCandidates,references:0,used:0};this.cache.set(item.key,entry);this.cacheBytes+=atlas.byteLength;stats.generatedModels++;stats.renderedViews+=atlas.renderedViews;
   }
   entry.references++;entry.used=++this.tick;held.push(entry);onProgress({modelId:entry.modelId,variant:entry.variant,modelIndex:i,totalModels:plan.items.length,completedViews:plan.views.length,totalViews:plan.views.length,cacheHit,modelComplete:true});
  }
  valid();let released=false;return{entries:held.map(e=>({modelId:e.modelId,variant:e.variant,speciesCandidates:e.speciesCandidates.map(s=>({...s})),atlas:e.atlas,pose:'static-model-bind-pose',fieldVariantConfirmed:false,recognitionEvidence:false})),stats:{...stats,logicalCacheBytes:this.cacheBytes,wallMs:performance.now()-start},release(){if(!released){released=true;release();}}};
  }catch(error){release();throw error;}
 }
 cancel(){this.active?.controller.abort();}
 clear(){this.cancel();this.epoch++;for(const entry of this.cache.values())entry.atlas.destroy();this.cache.clear();this.cacheBytes=0;}
 destroy(){if(this.disposed)return;this.clear();this.disposed=true;}
}
