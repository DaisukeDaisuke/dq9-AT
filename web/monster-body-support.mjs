// Conditional rendered-body comparison. This is not a calibrated detector.
// The null hypothesis is the same frozen ROM background. No threshold is trained.
const need=(v,m)=>{if(!v)throw Error(m);};
export function fitRenderedBody(template,evidence){
 const {width:W,height:H,videoRGBA,backgroundRGBA,validMask,region}=evidence;
 need(Number.isSafeInteger(W)&&Number.isSafeInteger(H)&&W>0&&H>0&&W*H<=49152&&videoRGBA?.length===W*H*4&&backgroundRGBA?.length===W*H*4&&validMask?.length===W*H,'Matching frozen native frame buffers required');
 const q=region.roi;need(q&&[q.x,q.y,q.w,q.h].every(Number.isInteger)&&q.w>0&&q.h>0&&q.x>=0&&q.y>=0&&q.x+q.w<=W&&q.y+q.h<=H,'Residual ROI outside native frame');
 const {width:tw,height:th,rgba}=template;need(rgba?.length===tw*th*4&&tw*th<=16384,'Bounded RGBA template required');
 let x0=tw,y0=th,x1=-1,y1=-1;for(let y=0;y<th;y++)for(let x=0;x<tw;x++)if(rgba[(y*tw+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x1<0)return null;
 const bw=x1-x0+1,bh=y1-y0+1,scales=[q.w/bw,q.h/bh,Math.sqrt(q.w*q.h/(bw*bh))],fits=[];
 // Fit both observed extents and their geometric mean. One native-pixel
 // translation uncertainty is evaluated symmetrically, independent of map/species.
 for(const scale of new Set(scales))for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const box={x:q.x+(q.w-bw*scale)/2+dx,y:q.y+(q.h-bh*scale)/2+dy,w:bw*scale,h:bh*scale},left=Math.max(0,Math.floor(Math.min(q.x,box.x))),top=Math.max(0,Math.floor(Math.min(q.y,box.y))),right=Math.min(W,Math.ceil(Math.max(q.x+q.w,box.x+box.w))),bottom=Math.min(H,Math.ceil(Math.max(q.y+q.h,box.y+box.h)));
  let nullSSE=0,bodySSE=0,known=0,inside=0,unknown=0,knownBodyPixels=0,spatialSupportRank=0,firstPoint=null,secondPoint=null;const runs=[];let runStart=-1,last=-2;
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const i=y*W+x,tx=Math.floor((x+.5-box.x)/scale+x0),ty=Math.floor((y+.5-box.y)/scale+y0),j=(ty*tw+tx)*4,a=tx>=x0&&tx<=x1&&ty>=y0&&ty<=y1?rgba[j+3]/255:0;
   if(a>0){inside++;if(i!==last+1){if(runStart>=0)runs.push([runStart,last-runStart+1]);runStart=i;}last=i;}
   if(!validMask[i]){unknown++;continue;}known++;if(a>0){knownBodyPixels++;if(!firstPoint)firstPoint={x,y};else if(!secondPoint){secondPoint={x,y};spatialSupportRank=1;}else if((secondPoint.x-firstPoint.x)*(y-firstPoint.y)!==(secondPoint.y-firstPoint.y)*(x-firstPoint.x))spatialSupportRank=2;}
   for(let c=0;c<3;c++){const v=videoRGBA[i*4+c],b=backgroundRGBA[i*4+c],rendered=a?b*(1-a)+rgba[j+c]*a:b;nullSSE+=(v-b)**2;bodySSE+=(v-rendered)**2;}
  }
  if(runStart>=0)runs.push([runStart,last-runStart+1]);if(!known||!inside)continue;
  const gain=nullSSE-bodySSE;fits.push({bodyROI:box,bodyMaskRuns:runs,templateTightROI:{x:x0,y:y0,w:bw,h:bh},scale,translationPixels:{dx,dy},backgroundSSE:nullSSE,renderedBodySSE:bodySSE,pixelErrorReduction:gain,meanPixelErrorReduction:gain/(known*3),knownPixels:known,unavailablePixels:unknown,bodyPixels:inside,knownBodyPixels,spatialSupportRank,bodySpatiallyDegenerate:spatialSupportRank<2,clippedByFrame:box.x<0||box.y<0||box.x+box.w>W||box.y+box.h>H});
 }
 fits.sort((a,b)=>b.pixelErrorReduction-a.pixelErrorReduction||a.renderedBodySSE-b.renderedBodySSE);return fits.length?{...fits[0],kind:'conditional-ROM-silhouette-body-fit',originalResidualId:region.id,originalROI:{...q},backgroundOnlyPreferred:fits[0].pixelErrorReduction<=0,bodyCertified:false,speciesCertified:false,minimumProvenATCalls:0,poseAndCameraCoverageComplete:false,alternativesTested:fits.length,scoreScope:'Unlit ROM RGB alpha composite versus same-frame ROM background; no per-frame color correction or tuned acceptance threshold. Positive gain alone cannot reject party/UI/unknown objects.'}:null;
}
export function conditionalBodyPrediction(rankings){
 const candidates=rankings.filter(r=>r.bodyFit&&Number.isFinite(r.bodyFit.pixelErrorReduction)).slice().sort((a,b)=>b.bodyFit.pixelErrorReduction-a.bodyFit.pixelErrorReduction||a.modelId.localeCompare(b.modelId));
 const best=candidates[0],appearances=rankings.filter(r=>Number.isFinite(r.similarity)).slice().sort((a,b)=>b.similarity-a.similarity||a.modelId.localeCompare(b.modelId)),appearance=appearances[0],uniqueAppearance=Boolean(appearance&&(!appearances[1]||appearance.similarity>appearances[1].similarity)),uniqueBody=Boolean(best&&(!candidates[1]||best.bodyFit.pixelErrorReduction>candidates[1].bodyFit.pixelErrorReduction)),agreement=Boolean(uniqueAppearance&&uniqueBody&&appearance.modelId===best.modelId),predicted=agreement&&!best.bodyFit.backgroundOnlyPreferred&&best.bodyFit.spatialSupportRank===2;return {kind:'conditional-ROM-body-model-prediction',modelId:predicted?best.modelId:null,speciesCandidates:predicted?structuredClone(best.speciesCandidates):[],appearanceModelId:appearance?.modelId??null,bodyModelId:best?.modelId??null,agreement,spatialSupportRank:best?.bodyFit.spatialSupportRank??null,decisionBasis:'Same-ROM DINO/body-model agreement, positive error reduction versus background-only, and nondegenerate 2D known-pixel support. Correlated evidence; uncalibrated conditional prediction.',bodyFit:best?structuredClone(best.bodyFit):null,alternatives:candidates.map(r=>({modelId:r.modelId,speciesCandidates:structuredClone(r.speciesCandidates),pixelErrorReduction:r.bodyFit.pixelErrorReduction,backgroundOnlyPreferred:r.bodyFit.backgroundOnlyPreferred})),nullHypothesis:'background-only',unknownNonEnemyPossible:true,identityCertified:false,bodyExtentCertified:false,noEventPossible:true,minimumProvenATCalls:0};
}
