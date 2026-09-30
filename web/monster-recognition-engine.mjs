import {readMonsterAssets} from './monster-assets.mjs';
import {readNSBCA,sampleMatrices} from './monster-animation.mjs';
import {MonsterTemplateBank} from './monster-template-bank.mjs';
import {MonsterCPU} from './monster-cpu-template.mjs';
import {validateRGBA,colorDescriptor,descriptorDistance,cropRGBA} from './monster-roi-descriptor.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};const clone=x=>structuredClone(x);const yieldTask=()=>new Promise(r=>setTimeout(r,0));
export const RECOGNITION_LIMITS=Object.freeze({models:4,variants:8,templates:256,tileSize:64,poseBytes:8*1024*1024,cacheBytes:8*1024*1024,wallTimeMs:30000,roiPixels:1024*1024});
export function validateRecognitionRequest(request,catalog){
 need(request&&Array.isArray(request.modelIds)&&request.modelIds.length>=1&&request.modelIds.length<=4&&new Set(request.modelIds).size===request.modelIds.length,'候補モデルを1〜4種類選んでください');need(request.modelIds.every(id=>typeof id==='string'&&catalog.has(id)),'未登録のモデルです');need(['_f','regular','both'].includes(request.variant),'variantを明示してください');need(['quick','standard'].includes(request.preset),'探索設定が不正です');validateRGBA(request.crop);need(request.crop.width<=1024&&request.crop.height<=1024,'ROIの幅・高さは1024px以下にしてください');
 const s=request.captureStamp;need(s&&typeof s.sourceId==='string'&&s.sourceId&&Number.isSafeInteger(s.sourceEpoch)&&s.sourceEpoch>=0&&Number.isSafeInteger(s.timelineSegment)&&s.timelineSegment>=0&&Number.isSafeInteger(s.frameSerial)&&s.frameSerial>=0&&Number.isSafeInteger(s.romEpoch)&&s.romEpoch===request.romEpoch,'同一撮影・ROMの識別情報が必要です');need(s.sourceFrame&&Number.isInteger(s.sourceFrame.width)&&Number.isInteger(s.sourceFrame.height)&&s.sourceFrame.width>0&&s.sourceFrame.height>0&&s.sourceFrame.width<=4096&&s.sourceFrame.height<=4096,'元画像の寸法が不正です');
 const roi=s.enemyROI;need(roi&&[roi.x,roi.y,roi.w,roi.h].every(Number.isInteger)&&roi.x>=0&&roi.y>=0&&roi.w===request.crop.width&&roi.h===request.crop.height&&roi.x+roi.w<=s.sourceFrame.width&&roi.y+roi.h<=s.sourceFrame.height,'ROIと撮影画像の対応が不正です');
 const variants=request.variant==='both'?['regular','_f']:[request.variant],viewCount=request.preset==='quick'?4:8,poseCount=request.preset==='quick'?4:7,maxTemplates=request.modelIds.length*variants.length*viewCount*poseCount;
 need(maxTemplates<=RECOGNITION_LIMITS.templates,'この組合せは描画予算を超えます。「軽量」にするかvariant・候補数を減らしてください');return{variants,viewCount,maxTemplates};
}
const poseBytes=model=>model.vertices.byteLength+model.indices.byteLength+model.materials.reduce((n,m)=>n+m.rgba.byteLength,0);
function unionBounds(poses){return {min:[0,1,2].map(k=>Math.min(...poses.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...poses.map(p=>p.bounds.max[k])))};}
export async function recognizeROI(request,{nitro,catalog,geometry,signal,onProgress=()=>{}}){
 const plan=validateRecognitionRequest(request,catalog),start=performance.now(),renderer=new MonsterCPU(),bank=new MonsterTemplateBank(renderer,{maxCacheBytes:RECOGNITION_LIMITS.cacheBytes,maxEntries:32});let rendered=0;
 const guard=()=>{if(signal?.aborted)throw new DOMException('識別を中止しました','AbortError');if(performance.now()-start>RECOGNITION_LIMITS.wallTimeMs)throw Error('30秒の処理予算に達しました。軽量設定か少ない候補で再試行してください');};
 const unsupported=[],rankMap=new Map(),views=Array.from({length:plan.viewCount},(_,i)=>({yaw:i*Math.PI*2/plan.viewCount,pitch:Math.PI/4})),query=colorDescriptor(request.crop),stamp=clone(request.captureStamp);
 try{
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
    lease=await bank.generate([model],{sessionKey:`rom-${request.romEpoch}`,views,tileSize:64,signal,candidateScope:'explicit',onProgress:p=>{guard();onProgress({phase:'render',done:rendered+p.completedViews,total:plan.maxTemplates,message:`${modelId} ${model.poseSource?.clip??'bind'} / 姿勢候補を照合中`});}});
    const atlas=lease.entries[0].atlas;
    for(const view of atlas.views){const thumbnail=cropRGBA(atlas,view.x,view.y,64,64),descriptor=colorDescriptor(thumbnail,{template:true});if(descriptor.empty)continue;const distance=descriptorDistance(query,descriptor),previous=rankMap.get(modelId);if(!previous||distance<previous.distance)rankMap.set(modelId,{modelId,speciesCandidates:clone(model.speciesCandidates),distance,bestPose:{clip:model.poseSource?.clip??'bind',frame:model.poseSource?.frame??null,variant,yaw:view.yaw,pitch:view.pitch},thumbnail});}
    rendered+=views.length;
   }catch(error){if(error.name==='AbortError')throw error;unsupported.push({modelId,variant,clip:model.poseSource?.clip??'bind',frame:model.poseSource?.frame??null,reason:error.message});}finally{lease?.release();}await yieldTask();}
  }
  guard();const rankings=[...rankMap.values()].sort((a,b)=>a.distance-b.distance||a.modelId.localeCompare(b.modelId));
  return{schema:'dq9-experimental-rom-roi-ranking-v1',captureStamp:stamp,rankings,unknown:{suggested:true,reason:query.empty?'切り抜き内の不透明画素を確認できません':'距離の採否境界は未検証です。候補外の種・背景・UIを除外できません',calibrated:false},coverage:{requestedModels:request.modelIds.length,completedModels:rankings.length,unsupported,renderedTemplates:rendered,requestedTemplateUpperBound:plan.maxTemplates,scope:'手動ROI・選択モデル・指定variant・45度の仮カメラ・少数のROM姿勢候補のみ'},elapsedMs:performance.now()-start,descriptor:'ROM-only 24-component hue/saturation histogram; deterministic bilinear48px, uncalibrated scene-specific foreground heuristic',safeForHardPruning:false,automaticDetection:false,birthCertified:false,ATDrawsCertified:0,currentVideoStateRecovered:false,limitations:['候補順と距離は実験値で、確率ではありません','画面から敵を自動検出しません。背景・UIの誤候補が残ります','照明・色・実カメラ・実animation位相は未再現です','同じモデルの種ID候補をすべて保持し、候補外の可能性も残します','出現・出生・AT消費や現在ATをこの結果から確定しません']};
 }finally{bank.destroy();renderer.destroy();}
}
