import {fitRenderedBody} from './monster-body-support.mjs?v=field-stream-20261005-1108';
import {proposeDenseComplement,validateDenseComplement} from './monster-dense-proposals.mjs';
import {readMonsterAssets} from './monster-assets.mjs';
import {readNSBCA,sampleMatrices} from './monster-animation.mjs';
import {MonsterTemplateBank} from './monster-template-bank.mjs';
import {MonsterCPU} from './monster-cpu-template.mjs';
import {getFieldExclusion,normalizeSceneContext} from './monster-field-mask.mjs';
import {cosineSimilarity,DINO_SPEC,dinoSpec} from './monster-dinov2.mjs?v=recognition-cache-20261005-1007';
import {validateRGBA,colorDescriptor,descriptorDistance,cropRGBA} from './monster-roi-descriptor.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};const clone=x=>structuredClone(x);const yieldTask=()=>new Promise(r=>setTimeout(r,0));
// Hash of the reviewed renderer/decoder dependency manifest. Bump when those sources change.
export const FEATURE_RENDER_REVISION='d0c3d674e4fda4819d9fc34a826c3a773c28af966abc52c6d011584daa8df561';
export const RECOGNITION_LIMITS=Object.freeze({models:4,variants:8,templates:256,tileSize:64,poseBytes:8*1024*1024,cacheBytes:8*1024*1024,wallTimeMs:30000,roiPixels:1024*1024});
export function validateRecognitionRequest(request,catalog){
 need(request&&Array.isArray(request.modelIds)&&request.modelIds.length>=1&&request.modelIds.length<=4&&new Set(request.modelIds).size===request.modelIds.length,'候補モデルを1〜4種類選んでください');need(request.modelIds.every(id=>typeof id==='string'&&catalog.has(id)),'未登録のモデルです');need(['_f','regular','both'].includes(request.variant),'variantを明示してください');need(['quick','standard'].includes(request.preset),'探索設定が不正です');validateRGBA(request.crop);need(request.crop.width<=1024&&request.crop.height<=1024,'ROIの幅・高さは1024px以下にしてください');
 const s=request.captureStamp;need(s&&typeof s.sourceId==='string'&&s.sourceId&&Number.isSafeInteger(s.sourceEpoch)&&s.sourceEpoch>=0&&Number.isSafeInteger(s.timelineSegment)&&s.timelineSegment>=0&&Number.isSafeInteger(s.frameSerial)&&s.frameSerial>=0&&Number.isSafeInteger(s.romEpoch)&&s.romEpoch===request.romEpoch,'同一撮影・ROMの識別情報が必要です');need(s.sourceFrame&&Number.isInteger(s.sourceFrame.width)&&Number.isInteger(s.sourceFrame.height)&&s.sourceFrame.width>0&&s.sourceFrame.height>0&&s.sourceFrame.width<=4096&&s.sourceFrame.height<=4096,'元画像の寸法が不正です');
 const roi=s.enemyROI;need(roi&&[roi.x,roi.y,roi.w,roi.h].every(Number.isInteger)&&roi.x>=0&&roi.y>=0&&roi.w===request.crop.width&&roi.h===request.crop.height&&roi.x+roi.w<=s.sourceFrame.width&&roi.y+roi.h<=s.sourceFrame.height,'ROIと撮影画像の対応が不正です');
 const featureMethod=request.featureMethod??'histogram';need(['histogram','dinov2'].includes(featureMethod),'特徴比較の方法が不正です');if(featureMethod==='dinov2')need(request.preset==='quick'&&request.variant!=='both','AI特徴比較は軽量・単一variant（最大64姿勢）で利用してください');
 if(s.featureMethod!==undefined||featureMethod==='dinov2')need(s.featureMethod===featureMethod,'撮影と比較方法の識別が一致しません');
 const inferenceBackend=request.inferenceBackend??'wasm';if(featureMethod==='dinov2'){dinoSpec(inferenceBackend);need((s.inferenceBackend??'wasm')===inferenceBackend,'撮影と推論方式が一致しません');}
 const sceneContext=normalizeSceneContext(request.sceneContext,s.sourceFrame),stampedScene=normalizeSceneContext(s.sceneContext,s.sourceFrame);need(JSON.stringify(sceneContext)===JSON.stringify(stampedScene),'撮影と操作画面の設定が一致しません');
 const variants=request.variant==='both'?['regular','_f']:[request.variant],viewCount=request.preset==='quick'?4:8,poseCount=request.preset==='quick'?4:7,maxTemplates=request.modelIds.length*variants.length*viewCount*poseCount;
 need(maxTemplates<=RECOGNITION_LIMITS.templates,'この組合せは描画予算を超えます。「軽量」にするかvariant・候補数を減らしてください');return{variants,viewCount,maxTemplates,featureMethod,inferenceBackend,sceneContext};
}
const poseBytes=model=>model.vertices.byteLength+model.indices.byteLength+model.materials.reduce((n,m)=>n+m.rgba.byteLength,0);
function unionBounds(poses){return {min:[0,1,2].map(k=>Math.min(...poses.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...poses.map(p=>p.bounds.max[k])))};}
export const DENSE_POSE_MODELS=Object.freeze(['z019b','z021a','z064a','z000c']);
/** Prepare the ordinary quick/_f pose bank without a query crop or ranking. */
export async function prepareDinoPoseBank(request,deps){
 need(request?.featureMethod==='dinov2'&&request.preset==='quick'&&request.variant==='_f','DINO補助はフィールドモデル・クイック設定のみ対応します');
 need(Array.isArray(request.modelIds)&&request.modelIds.length===4&&DENSE_POSE_MODELS.every(id=>request.modelIds.includes(id)&&deps.catalog.has(id)),'DINO補助は初期の4モデルを選択してください');
 need(Number.isSafeInteger(request.romEpoch)&&request.romEpoch>=0&&/^[a-f0-9]{64}$/.test(deps.romSHA256??''),'現在のROM識別が必要です');dinoSpec(request.inferenceBackend);
 return runRecognition({...request,modelIds:[...DENSE_POSE_MODELS]},deps,true);
}
/** One explicit frozen-frame job. Bank preparation and classification share the same renderer/cache. */
export async function supplementEnemyROIs(request,deps){
 if(deps.signal?.aborted)throw new DOMException('中止','AbortError');
 const current=structuredClone(request.current);validateDenseComplement(request.image,current);
 need(request.romEpoch===current.captureStamp.romEpoch&&request.featureMethod===current.captureStamp.featureMethod&&request.inferenceBackend===current.captureStamp.inferenceBackend,'DINO補助のROM・実行方式が一致しません');
 if(current.proposals.length===8)return{...current,denseAdded:[],denseSkipped:'cpu-budget-full'};
 const image={width:request.image.width,height:request.image.height,rgba:request.image.rgba.slice()};
 const started=performance.now(),prepared=await prepareDinoPoseBank(request,deps);
 if(deps.signal?.aborted)throw new DOMException('中止','AbortError');
 deps.onProgress?.({phase:'patch',message:'固定したゲーム画面のDINOパッチから補助候補を計算中'});
 const backend=await deps.getDino({backend:request.inferenceBackend});
 const result=await proposeDenseComplement(image,current,{backend,poseBank:prepared.bank,romSHA256:deps.romSHA256,signal:deps.signal,getCurrentCaptureStamp:()=>deps.signal?.aborted?null:current.captureStamp});
 return{...result,densePreparation:prepared.timings,cacheWarnings:prepared.cacheWarnings,denseTotalMs:performance.now()-started};
}
export async function recognizeROI(request,deps){return runRecognition(request,deps,false);}
async function runRecognition(request,{nitro,catalog,geometry,signal,onProgress=()=>{},getDino,romSHA256,featureStore,cacheQuery=false,cachePartialPoses=false},prepareOnly){
 const plan=prepareOnly?{variants:['_f'],viewCount:4,maxTemplates:64,featureMethod:'dinov2',inferenceBackend:request.inferenceBackend}:validateRecognitionRequest(request,catalog),start=performance.now(),renderer=new MonsterCPU(),bank=new MonsterTemplateBank(renderer,{maxCacheBytes:RECOGNITION_LIMITS.cacheBytes,maxEntries:32});let rendered=0;
 const maxMs=plan.featureMethod==='dinov2'?DINO_SPEC.maxMs:RECOGNITION_LIMITS.wallTimeMs;
 const guard=()=>{if(signal?.aborted)throw new DOMException('識別を中止しました','AbortError');if(performance.now()-start>maxMs)throw Error(`${maxMs/1000}秒の処理予算に達しました。候補数を減らして再試行してください`);};
 const unsupported=[],rankMap=new Map(),bodyFitMap=new Map(),views=Array.from({length:plan.viewCount},(_,i)=>({yaw:i*Math.PI*2/plan.viewCount,pitch:Math.PI/4})),stamp=prepareOnly?null:clone(request.captureStamp),preparedVectors=[],preparedKeys=[];let query,dino,statsBefore,backendInitMs=0;const cacheWarnings=[],modelCacheStats=[];const stages={bodyFitMs:0,decodeMs:0,renderMs:0,persistentReadMs:0,persistentWriteMs:0};let persistentRestored=0,persistentSavedModels=0,persistentSavedPartialModels=0;const reportProgress=onProgress;onProgress=p=>reportProgress({...p,timings:{...stages,elapsedMs:performance.now()-start,backendInitMs,queryMs:dino&&statsBefore?dino.stats.queryMs-statsBefore.queryMs:0,templateEmbeddingMs:dino&&statsBefore?dino.stats.templateEmbeddingMs-statsBefore.templateEmbeddingMs:0,templateCacheHits:dino&&statsBefore?dino.stats.templateCacheHits-statsBefore.templateCacheHits:0,templateCacheMisses:dino&&statsBefore?dino.stats.templateCacheMisses-statsBefore.templateCacheMisses:0}});
 const exclusion=prepareOnly?null:getFieldExclusion(stamp,plan.sceneContext);
 try{
  guard();
  if(exclusion?.excluded)return{schema:'dq9-experimental-rom-roi-ranking-v1',captureStamp:stamp,featureMethod:plan.featureMethod,metric:plan.featureMethod==='dinov2'?'cosine':'squared-distance',rankings:[],skipped:'central-field-exclusion',exclusion,unknown:{suggested:true,calibrated:false,reason:'主人公の中央領域と重なるため未観測・判別不能として扱います。敵がいない証拠ではありません'},coverage:{queryDescriptorsComputed:0,requestedModels:request.modelIds.length,completedModels:0,unsupported:[],renderedTemplates:0,requestedTemplateUpperBound:plan.maxTemplates,scope:'中央領域に重なる手動ROIは未観測'},elapsedMs:performance.now()-start,safeForHardPruning:false,automaticDetection:false,birthCertified:false,ATDrawsCertified:0,currentVideoStateRecovered:false};
  if(plan.featureMethod==='dinov2'){need(typeof getDino==='function','AIランタイムを準備してください');const initStart=performance.now();dino=await getDino({backend:plan.inferenceBackend});backendInitMs=performance.now()-initStart;if(prepareOnly)need(dino.spec.backend===plan.inferenceBackend,'姿勢特徴の推論方式が一致しません');guard();statsBefore={...dino.stats};
   if(!prepareOnly){guard();onProgress({phase:'embed',done:0,total:plan.maxTemplates,message:'切り抜きのAI特徴を計算中'});query=await dino.encode(request.crop,{signal,cacheQuery});guard();}}else query=colorDescriptor(request.crop);
  for(const modelId of request.modelIds)for(const variant of plan.variants){guard();onProgress({phase:'decode',done:rendered,total:plan.maxTemplates,message:`${modelId} / ${variant} をROMから生成中`});await yieldTask();let asset,poses;const modelKeys=new Set(),modelRenderedStart=rendered,modelPreparedStart=preparedVectors.length,issueStart=unsupported.length,missStart=dino?.stats.templateCacheMisses??0,hitStart=dino?.stats.templateCacheHits??0;let modelBankKey,modelRestored=0,modelSaved=false;
   const decodeStart=performance.now();try{
    asset=readMonsterAssets(nitro,catalog,[{modelId,variant}]).models[0];poses=[geometry.decode(asset)];const baseBytes=poseBytes(poses[0]);let bytes=baseBytes;need(bytes<=RECOGNITION_LIMITS.poseBytes,'モデルの姿勢データ予算を超えました');
    for(const clip of ['stand.nsbca','run.nsbca','appear.nsbca']){
     const raw=asset.animations.find(a=>a.name===clip);if(!raw){unsupported.push({modelId,variant,clip,reason:'ROM内に対象clipがありません'});continue;}
     try{const animation=readNSBCA(raw.bytes),frames=request.preset==='quick'?[Math.floor((animation.numFrames-1)/2)]:[0,Math.floor((animation.numFrames-1)/2)];
      for(const frame of [...new Set(frames)]){guard();need(bytes+baseBytes<=RECOGNITION_LIMITS.poseBytes,'モデルの姿勢データ予算を超えました');const poseSource={clip,frame,decoderVersion:'exact-nsbca-v1',exactStoredFrame:true};const model=geometry.decode(asset,{localMatrices:sampleMatrices(animation,frame),poseSource});bytes+=poseBytes(model);need(bytes<=RECOGNITION_LIMITS.poseBytes,'モデルの姿勢データ予算を超えました');poses.push(model);await yieldTask();}
     }catch(error){if(error.name==='AbortError')throw error;unsupported.push({modelId,variant,clip,reason:error.message});}
    }
    const bounds=unionBounds(poses);for(const model of poses)model.templateBounds=clone(bounds);
   }catch(error){if(error.name==='AbortError')throw error;unsupported.push({modelId,variant,reason:error.message});continue;}finally{stages.decodeMs+=performance.now()-decodeStart;}
   if(dino&&featureStore&&/^[0-9a-f]{64}$/.test(romSHA256??'')){
    modelBankKey=JSON.stringify({schema:'dq9-rom-model-pose-vectors-v2',romSHA256,inference:dino.identity,inferenceRevision:dino.spec.modelRevision,modelId,variant,preset:request.preset,posePolicy:'bind-stand-run-appear-midpoint-exact-v1',renderer:'cpu-unlit-v2-unionbounds',geometry:FEATURE_RENDER_REVISION,views,tileSize:64,...(cachePartialPoses&&unsupported.length>issueStart?{availablePosePolicy:'unsupported-retained-v1',unsupported:unsupported.slice(issueStart)}:{})});
    const readStart=performance.now();onProgress({phase:'cache-read',message:`${modelId} の保存特徴を読み込み中`});try{const saved=await featureStore.read(modelBankKey,{signal});if(saved){need(saved.length<=16&&saved.every(e=>e.key.startsWith(dino.identity+':'+romSHA256+':')),'保存特徴量の推論識別が一致しません');for(const e of saved){if(dino.cache.has(e.key))dino.cache.delete(e.key);else if(dino.cache.size>=64)dino.cache.delete(dino.cache.keys().next().value);dino.cache.set(e.key,e.vector);}modelRestored=saved.length;persistentRestored+=saved.length;modelSaved=true;onProgress({phase:'cache',done:rendered,total:plan.maxTemplates,message:`${modelId} / ${variant}の保存済み姿勢特徴 ${saved.length}件を再利用`});}}
    catch(error){if(error.name==='AbortError')throw error;cacheWarnings.push(`${modelId}: 保存特徴量を読めないため再生成します: ${error.message}`);onProgress({phase:'cache',message:cacheWarnings.at(-1)});}finally{stages.persistentReadMs+=performance.now()-readStart;}
   }
   guard();
   for(const model of poses){guard();let lease;try{
    const renderStart=performance.now();lease=await bank.generate([model],{sessionKey:`rom-${request.romEpoch}`,views,tileSize:64,signal,candidateScope:'explicit',onProgress:p=>{guard();onProgress({phase:'render',done:plan.featureMethod==='dinov2'?rendered:rendered+p.completedViews,total:plan.maxTemplates,message:`${modelId} ${model.poseSource?.clip??'bind'} / 姿勢候補を照合中`});}});
    stages.renderMs+=performance.now()-renderStart;const atlas=lease.entries[0].atlas;
    for(const view of atlas.views){const thumbnail=cropRGBA(atlas,view.x,view.y,64,64),color=colorDescriptor(thumbnail,{template:true});if(color.empty)continue;guard();let similarity,distance;if(dino){onProgress({phase:'template-embed',done:rendered+atlas.views.indexOf(view),total:plan.maxTemplates,message:`${modelId} の姿勢AI特徴を計算・照合中`});const vector=await dino.encode(thumbnail,{template:true,cacheKey:romSHA256??`rom-${request.romEpoch}`,signal,onCacheKey:key=>{modelKeys.add(key);if(prepareOnly)preparedKeys.push(key);}});guard();if(prepareOnly)preparedVectors.push(vector.slice());else{similarity=cosineSimilarity(query,vector);distance=1-similarity;}onProgress({phase:'embed',done:rendered+atlas.views.indexOf(view)+1,total:plan.maxTemplates,message:`${modelId} のAI特徴を比較中`});}else distance=descriptorDistance(query,color);if(!prepareOnly&&request.nativeBodyEvidence){const bodyFitStart=performance.now(),fit=fitRenderedBody(thumbnail,request.nativeBodyEvidence),previousBody=bodyFitMap.get(modelId);if(fit&&(!previousBody||fit.pixelErrorReduction>previousBody.pixelErrorReduction))bodyFitMap.set(modelId,{...fit,pose:{clip:model.poseSource?.clip??'bind',frame:model.poseSource?.frame??null,variant,yaw:view.yaw,pitch:view.pitch}});stages.bodyFitMs+=performance.now()-bodyFitStart;}const previous=rankMap.get(modelId);if(!prepareOnly&&(!previous||distance<previous.distance))rankMap.set(modelId,{modelId,speciesCandidates:clone(model.speciesCandidates),distance,...(dino?{similarity}:{}),bestPose:{clip:model.poseSource?.clip??'bind',frame:model.poseSource?.frame??null,variant,yaw:view.yaw,pitch:view.pitch},thumbnail});}
    rendered+=views.length;
   }catch(error){if(error.name==='AbortError'||dino)throw error;unsupported.push({modelId,variant,clip:model.poseSource?.clip??'bind',frame:model.poseSource?.frame??null,reason:error.message});}finally{lease?.release();}await yieldTask();}
   const modelComplete=unsupported.length===issueStart&&rendered-modelRenderedStart===16&&poses.length===4&&(prepareOnly?preparedVectors.length-modelPreparedStart===16:rankMap.has(modelId));
   const partialReusable=cachePartialPoses&&!modelComplete&&poses.length>0&&rendered-modelRenderedStart===poses.length*views.length&&modelKeys.size>0&&(!prepareOnly&&rankMap.has(modelId));
   if(dino&&modelBankKey&&(modelComplete||partialReusable)&&(!modelRestored||dino.stats.templateCacheMisses>missStart)){
    const writeStart=performance.now();onProgress({phase:'cache-write',message:`${modelId} の姿勢特徴を保存中`});try{const entries=[...modelKeys].map(key=>({key,vector:dino.cache.get(key)}));need(entries.length>0&&entries.length<=16&&entries.every(e=>e.vector),'完成したモデル姿勢バンクが揃っていません');guard();await featureStore.write(modelBankKey,entries,{signal});modelSaved=true;}
    catch(error){if(error.name==='AbortError')throw error;modelSaved=false;cacheWarnings.push(`${modelId}: 今回の特徴量を保存できませんでした: ${error.message}`);}finally{stages.persistentWriteMs+=performance.now()-writeStart;}
   }
   guard();const partialSaved=partialReusable&&modelSaved;if(partialSaved)persistentSavedPartialModels++;if(!modelComplete)modelSaved=false;if(modelSaved)persistentSavedModels++;
   if(dino)modelCacheStats.push({modelId,variant,templateCacheHits:dino.stats.templateCacheHits-hitStart,templateCacheMisses:dino.stats.templateCacheMisses-missStart,persistentRestored:modelRestored,persistentSaved:modelSaved,partialVectorsSaved:partialSaved});
  }
  guard();const rankings=[...rankMap.values()].map(r=>bodyFitMap.has(r.modelId)?{...r,bodyFit:bodyFitMap.get(r.modelId)}:r).sort((a,b)=>a.distance-b.distance||a.modelId.localeCompare(b.modelId));
  guard();const timings=dino?{...stages,backendInitMs,backendInitialization:{runtimeLoadMs:dino.stats.runtimeLoadMs,modelReadMs:dino.stats.modelReadMs,sessionCreateMs:dino.stats.sessionCreateMs},queryCacheHits:dino.stats.queryCacheHits-statsBefore.queryCacheHits,queryCacheMisses:dino.stats.queryCacheMisses-statsBefore.queryCacheMisses,queryMs:dino.stats.queryMs-statsBefore.queryMs,templateEmbeddingMs:dino.stats.templateEmbeddingMs-statsBefore.templateEmbeddingMs,templateCacheHits:dino.stats.templateCacheHits-statsBefore.templateCacheHits,templateCacheMisses:dino.stats.templateCacheMisses-statsBefore.templateCacheMisses,persistentRestored,persistentSaved:persistentSavedModels===request.modelIds.length,persistentSavedModels,persistentSavedPartialModels,models:modelCacheStats,totalMs:performance.now()-start}:null;
  if(prepareOnly){need(!unsupported.length&&rendered===64&&preparedVectors.length===64&&preparedKeys.length===64,'64姿勢を準備できませんでした。補助候補は追加していません');return{bank:{identity:dino.identity,romSHA256,romEpoch:request.romEpoch,keys:preparedKeys,vectors:preparedVectors},timings,cacheWarnings};}
  return{schema:'dq9-experimental-rom-roi-ranking-v1',captureStamp:stamp,featureMethod:plan.featureMethod,metric:dino?'cosine':'squared-distance',...(dino?{inference:{...dino.spec,cacheEntries:dino.cache?.size??0},timings,cacheWarnings}:{}),exclusion,rankings,unknown:{suggested:true,reason:!dino&&query.empty?'切り抜き内の不透明画素を確認できません':'距離の採否境界は未検証です。候補外の種・背景・UIを除外できません',calibrated:false},coverage:{queryDescriptorsComputed:1,requestedModels:request.modelIds.length,completedModels:rankings.length,unsupported,renderedTemplates:rendered,requestedTemplateUpperBound:plan.maxTemplates,scope:'手動ROI・選択モデル・指定variant・45度の仮カメラ・少数のROM姿勢候補のみ'},elapsedMs:performance.now()-start,descriptor:dino?`DINOv2-small ${dino.spec.precision} ${dino.spec.provider}384-component CLS cosine over ROM poses; uncalibrated`:'ROM-only 24-component hue/saturation histogram; deterministic bilinear48px, uncalibrated scene-specific foreground heuristic',safeForHardPruning:false,automaticDetection:false,birthCertified:false,ATDrawsCertified:0,currentVideoStateRecovered:false,limitations:['候補順と距離は実験値で、確率ではありません','画面から敵を自動検出しません。背景・UIの誤候補が残ります','照明・色・実カメラ・実animation位相は未再現です','同じモデルの種ID候補をすべて保持し、候補外の可能性も残します','出現・出生・AT消費や現在ATをこの結果から確定しません']};
 }finally{bank.destroy();renderer.destroy();}
}
