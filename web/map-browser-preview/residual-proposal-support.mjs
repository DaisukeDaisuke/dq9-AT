// Recover one original 4-connected residual component from the exact frozen
// comparison mask. A rectangular ROI is not substituted for component support.
const W=256,H=192,N=W*H;
const unknown=reason=>({kind:'original-residual-component-support-v1',ready:false,reason,absenceCertified:false});
const sameROI=(a,b)=>a&&b&&['x','y','w','h'].every(k=>a[k]===b[k]);
export function originalResidualProposalSupport(comparison,region,{nativeVideo,sourcePixelSHA256}={}){
 const mask=comparison?.residualMask,valid=comparison?.validMask;
 if(!(mask instanceof Uint8Array)||mask.length!==N||!(valid instanceof Uint8Array)||valid.length!==N)return unknown('Exact frozen residual/validity masks unavailable');
 if(!Number.isSafeInteger(region?.id)||region.id<0||!Number.isSafeInteger(region.pixels)||region.pixels<=0||!Array.isArray(comparison.components))return unknown('Original residual component identity unavailable');
 const declared=comparison.components.filter(r=>r.id===region.id);
 if(declared.length!==1||declared[0].pixels!==region.pixels||!sameROI(declared[0].roi,region.roi))return unknown('Requested proposal differs from original comparison component');
 for(let i=0;i<N;i++)if((mask[i]!==0&&mask[i]!==1)||(valid[i]!==0&&valid[i]!==1)||mask[i]&&!valid[i])return unknown('Frozen residual mask is not binary known-pixel support');
 // Bind the mask to these actual frozen video/background pixels, in addition
 // to the original full-frame identity. Never accept a matching numeric ID alone.
 const video=nativeVideo?.rgba,background=comparison.alignedBackground,threshold=comparison.stats?.residualThreshold;
 if(!/^[a-f0-9]{64}$/.test(sourcePixelSHA256??'')||nativeVideo?.width!==W||nativeVideo?.height!==H||video?.length!==N*4||background?.length!==N*4||!Number.isInteger(threshold)||threshold<0||threshold>254)return unknown('Frozen frame identity or residual pixel binding unavailable');
 for(let i=0;i<N;i++){const known=video[i*4+3]===255&&background[i*4+3]===255;if(Boolean(valid[i])!==known)return unknown('Validity mask differs from frozen video/background pixels');if(!known)continue;let error=0;for(let c=0;c<3;c++)error+=Math.abs(video[i*4+c]-background[i*4+c]);if(mask[i]!==Number(Math.round(error/3)>threshold))return unknown('Residual mask differs from frozen video/background pixels');}
 const seen=new Uint8Array(N),queue=new Int32Array(N);let componentId=0;
 for(let start=0;start<N;start++){
  if(!mask[start]||seen[start])continue;let head=0,tail=1,x0=W,x1=-1,y0=H,y1=-1;queue[0]=start;seen[start]=1;
  while(head<tail){const i=queue[head++],x=i%W,y=Math.floor(i/W);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const j of[x?i-1:-1,x+1<W?i+1:-1,y?i-W:-1,y+1<H?i+W:-1])if(j>=0&&mask[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
  if(componentId++!==region.id)continue;
  const roi={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
  if(tail!==region.pixels||!sameROI(roi,region.roi))return unknown('Exact mask component differs from original proposal');
  const supportMask=new Uint8Array(N);for(let i=0;i<tail;i++)supportMask[queue[i]]=1;
  return{kind:'original-residual-component-support-v1',ready:true,originalResidualId:region.id,sourcePixelSHA256,pixelBinding:'same-frozen-native-video-background-residual-mask',roi,pixels:tail,mask:supportMask,absenceCertified:false};
 }
 return unknown('Original component absent from frozen residual mask');
}
