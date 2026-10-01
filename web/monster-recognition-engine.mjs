import {readMonsterAssets} from './monster-assets.mjs';
import {readNSBCA,sampleMatrices} from './monster-animation.mjs';
import {MonsterTemplateBank} from './monster-template-bank.mjs';
import {MonsterCPU} from './monster-cpu-template.mjs';
import {getFieldExclusion,normalizeSceneContext} from './monster-field-mask.mjs';
import {cosineSimilarity,DINO_SPEC} from './monster-dinov2.mjs';
import {validateRGBA,colorDescriptor,descriptorDistance,cropRGBA} from './monster-roi-descriptor.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};const clone=x=>structuredClone(x);const yieldTask=()=>new Promise(r=>setTimeout(r,0));
export const RECOGNITION_LIMITS=Object.freeze({models:4,variants:8,templates:256,tileSize:64,poseBytes:8*1024*1024,cacheBytes:8*1024*1024,wallTimeMs:30000,roiPixels:1024*1024});
export function validateRecognitionRequest(request,catalog){
 need(request&&Array.isArray(request.modelIds)&&request.modelIds.length>=1&&request.modelIds.length<=4&&new Set(request.modelIds).size===request.modelIds.length,'候補モデルを1〜4種類選んでください');need(request.modelIds.every(id=>typeof id==='string'&&catalog.has(id)),'未登録のモデルです');need(['_f','regular','both'].includes(request.variant),'variantを明示してください');need(['quick','standard'].includes(request.preset),'探索設定が不正です');validateRGBA(request.crop);need(request.crop.width<=1024&&request.crop.height<=1024,'ROIの幅・高さは1024px以下にしてください');
 const s=request.captureStamp;need(s&&typeof s.sourceId==='string'&&s.sourceId&&Number.isSafeInteger(s.sourceEpoch)&&s.sourceEpoch>=0&&Number.isSafeInteger(s.timelineSegment)&&s.timelineSegment>=0&&Number.isSafeInteger(s.frameSerial)&&s.frameSerial>=0&&Number.isSafeInteger(s.romEpoch)&&s.romEpoch===request.romEpoch,'同一撮影・ROMの識別情報が必要です');need(s.sourceFrame&&Number.isInteger(s.sourceFrame.width)&&Number.isInteger(s.sourceFrame.height)&&s.sourceFrame.width>0&&s.sourceFrame.height>0&&s.sourceFrame.width<=4096&&s.sourceFrame.height<=4096,'元画像の寸法が不正です');
 const roi=s.enemyROI;need(roi&&[roi.x,roi.y,roi.w,roi.h].every(Number.isInteger)&&roi.x>=0&&roi.y>=0&&roi.w===request.crop.width&&roi.h===request.crop.height&&roi.x+roi.w<=s.sourceFrame.width&&roi.y+roi.h<=s.sourceFrame.height,'ROIと撮影画像の対応が不正です');
 const featureMethod=request.featureMethod??'histogram';need(['histogram','dinov2'].includes(featureMethod),'特徴比較の方法が不正です');if(featureMethod==='dinov2')need(request.preset==='quick'&&request.variant!=='both','AI特徴比較は軽量・単一variant（最大64姿勢）で利用してください');
 if(s.featureMethod!==undefined||featureMethod==='dinov2')need(s.featureMethod===featureMethod,'撮影と比較方法の識別が一致しません');
 const sceneContext=normalizeSceneContext(request.sceneContext,s.sourceFrame),stampedScene=normalizeSceneContext(s.sceneContext,s.sourceFrame);need(JSON.stringify(sceneContext)===JSON.stringify(stampedScene),'撮影と操作画面の設定が一致しません');
 const variants=request.variant==='both'?['regular','_f']:[request.variant],viewCount=request.preset==='quick'?4:8,poseCount=request.preset==='quick'?4:7,maxTemplates=request.modelIds.length*variants.length*viewCount*poseCount;
 need(maxTemplates<=RECOGNITION_LIMITS.templates,'この組合せは描画予算を超えます。「軽量」にするかvariant・候補数を減らしてください');return{variants,viewCount,maxTemplates,featureMethod,sceneContext};
}
const poseBytes=model=>model.vertices.byteLength+model.indices.byteLength+model.materials.reduce((n,m)=>n+m.rgba.byteLength,0);
function unionBounds(poses){return {min:[0,1,2].map(k=>Math.min(...poses.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...poses.map(p=>p.bounds.max[k])))};}
export async function recognizeROI(request,{nitro,catalog,geometry,signal,onProgress=()=>{},getDino}){
 const plan=validateRecognitionRequest(request,catalog),start=performance.now(),renderer=new MonsterCPU(),bank=new MonsterTemplateBank(renderer,{maxCacheBytes:RECOGNITION_LIMITS.cacheBytes,maxEntries:32});let rendered=0;
 const maxMs=plan.featureMethod==='dinov2'?DINO_SPEC.maxMs:RECOGNITION_LIMITS.wallTimeMs;
 const guard=()=>{if(signal?.aborted)throw new DOMException('識別を中止しました','AbortError');if(performance.now()-start>maxMs)throw Error(`${maxMs/1000}秒の処理予算に達しました。候補数を減らして再試行してください`);};
 const unsupported=[],rankMap=new Map(),views=Array.from({length:plan.viewCount},(_,i)=>({yaw:i*Math.PI*2/plan.viewCount,pitch:Math.PI/4})),stamp=clone(request.captureStamp);let query,dino;
 const exclusion=getFieldExclusion(stamp,plan.sceneContext);
 try{
  guard();
  if(exclusion.excluded)return{schema:'dq9-experimental-rom-roi-ranking-v1',captureStamp:stamp,featureMethod:plan.featureMethod,metric:plan.featureMethod==='dinov2'?'cosine':'squared-distance',rankings:[],skipped:'central-field-exclusion',exclusion,unknown:{suggested:true,calibrated:false,reason:'主人公の中央領域と重なるため未観測・判別不能として扱います。敵がいない証拠ではありません'},coverage:{requestedModels:request.modelIds.length,completedModels:0,unsupported:[],renderedTemplates:0,requestedTemplateUpperBound:plan.maxTemplates,scope:'中央領域に重なる手動ROIは未観測'},elapsedMs:performance.now()-start,safeForHardPruning:false,automaticDetection:false,birthCertified:false,ATDrawsCertified:0,currentVideoStateRecovered:false};
  if(plan.featureMethod==='dinov2'){need(typeof getDino==='function','AIランタイムを準備してください');dino=await getDino();guard();onProgress({phase:'embed',done:0,total:plan.maxTemplates,message:'切り抜きのAI特徴を計算中'});query=await dino.encode(request.crop,{signal});guard();}else query=colorDescriptor(request.crop);
  for(const modelId of request.modelIds)for(const variant of plan.variants){guard();onProgress({phase:'decode',done:rendered,total:plan.maxTemplates,message:`${modelId} / ${variant} をROMから生成中`});await yieldTask();let asset,poses;
   try{
    asset=readMonsterAssets(nitro,catalog,[{modelId,variant}]).models[0];poses=[geometry.decode(asset)];const baseBytes=poseBytes(poses[0]);let bytes=baseBytes;need(bytes<=RECOGNITION_LIMITS.poseBytes,'モデルの姿勢データ予算を超えました');
    for(const clip of ['stand.nsbca','run.nsbca','appear.nsbca']){
     const raw=asset.animations.find(a=>a.name===clip);if(!raw){unsupported.push({modelId,variant,clip,reason:'ROM内に対象clipがありません'});continue;}
     try{const animation=readNSBCA(raw.bytes),frames=request.preset==='quick'?[Math.floor((animation.numFrames-1)/2)]:[0,Math.floor((animation.numFrames-1)/2)];
      for(const frame of [...new Set(frames)]){guard();need(bytes+baseBytes<=RECOGNITION_LIMITS.poseBytes,'モデルの姿勢データ予算を超えました');const poseSource={clip,frame,decoderVersion:'exact-nsbca-v1',exactStoredFrame:true};const model=geometry.decode(asset,{localMatrices:sampleMatrices(animation,frame),poseSource});bytes+=poseBytes(model);need(bytes<=RECOGNITION_LIMITS.poseBytes,'モデルの姿勢データ予算を超えました');poses.push(model);await yieldTask();}
     }catch(error){if(error.name==='AbortError')throw error;unsupported.push({modelId,variant,clip,reason:error.message});}
    }
    const bounds=unionBounds(poses);for(const model of poses)model.templateBounds=clone(bounds);
   }catch(error){if(error.name==='AbortError')throw error;unsupported.push({modelId,variant,reason:error.message});continue;}
   for(const model of poses){guard();let lease;try{
    lease=await bank.generate([model],{sessionKey:`rom-${request.romEpoch}`,views,tileSize:64,signal,candidateScope:'explicit',onProgress:p=>{guard();onProgress({phase:'render',done:plan.featureMethod==='dinov2'?rendered:rendered+p.completedViews,total:plan.maxTemplates,message:`${modelId} ${model.poseSource?.clip??'bind'} / 姿勢候補を照合中`});}});
    const atlas=lease.entries[0].atlas;
    for(const view of atlas.views){const thumbnail=cropRGBA(atlas,view.x,view.y,64,64),color=colorDescriptor(thumbnail,{template:true});if(color.empty)continue;guard();let similarity,distance;if(dino){const vector=await dino.encode(thumbnail,{template:true,cacheKey:`rom-${request.romEpoch}`,signal});guard();similarity=cosineSimilarity(query,vector);distance=1-similarity;onProgress({phase:'embed',done:rendered+atlas.views.indexOf(view)+1,total:plan.maxTemplates,message:`${modelId} のAI特徴を比較中`});}else distance=descriptorDistance(query,color);const previous=rankMap.get(modelId);if(!previous||distance<previous.distance)rankMap.set(modelId,{modelId,speciesCandidates:clone(model.speciesCandidates),distance,...(dino?{similarity}:{}),bestPose:{clip:model.poseSource?.clip??'bind',frame:model.poseSource?.frame??null,variant,yaw:view.yaw,pitch:view.pitch},thumbnail});}
    rendered+=views.length;
   }catch(error){if(error.name==='AbortError'||dino)throw error;unsupported.push({modelId,variant,clip:model.poseSource?.clip??'bind',frame:model.poseSource?.frame??null,reason:error.message});}finally{lease?.release();}await yieldTask();}
  }
  guard();const rankings=[...rankMap.values()].sort((a,b)=>a.distance-b.distance||a.modelId.localeCompare(b.modelId));
  return{schema:'dq9-experimental-rom-roi-ranking-v1',captureStamp:stamp,featureMethod:plan.featureMethod,metric:dino?'cosine':'squared-distance',...(dino?{inference:{...DINO_SPEC,cacheEntries:dino.cache?.size??0}}:{}),exclusion,rankings,unknown:{suggested:true,reason:!dino&&query.empty?'切り抜き内の不透明画素を確認できません':'距離の採否境界は未検証です。候補外の種・背景・UIを除外できません',calibrated:false},coverage:{requestedModels:request.modelIds.length,completedModels:rankings.length,unsupported,renderedTemplates:rendered,requestedTemplateUpperBound:plan.maxTemplates,scope:'手動ROI・選択モデル・指定variant・45度の仮カメラ・少数のROM姿勢候補のみ'},elapsedMs:performance.now()-start,descriptor:dino?'DINOv2-small quantized384-component CLS cosine over ROM poses; uncalibrated':'ROM-only 24-component hue/saturation histogram; deterministic bilinear48px, uncalibrated scene-specific foreground heuristic',safeForHardPruning:false,automaticDetection:false,birthCertified:false,ATDrawsCertified:0,currentVideoStateRecovered:false,limitations:['候補順と距離は実験値で、確率ではありません','画面から敵を自動検出しません。背景・UIの誤候補が残ります','照明・色・実カメラ・実animation位相は未再現です','同じモデルの種ID候補をすべて保持し、候補外の可能性も残します','出現・出生・AT消費や現在ATをこの結果から確定しません']};
 }finally{bank.destroy();renderer.destroy();}
}
