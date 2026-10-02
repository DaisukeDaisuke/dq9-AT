/* ROM foreground patch correspondence. Location proposals remain experimental:
 * no species, absence, birth, or AT certification follows from these boxes.
 * The four selected models, their alpha, and source pixels are the only inputs. */
import {cropRGBA, validateRGBA} from '../../monster-roi-descriptor.mjs';
import {normalizeSceneContext} from '../../monster-field-mask.mjs';
import {extractAppearanceComponents} from './monster-position-proposals.mjs';

export const LOCAL_POSITION_REVISION = 'rom-foreground-patch-v5-cls-candidate';
// Development repair after Work7 failure analysis. Existing splits are known regression data; H5 is now known regression. Candidate remains unadopted.
export const LOCAL_POSITION_CONFIG = Object.freeze({seed:.50, minSeedPixels:24, part:.40, minParts:6, minMean:.40, negativeWeight:.35, maxProposals:8, fineMaxHeight:32, fineMinPixels:20, fineSeed:.37});
const tiles = Object.freeze([{x:0,y:0,w:160,h:128},{x:96,y:0,w:160,h:128},{x:0,y:64,w:160,h:128},{x:96,y:64,w:160,h:128}]);
const need=(v,m)=>{if(!v)throw Error(m);};
const abort=s=>{if(s?.aborted)throw new DOMException('中止','AbortError');};
const dot=(a,b)=>{let s=0;for(let k=0;k<384;k++)s+=a[k]*b[k];return s;};
const select=(a,n)=>Array.from({length:Math.min(n,a.length)},(_,i)=>a[Math.floor((i+.5)*a.length/Math.min(n,a.length))]);
const overlap=(a,b)=>{const i=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return i/(a.w*a.h+b.w*b.h-i);};
const sourceRect=(r,g)=>{const x=g.x+Math.floor(r.x*g.w/256),y=g.y+Math.floor(r.y*g.h/192);return{x,y,w:g.x+Math.ceil((r.x+r.w)*g.w/256)-x,h:g.y+Math.ceil((r.y+r.h)*g.h/192)-y};};

