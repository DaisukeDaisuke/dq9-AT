// Diagnostic comparison of a ROM-rendered background and one owned video frame.
// No appearance/template detector, creature label, birth, or AT inference.
import {estimateCameraTranslation} from '../monster-position-proposals.mjs';
const W=256,H=192,N=W*H;
const need=(v,m)=>{if(!v)throw Error(m);};
export function gameplayVideoROI(width,height,layout){
 need(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0,'動画寸法が不明です');
 let roi;
 if(layout==='obs-side-1920'){need(width===1920&&height===1080,'OBS左右配置は1920×1080動画専用です');roi={x:960,y:0,w:960,h:720};}
 else if(layout==='single'){roi={x:0,y:0,w:width,h:height};}
 else if(layout==='ds-vertical'){need(height%2===0,'上下画面の高さが不正です');roi={x:0,y:height/2,w:width,h:height/2};}
 else if(layout==='ds-horizontal'){need(width%2===0,'左右画面の幅が不正です');roi={x:width/2,y:0,w:width/2,h:height};}
 else throw Error('動画の画面配置を選択してください');
 need(roi.w*3===roi.h*4,'指定したゲーム画面が4:3ではありません');return roi;
}
export function sampleGameplayFrame(image,roi){
 const {width,height,rgba}=image;need(rgba?.length===width*height*4,'元RGBA寸法が不正です');
 need(['x','y','w','h'].every(k=>Number.isInteger(roi[k]))&&roi.x>=0&&roi.y>=0&&roi.w>0&&roi.h>0&&roi.x+roi.w<=width&&roi.y+roi.h<=height,'ゲーム画面ROIが元画像外です');
 const out=new Uint8ClampedArray(N*4),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Same pixel-center bilinear convention as monster-position-proposals.sampleField.
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const fx=clamp(roi.x+(x+.5)*roi.w/W-.5,roi.x,roi.x+roi.w-1),fy=clamp(roi.y+(y+.5)*roi.h/H-.5,roi.y,roi.y+roi.h-1),ix=Math.floor(fx),iy=Math.floor(fy),jx=Math.min(ix+1,roi.x+roi.w-1),jy=Math.min(iy+1,roi.y+roi.h-1),dx=fx-ix,dy=fy-iy;
  for(let c=0;c<4;c++)out[(y*W+x)*4+c]=rgba[(iy*width+ix)*4+c]*(1-dx)*(1-dy)+rgba[(iy*width+jx)*4+c]*dx*(1-dy)+rgba[(jy*width+ix)*4+c]*(1-dx)*dy+rgba[(jy*width+jx)*4+c]*dx*dy;
 }
 return{width:W,height:H,rgba:out};
}
function tracking(rgba){const gray=new Uint8Array(N),blocked=new Uint8Array(N),mask=new Uint8Array(N);for(let i=0;i<N;i++){gray[i]=(rgba[i*4]*77+rgba[i*4+1]*150+rgba[i*4+2]*29)>>8;blocked[i]=rgba[i*4+3]===255?0:1;}return{gray,blocked,mask};}
function splitThreshold(histogram,count){
 // Otsu split; same lowest-threshold tie convention as existing warmSubcomponents.
 let sum=0,bins=0;for(let i=0;i<256;i++){sum+=histogram[i]*i;if(histogram[i])bins++;}if(bins<2)return null;
 let lowCount=0,lowSum=0,best=-1,threshold=null;
 for(let i=0;i<255;i++){lowCount+=histogram[i];lowSum+=i*histogram[i];const highCount=count-lowCount;if(!lowCount||!highCount)continue;const delta=lowSum/lowCount-(sum-lowSum)/highCount,score=lowCount*highCount*delta*delta;if(score>best){best=score;threshold=i;}}
 return threshold;
}
function regions(mask){const seen=new Uint8Array(N),queue=new Int32Array(N),out=[];
 for(let start=0;start<N;start++){if(!mask[start]||seen[start])continue;let head=0,tail=1,x0=W,x1=-1,y0=H,y1=-1;queue[0]=start;seen[start]=1;
  while(head<tail){const i=queue[head++],x=i%W,y=Math.floor(i/W);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const j of[x?i-1:-1,x+1<W?i+1:-1,y?i-W:-1,y+1<H?i+W:-1])if(j>=0&&mask[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
  out.push({id:out.length,roi:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1},pixels:tail,kind:'unclassified-background-residual',bodyCertified:false,speciesKnown:false,birthCertified:false,minimumProvenATCalls:0});
 }return out.sort((a,b)=>b.pixels-a.pixels||a.id-b.id);
}
export function compareMapBackground(background,video,{applyTranslation=false}={}){
 for(const image of[background,video])need(image?.width===W&&image?.height===H&&image.rgba?.length===N*4,'比較には256×192 RGBAが必要です');
 const alignment=estimateCameraTranslation(tracking(background.rgba),tracking(video.rgba)),shift=applyTranslation&&alignment.reliable?{dx:alignment.dx,dy:alignment.dy}:{dx:0,dy:0};
 const residual=new Uint8Array(N),valid=new Uint8Array(N),histogram=new Uint32Array(256),heatmap=new Uint8ClampedArray(N*4),aligned=new Uint8ClampedArray(N*4);let count=0,sum=0,exact=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,bx=x-shift.dx,by=y-shift.dy;if(bx<0||by<0||bx>=W||by>=H)continue;const j=by*W+bx;if(background.rgba[j*4+3]!==255||video.rgba[i*4+3]!==255)continue;
  let error=0;for(let c=0;c<3;c++){aligned[i*4+c]=background.rgba[j*4+c];error+=Math.abs(background.rgba[j*4+c]-video.rgba[i*4+c]);}aligned[i*4+3]=255;valid[i]=1;count++;sum+=error;if(!error)exact++;const value=Math.round(error/3);residual[i]=value;histogram[value]++;heatmap.set([value,value,value,255],i*4);
 }
 const threshold=splitThreshold(histogram,count),mask=new Uint8Array(N);if(threshold!==null)for(let i=0;i<N;i++)if(valid[i]&&residual[i]>threshold)mask[i]=1;
 const alignedForHypotheses=alignment.reliable&&(applyTranslation||(alignment.dx===0&&alignment.dy===0));
 const components=alignedForHypotheses?regions(mask):[];
 return{width:W,height:H,heatmap,alignedBackground:aligned,validMask:valid,residualMask:mask,components,alignment:{...alignment,applied:shift,appliedRequested:applyTranslation,worldCameraVerified:false},stats:{comparedPixels:count,unavailablePixels:N-count,rgbMAE:count?sum/(count*3):null,exactRGBPixels:exact,residualThreshold:threshold,residualPixels:mask.reduce((s,v)=>s+v,0)},state:!count?'background-unavailable':!alignedForHypotheses?'alignment-unresolved':threshold===null?'no-residual-split':'conditional-residual-hypotheses',unknown:true,calibrated:false,bodyCertified:false,minimumProvenATCalls:0,scope:'Frozen-frame diagnostic only. A bounded translation fit is not camera/scene parity. Residuals may be camera/floor/render/fog/animation errors, UI, party, or enemies. No residual is accepted as an enemy; no absent-region inference.'};
}
