/* Private coarse ROI complement. No new graph, weights, classifier, training, or AT inference. */
import {normalizeSceneContext,getFieldExclusion} from './monster-field-mask.mjs';
import {validateRGBA,cropRGBA} from './monster-roi-descriptor.mjs';
const need=(v,m)=>{if(!v)throw Error(m);},clone=v=>structuredClone(v),abort=s=>{if(s?.aborted)throw new DOMException('Dense ROI preparation canceled','AbortError');};
export const DENSE_REVISION='dino-top16-components-spare8-v1-private';
const area=r=>r.w*r.h,inter=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)),overlap=(a,b)=>inter(a,b)>0;
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const stampKey=s=>JSON.stringify(canonical(Object.fromEntries(['sourceId','sourceEpoch','timelineSegment','frameSerial','romEpoch','sourceFrame','videoTime','timestampBasis','capturedAt','enemyROI','featureMethod','inferenceBackend','sceneContext'].map(k=>[k,s?.[k]??null]))));
function sceneFor(s){
 need(s&&typeof s.sourceId==='string'&&s.sourceId.length>0,'Capture source required');for(const k of['sourceEpoch','timelineSegment','frameSerial','romEpoch'])need(Number.isSafeInteger(s[k])&&s[k]>=0,`Invalid capture ${k}`);
 need(s.sourceFrame&&[s.sourceFrame.width,s.sourceFrame.height].every(x=>Number.isInteger(x)&&x>0&&x<=4096),'Invalid source bounds');
 need(s.featureMethod==='dinov2'&&['wasm','webgpu'].includes(s.inferenceBackend),'Explicit DINO provider required');
 need((s.videoTime===null&&s.timestampBasis==='local-image')||(Number.isFinite(s.videoTime)&&s.videoTime>=0),'Invalid capture time');
 const scene=normalizeSceneContext(s.sceneContext,s.sourceFrame);need(scene.kind==='field'&&scene.excludeCenter,'Explicit field scene and center mask required');const g=scene.gameplayROI;
 need(g.w*3===g.h*4,'Dense v1 requires an exact4:3 gameplay crop');need(g.w<=1024&&g.h<=1024&&g.w*g.h<=1024*1024,'Dense gameplay crop exceeds1024px/1M-pixel limit');return scene;
}
function validROI(r,g){return r&&['x','y','w','h'].every(k=>Number.isInteger(r[k]))&&r.w>0&&r.h>0&&r.x>=g.x&&r.y>=g.y&&r.x+r.w<=g.x+g.w&&r.y+r.h<=g.y+g.h;}
function masksFor(s,scene){const g=scene.gameplayROI,center=getFieldExclusion({...s,enemyROI:null},scene).mask,x=g.x+Math.floor(212*g.w/256);return[center,{x,y:g.y,w:g.x+g.w-x,h:Math.ceil(39*g.h/192)}];}
function trim(padded,core,masks){const r={...padded};for(const m of masks){if(!overlap(r,m))continue;if(overlap(core,m))return null;if(core.x+core.w<=m.x)r.w=Math.min(r.x+r.w,m.x)-r.x;else if(core.x>=m.x+m.w){const end=r.x+r.w;r.x=Math.max(r.x,m.x+m.w);r.w=end-r.x;}else if(core.y+core.h<=m.y)r.h=Math.min(r.y+r.h,m.y)-r.y;else if(core.y>=m.y+m.h){const end=r.y+r.h;r.y=Math.max(r.y,m.y+m.h);r.h=end-r.y;}}return r.w>0&&r.h>0?r:null;}
function checkBank(bank,identity,{romSHA256,romEpoch}={}){need(Number.isSafeInteger(bank?.romEpoch)&&bank.romEpoch>=0,'Pose bank ROM epoch required');if(romSHA256!==undefined)need(bank.romSHA256===romSHA256,'Pose bank belongs to a different ROM');if(romEpoch!==undefined)need(bank.romEpoch===romEpoch,'Pose bank belongs to a different ROM epoch');need(bank?.identity===identity&&/^[a-f0-9]{64}$/.test(bank.romSHA256??''),'Pose bank model/provider/ROM identity mismatch');need(Array.isArray(bank.vectors)&&bank.vectors.length===64,'The complete existing64-pose bank is required');for(const v of bank.vectors){need(v instanceof Float32Array&&v.length===384&&v.every(Number.isFinite),'Invalid pose vector');let norm=0;for(const x of v)norm+=x*x;need(Math.abs(norm-1)<.001,'Pose vector must already be normalized');}}
/** Copy only the existing bank, with unchanged original cache keys. No generation or writes. */
export function snapshotPoseBank(backend,romSHA256,romEpoch){need(backend&&typeof backend.identity==='string'&&backend.cache instanceof Map,'Existing classifier backend required');need(/^[a-f0-9]{64}$/.test(romSHA256??''),'ROM SHA256 required');const entries=[...backend.cache].filter(([key])=>key.startsWith(`${backend.identity}:${romSHA256}:`));const bank={identity:backend.identity,romSHA256,romEpoch,keys:entries.map(([key])=>key),vectors:entries.map(([,v])=>v.slice())};checkBank(bank,backend.identity);return bank;}
/** Pure fixed rule:256normalized patches → ≤8 windows; class labels are never emitted. */
export function patchWindows(features,bank,captureStamp){
 const started=performance.now(),scene=sceneFor(captureStamp),g=scene.gameplayROI,masks=masksFor(captureStamp,scene);checkBank(bank,features?.identity,{romEpoch:captureStamp.romEpoch});
 need(features.grid?.rows===16&&features.grid?.columns===16&&features.grid?.patchSize===14,'Invalid patch grid');const shape=features.geometry;
 need(shape?.sourceWidth===g.w&&shape?.sourceHeight===g.h&&shape.inputSize===224&&shape.resizedWidth===224&&shape.resizedHeight===168&&shape.padX===0&&shape.padY===28,'Patch preprocessing geometry mismatch');
 need(features.spec?.provider===captureStamp.inferenceBackend,'Patch provider differs from capture stamp');const patches=features.patches;need(patches instanceof Float32Array&&patches.length===256*384&&patches.every(Number.isFinite),'Invalid patch values');
 for(let i=0;i<256;i++){let norm=0;for(let k=0;k<384;k++)norm+=patches[i*384+k]**2;need(Math.abs(norm-1)<.001,'Patch features must be normalized');}
 const cellBox=(row,column)=>{const x=g.x+Math.floor(column*g.w/16),y=g.y+Math.floor((row-2)*g.h/12),x1=g.x+Math.ceil((column+1)*g.w/16),y1=g.y+Math.ceil((row-1)*g.h/12);return{x,y,w:x1-x,h:y1-y};};
 const cells=[];for(let row=2;row<14;row++)for(let column=0;column<16;column++){const roi=cellBox(row,column);if(masks.some(m=>overlap(roi,m)))continue;let score=-Infinity;for(const v of bank.vectors){let sum=0;for(let k=0;k<384;k++)sum+=patches[(row*16+column)*384+k]*v[k];score=Math.max(score,sum);}cells.push({row,column,score,roi});}
 cells.sort((a,b)=>b.score-a.score||a.row-b.row||a.column-b.column);const selected=new Map(cells.slice(0,16).map(c=>[c.row*16+c.column,c])),groups=[];
 while(selected.size){const first=selected.keys().next().value,queue=[selected.get(first)],group=[];selected.delete(first);while(queue.length){const c=queue.pop();group.push(c);for(const[r,col]of[[c.row-1,c.column],[c.row+1,c.column],[c.row,c.column-1],[c.row,c.column+1]]){if(r<2||r>=14||col<0||col>=16)continue;const key=r*16+col;if(selected.has(key)){queue.push(selected.get(key));selected.delete(key);}}}
  const x=Math.min(...group.map(c=>c.roi.x)),y=Math.min(...group.map(c=>c.roi.y)),x1=Math.max(...group.map(c=>c.roi.x+c.roi.w)),y1=Math.max(...group.map(c=>c.roi.y+c.roi.h)),core={x,y,w:x1-x,h:y1-y};if(masks.some(m=>overlap(core,m)))continue;
  const pad=Math.ceil(g.w/64),px=Math.max(g.x,x-pad),py=Math.max(g.y,y-pad),padded={x:px,y:py,w:Math.min(g.x+g.w,x1+pad)-px,h:Math.min(g.y+g.h,y1+pad)-py},roi=trim(padded,core,masks);if(!roi||area(roi)>area(g)*.25)continue;
  need(validROI(roi,g)&&masks.every(m=>!overlap(roi,m)),'Dense bounds/mask invariant failed');groups.push({roi,coreROI:core,peakScore:Math.max(...group.map(c=>c.score)),cellCount:group.length});
 }
 groups.sort((a,b)=>b.peakScore-a.peakScore||a.coreROI.y-b.coreROI.y||a.coreROI.x-b.coreROI.x);const proposals=groups.slice(0,8).map((p,i)=>({...p,proposalId:`dense:${captureStamp.frameSerial}:${i}`,source:'frozen-dino-patch-cue',classificationEligible:true,classificationStatus:'unverified-current-pixels-required',unknown:true,screenPosition:{x:p.roi.x+p.roi.w/2,y:p.roi.y+p.roi.h,basis:'proposal-box-bottom-center',calibrated:false}}));
 return{revision:DENSE_REVISION,captureStamp:clone(captureStamp),proposals,rankingMs:performance.now()-started,featureIdentity:features.identity,poseBankROM:bank.romSHA256,poseBankEpoch:bank.romEpoch,unknown:{suggested:true,calibrated:false,reason:'Patch ranking is neither objectness nor species identity. Existing classifier must inspect original pixels.'},safeForHardPruning:false,birthCertified:false,ATDrawsCertified:0,absenceCertified:false};
}
export function fuseDenseProposals(current,dense){
 const scene=sceneFor(current?.captureStamp),g=scene.gameplayROI;sceneFor(dense?.captureStamp);need(stampKey(current.captureStamp)===stampKey(dense?.captureStamp)&&dense?.poseBankEpoch===current.captureStamp.romEpoch,'Dense result belongs to a stale capture/ROM');need(Array.isArray(current.proposals)&&current.proposals.length<=8&&Array.isArray(dense.proposals)&&dense.proposals.length<=8,'Proposal budget must be at most8');const masks=masksFor(current.captureStamp,scene);
 for(const p of[...current.proposals,...dense.proposals])need(validROI(p.roi,g)&&masks.every(m=>!overlap(p.roi,m)),'Candidate bounds/mask mismatch');const proposals=current.proposals.map(clone),added=[];
 for(const p of dense.proposals){if(proposals.length===8)break;if(proposals.some(q=>{const n=inter(q.roi,p.roi);return n/(area(q.roi)+area(p.roi)-n)>=.25||n/area(p.roi)>=.8;}))continue;const owned=clone(p);proposals.push(owned);added.push(owned.proposalId);}
 return{...current,captureStamp:clone(current.captureStamp),proposals,denseAdded:added,denseRevision:DENSE_REVISION,unknown:{suggested:true,calibrated:false,reason:'CPU and patch candidates may include player, background and UI. No automatic enemy acceptance.'},safeForHardPruning:false,birthCertified:false,ATDrawsCertified:0,absenceCertified:false};
}
/** Validate before preparing any ROM bank or encoder. No pixels are allocated here. */
export function validateDenseComplement(image,current){
 validateRGBA(image,4096*4096);const stamp=current?.captureStamp,scene=sceneFor(stamp),g=scene.gameplayROI;
 need(image.width===stamp.sourceFrame.width&&image.height===stamp.sourceFrame.height,'Source pixels differ from capture geometry');
 need(Array.isArray(current.proposals)&&current.proposals.length<=8,'CPU candidate budget exceeded');
 const masks=masksFor(stamp,scene);for(const p of current.proposals)need(validROI(p.roi,g)&&masks.every(m=>!overlap(p.roi,m)),'CPU candidate bounds/mask mismatch');return scene;
}
/** Caller supplies a synchronous current-capture getter; copied gameplay pixels survive async inference. */
export async function proposeDenseComplement(image,current,{backend,poseBank,romSHA256,signal,getCurrentCaptureStamp}={}){
 abort(signal);validateRGBA(image,4096*4096);need(typeof getCurrentCaptureStamp==='function','Current-capture guard required');const stamp=clone(current?.captureStamp),scene=sceneFor(stamp),g=scene.gameplayROI;
 need(image.width===stamp.sourceFrame.width&&image.height===stamp.sourceFrame.height,'Source pixels differ from capture geometry');need(Array.isArray(current.proposals)&&current.proposals.length<=8,'CPU candidate budget exceeded');
 const masks=masksFor(stamp,scene);for(const p of current.proposals)need(validROI(p.roi,g)&&masks.every(m=>!overlap(p.roi,m)),'CPU candidate bounds/mask mismatch');
 const fresh=()=>{abort(signal);const now=getCurrentCaptureStamp();try{sceneFor(now);}catch{throw new DOMException('Current dense capture is invalid or stale','AbortError');}if(stampKey(stamp)!==stampKey(now))throw new DOMException('Dense result belongs to a stale capture','AbortError');};fresh();
 if(current.proposals.length===8)return{...clone(current),denseAdded:[],denseSkipped:'cpu-budget-full'};
 need(typeof backend?.encodePatchGrid==='function','Patch-capable existing DINO backend required');need(/^[a-f0-9]{64}$/.test(romSHA256??''),'Current ROM SHA256 required');checkBank(poseBank,backend.identity,{romSHA256,romEpoch:stamp.romEpoch});const ownedBank=clone(poseBank);
 const ownedCurrent=clone(current);delete ownedCurrent.trackingFrame;const gameplayPixels=cropRGBA(image,g.x,g.y,g.w,g.h);fresh();const features=await backend.encodePatchGrid(gameplayPixels,{signal});fresh();
 checkBank(ownedBank,backend.identity,{romSHA256,romEpoch:stamp.romEpoch});const dense=patchWindows(features,ownedBank,stamp);fresh();return{...fuseDenseProposals(ownedCurrent,dense),denseTimings:{...features.timings,rankingMs:dense.rankingMs},denseCandidates:dense.proposals.length};
}