/** Tight bounds and foreground support come exclusively from rendered ROM alpha. */
export async function encodeForegroundReference(image, metadata, backend, {signal}={}) {
  validateRGBA(image);abort(signal);let x0=image.width,y0=image.height,x1=0,y1=0;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.rgba[(y*image.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
  need(x1>x0&&y1>y0,'ROM参照に不透明な身体がありません');
  const tight=cropRGBA(image,x0,y0,x1-x0,y1-y0),grid=await backend.encodePatchGrid(tight,{signal}),g=grid.geometry,positive=[],negative=[];
  abort(signal);
  for(let j=0;j<256;j++){
    const px=j%16,py=Math.floor(j/16);let alpha=0;
    for(const dy of [2,7,12])for(const dx of [2,7,12]){
      const x=Math.floor((px*14+dx-g.padX)*tight.width/g.resizedWidth),y=Math.floor((py*14+dy-g.padY)*tight.height/g.resizedHeight);
      if(x>=0&&x<tight.width&&y>=0&&y<tight.height&&tight.rgba[(y*tight.width+x)*4+3]>=128)alpha++;
    }
    const p={x:(px*14+7-g.padX)/g.resizedWidth,y:(py*14+7-g.padY)/g.resizedHeight,vector:grid.patches.slice(j*384,(j+1)*384)};
    if(alpha/9>=.6)positive.push(p);else if(alpha===0)negative.push(p);
  }
  need(positive.length>=6&&negative.length,'ROM前景・背景patchの支持が不足しています');
  const pp=select(positive,12),nn=select(negative,8),mean=new Float32Array(384);
  for(let k=0;k<384;k++)mean[k]=nn.reduce((s,p)=>s+p.vector[k],0)/nn.length;
  const norm=Math.hypot(...mean);for(let k=0;k<384;k++)mean[k]/=norm;
  return {...metadata,cls:grid.cls.slice(),positives:pp,negative:mean,aspect:tight.width/tight.height,alphaBounds:{x:x0,y:y0,w:tight.width,h:tight.height},timings:grid.timings};
}
export function indexLocalBank(references, identity={}) {
  need(references.length===64,'初期4モデル・64姿勢の前景patchが必要です');
  const models={};for(const ref of references){const b=models[ref.modelId]??=( {positives:[],negatives:[]} );b.positives.push(...ref.positives.map(p=>p.vector));b.negatives.push(ref.negative);}
  need(Object.keys(models).length===4,'4モデルを準備してください');
  return{revision:LOCAL_POSITION_REVISION,...identity,references,models};
}
/** Four overlapping 160×128 tiles keep small bodies at useful model resolution. */
export async function encodePositionTiles(frame,backend,{signal,onProgress=()=>{}}={}) {
  const encoded=[];
  for(const tile of tiles){abort(signal);onProgress({phase:'position-inference',done:encoded.length,total:4,message:'ゲーム画面の局所特徴を計算中'});const grid=await backend.encodePatchGrid(cropRGBA(frame,tile.x,tile.y,tile.w,tile.h),{signal});encoded.push({tile,geometry:grid.geometry,patches:grid.patches,timings:grid.timings});}
  return encoded;
}
export function positionScoreMaps(encoded,bank,{signal}={}) {
  const maps=Object.fromEntries(Object.keys(bank.models).map(m=>[m,new Float32Array(256*192).fill(-1)]));
  for(const t of encoded){abort(signal);const a=t.tile,g=t.geometry;
    for(let j=0;j<256;j++){
      const px=j%16,py=Math.floor(j/16),cx=(px*14+7-g.padX)*a.w/g.resizedWidth,cy=(py*14+7-g.padY)*a.h/g.resizedHeight;
      if(cx<0||cx>=a.w||cy<0||cy>=a.h)continue;
      const vector=t.patches.subarray(j*384,(j+1)*384),x0=Math.max(0,a.x+Math.floor((px*14-g.padX)*a.w/g.resizedWidth)),y0=Math.max(0,a.y+Math.floor((py*14-g.padY)*a.h/g.resizedHeight)),x1=Math.min(256,a.x+Math.ceil(((px+1)*14-g.padX)*a.w/g.resizedWidth)),y1=Math.min(192,a.y+Math.ceil(((py+1)*14-g.padY)*a.h/g.resizedHeight));
      for(const[m,b]of Object.entries(bank.models)){
        let positive=-1,negative=-1;for(const p of b.positives)positive=Math.max(positive,dot(vector,p));for(const p of b.negatives)negative=Math.max(negative,dot(vector,p));
        const score=positive-LOCAL_POSITION_CONFIG.negativeWeight*Math.max(0,negative),map=maps[m];
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)map[y*256+x]=Math.max(map[y*256+x],score);
      }
    }
  }return maps;
}
function spatialEvidence(r,modelId,encoded,bank) {
  let best=null;
  for(const ref of bank.references.filter(r=>r.modelId===modelId)){
    const scores=ref.positives.map(p=>{
      const x=r.x+p.x*r.w,y=r.y+p.y*r.h;let score=-1;
      for(const t of encoded){const a=t.tile,g=t.geometry;if(x<a.x||x>=a.x+a.w||y<a.y||y>=a.y+a.h)continue;
        const px=Math.floor(((x-a.x)*g.resizedWidth/a.w+g.padX)/14),py=Math.floor(((y-a.y)*g.resizedHeight/a.h+g.padY)/14);if(px<0||px>=16||py<0||py>=16)continue;
        const v=t.patches.subarray((py*16+px)*384,(py*16+px+1)*384);score=Math.max(score,dot(v,p.vector)-LOCAL_POSITION_CONFIG.negativeWeight*Math.max(0,dot(v,ref.negative)));
      }return{score,x:p.x,y:p.y};
    });
    const supported=scores.filter(p=>p.score>=LOCAL_POSITION_CONFIG.part),mean=scores.reduce((n,p)=>n+p.score,0)/scores.length,vertical=new Set(supported.map(p=>Math.min(2,Math.floor(p.y*3)))).size,horizontal=new Set(supported.map(p=>p.x>=.5?1:0)).size;
    const evidence={modelId,referenceId:ref.id,mean,support:supported.length,parts:scores.length,vertical,horizontal,score:mean+.05*supported.length/scores.length};
    if(!best||evidence.score>best.score)best=evidence;
  }return best;
}
const roiKey=r=>`${r.x},${r.y},${r.w},${r.h}`;
function peakInROI(r,maps) {
  let peak=-1;for(const map of Object.values(maps))for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)peak=Math.max(peak,map[y*256+x]);return peak;
}
/** Automatic promising components are re-encoded at body resolution. The alpha is
 * the image-derived chroma mask, never a human label or ROM projected mask. */
export async function encodeSmallComponents(seeds,maps,backend,{signal,onProgress=()=>{}}={}) {
  const selected=seeds.components.filter(c=>c.foregroundPixels>=LOCAL_POSITION_CONFIG.fineMinPixels&&peakInROI(c.coreROI,maps)>=LOCAL_POSITION_CONFIG.fineSeed),grids=new Map();
  for(const c of selected){abort(signal);const r=c.coreROI,image=cropRGBA(seeds.frame,r.x,r.y,r.w,r.h);
    for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++)image.rgba[(y*r.w+x)*4+3]=seeds.mask[(r.y+y)*256+r.x+x]?255:0;
    onProgress({phase:'position-refinement',done:grids.size,total:selected.length,message:'前景の身体支持を確認中'});
    grids.set(roiKey(r),await backend.encodePatchGrid(image,{signal}));
  }return grids;
}
function fineEvidence(grid,bank) {
  const g=grid.geometry;let best=null;
  for(const ref of bank.references){
    const scores=ref.positives.map(p=>{const px=Math.max(0,Math.min(15,Math.floor((p.x*g.resizedWidth+g.padX)/14))),py=Math.max(0,Math.min(15,Math.floor((p.y*g.resizedHeight+g.padY)/14))),v=grid.patches.subarray((py*16+px)*384,(py*16+px+1)*384);return{...p,score:dot(v,p.vector)-LOCAL_POSITION_CONFIG.negativeWeight*Math.max(0,dot(v,ref.negative))};});
    const supported=scores.filter(p=>p.score>=LOCAL_POSITION_CONFIG.part),mean=scores.reduce((s,p)=>s+p.score,0)/scores.length,evidence={modelId:ref.modelId,referenceId:ref.id,mean,support:supported.length,parts:scores.length,vertical:new Set(supported.map(p=>Math.min(2,Math.floor(p.y*3)))).size,horizontal:new Set(supported.map(p=>p.x>=.5?1:0)).size,score:mean+.05*supported.length/scores.length,refined:true};
    if(!best||mean>best.mean)best=evidence;
  }return best;
}
/** Geometry is generated across the whole native field, before semantic verification.
 * Alpha-supported part correspondence and background contrast reject chance hits.
 * Color connectivity still limits this first version on non-blue fields/gray bodies. */
export function localPositionFromTiles(image,captureStamp,bank,encoded,{signal,geometrySeeds,maps,fineGrids}={}) {
  abort(signal);validateRGBA(image,4096*4096);need(image.width===captureStamp.sourceFrame.width&&image.height===captureStamp.sourceFrame.height,'位置入力とcapture寸法が一致しません');
  const scene=normalizeSceneContext(captureStamp.sceneContext,captureStamp.sourceFrame),base={schema:'dq9-enemy-roi-proposals-v1',revision:LOCAL_POSITION_REVISION,profile:'rom-local-v1',captureStamp:structuredClone(captureStamp),proposals:[],excluded:[],safeForHardPruning:false,enemyIdentityCertified:false,birthCertified:false,ATDrawsCertified:0,unknown:{suggested:true,calibrated:false,reason:'ROM-supported location only; missing/partial/unknown enemies remain possible.'}};
  if(scene.kind!=='field')return{...base,skipped:'field-scene-required'};
  const seeds=geometrySeeds??extractAppearanceComponents(image,scene.gameplayROI,{splitOversized:true}),scores=maps??positionScoreMaps(encoded,bank,{signal}),raw=[],rejected=[];
  for(const c of seeds.components){abort(signal);const r=c.coreROI;let best=null;
    for(const[m,map]of Object.entries(scores)){
      let peak=-1,strong=0;for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){peak=Math.max(peak,map[y*256+x]);strong+=map[y*256+x]>=LOCAL_POSITION_CONFIG.seed;}
      if(peak<LOCAL_POSITION_CONFIG.seed||strong<LOCAL_POSITION_CONFIG.minSeedPixels)continue;
      const spatial=spatialEvidence(r,m,encoded,bank),evidence={...spatial,peak,strong};if(!best||evidence.score>best.score)best=evidence;
    }
    const coherent=e=>e&&e.mean>=LOCAL_POSITION_CONFIG.minMean&&e.support>=LOCAL_POSITION_CONFIG.minParts&&e.horizontal>=2&&(e.vertical>=3||(e.refined&&e.vertical>=2&&e.support>=8));
    if(!coherent(best)&&fineGrids?.has(roiKey(r))){const fine=fineEvidence(fineGrids.get(roiKey(r)),bank);if(coherent(fine))best={...fine,peak:peakInROI(r,scores),strong:null};else{rejected.push({nativeROI:r,reason:'incoherent-small-body-parts',evidence:fine,coarseEvidence:best});continue;}}
    if(!best){rejected.push({nativeROI:r,reason:'no-foreground-patch-seed'});continue;}
    if(!coherent(best)){rejected.push({nativeROI:r,reason:'incoherent-reference-parts',evidence:best});continue;}
    const roi=sourceRect(r,scene.gameplayROI);raw.push({roi,nativeROI:{...r},component:{...c},priority:best.score,edgeMean:0,classificationEligible:roi.w<=1024&&roi.h<=1024,classificationStatus:'unverified',unknown:true,clipped:r.x===0||r.y===0||r.x+r.w===256||r.y+r.h===192,proposalSource:'rom-foreground-patch',detectionEvidence:best,screenPosition:{x:roi.x+roi.w/2,y:roi.y+roi.h,basis:'foreground-body-box-bottom-center',calibrated:false}});
  }
  raw.sort((a,b)=>b.priority-a.priority||a.roi.y-b.roi.y||a.roi.x-b.roi.x);const distinct=[];
  for(const p of raw){if(distinct.some(q=>overlap(p.nativeROI,q.nativeROI)>.35)){rejected.push({nativeROI:p.nativeROI,reason:'duplicate-body'});continue;}distinct.push(p);}
  return{...base,rawCandidates:distinct,proposals:distinct.slice(0,8).map((p,i)=>({...p,proposalId:`${captureStamp.frameSerial}:${i}`})),rejected,coverage:{geometryComponents:seeds.components.length,candidateComponents:distinct.length,retainedCandidates:Math.min(8,distinct.length),budgetDropped:Math.max(0,distinct.length-8),absenceCertified:false},trackingFrame:{width:256,height:192,gray:seeds.gray,mask:seeds.mask,blocked:seeds.blocked,identity:JSON.stringify({sourceId:captureStamp.sourceId,sourceEpoch:captureStamp.sourceEpoch,timelineSegment:captureStamp.timelineSegment,sceneContext:scene,profile:'rom-local-v1'})}};
}
// Reuse the pre-existing Work1 B0 D1 gate without fitting to the inspected frames.
// This is a visual candidate filter only; no enemy absence/species/AT certification.
export async function verifyPositionAppearance(image,result,bank,backend,{signal,onProgress=()=>{}}={}) {
  need(bank.references.every(r=>r.cls?.length===384),'ROM CLS reference vectors must be prepared with the candidate bank');
  const candidates=result.proposals,accepted=[],rejected=[];
  for(let i=0;i<candidates.length;i++){
    abort(signal);const p=candidates[i],r=p.roi;
    onProgress({phase:'position-verification',done:i,total:candidates.length,message:'敵枠の画像全体をROM参照と照合中'});
    const vector=await backend.encode(cropRGBA(image,r.x,r.y,r.w,r.h),{signal}),ranking=Object.keys(bank.models).map(modelId=>({modelId,score:Math.max(...bank.references.filter(x=>x.modelId===modelId).map(x=>dot(vector,x.cls)))})).sort((a,b)=>b.score-a.score||a.modelId.localeCompare(b.modelId));
    const evidence={score:ranking[0].score,margin:ranking[0].score-ranking[1].score,ranking,gate:'work1-B0-D1-score0.45-margin0.05',calibratedForThisPipeline:false};
    if(evidence.score>=.45&&evidence.margin>=.05)accepted.push({...p,appearanceVerification:evidence});
    else rejected.push({...p,appearanceVerification:evidence,reason:'appearance-inconclusive'});
  }
  return {...result,positionCandidates:candidates,proposals:accepted,classifierRejected:rejected,coverage:{...result.coverage,appearanceChecked:candidates.length,appearanceRetained:accepted.length,retainedCandidates:accepted.length,appearanceRejected:rejected.length,absenceCertified:false}};
}
export async function proposeLocalEnemyROIs(image,captureStamp,{backend,bank,signal,onProgress}={}) {
  const start=performance.now(),scene=normalizeSceneContext(captureStamp.sceneContext,captureStamp.sourceFrame);need(scene.kind==='field','フィールドを指定してください');need(Math.abs(scene.gameplayROI.w/scene.gameplayROI.h-4/3)<.04,'4:3ゲーム画面を指定してください');
  need(bank.romEpoch===captureStamp.romEpoch&&bank.identity===backend.identity,'位置参照のROM・推論方式が一致しません');
  const seeds=extractAppearanceComponents(image,scene.gameplayROI,{splitOversized:true}),preprocessMs=performance.now()-start,encoded=await encodePositionTiles(seeds.frame,backend,{signal,onProgress}),tileEnd=performance.now(),maps=positionScoreMaps(encoded,bank,{signal}),mapEnd=performance.now(),fineGrids=await encodeSmallComponents(seeds,maps,backend,{signal,onProgress}),inferredAt=performance.now(),result=localPositionFromTiles(image,captureStamp,bank,encoded,{signal,geometrySeeds:seeds,maps,fineGrids});
  const positionEnd=performance.now(),verified=await verifyPositionAppearance(image,result,bank,backend,{signal,onProgress}),finish=performance.now();return{...verified,timings:{preprocessMs,inferenceAndReadbackMs:tileEnd-start-preprocessMs+inferredAt-mapEnd,postprocessMs:mapEnd-tileEnd+positionEnd-inferredAt,appearanceVerificationMs:finish-positionEnd,tiles:encoded.map(t=>t.timings),smallComponents:[...fineGrids.values()].map(t=>t.timings),totalMs:finish-start},elapsedMs:finish-start};
}
