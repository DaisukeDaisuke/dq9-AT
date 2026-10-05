// Presentation-only size grouping. The raw residuals are never removed from evidence.
// Edges and incomplete-render boundaries keep even one-pixel hypotheses visible.
export function annotateResidualRegions(comparison,video){
 const {width:W,height:H,residualMask:mask,validMask:valid,alignedBackground:bg,components}=comparison,N=W*H;
 if(!mask||mask.length!==N||valid?.length!==N||bg?.length!==N*4||video?.rgba?.length!==N*4)throw Error('Matching comparison buffers required');
 if(!components.length)return[];
 const byId=new Map(components.map(c=>[c.id,c])),seen=new Uint8Array(N),queue=new Int32Array(N),rows=[];let id=0;
 for(let start=0;start<N;start++){
  if(!mask[start]||seen[start])continue;let head=0,tail=1,boundaryPixels=0,unavailableBoundaryPixels=0,edgeSum=0,videoEdgeSum=0,edgeSamples=0;queue[0]=start;seen[start]=1;
  while(head<tail){const i=queue[head++],x=i%W,y=Math.floor(i/W);if(x===0||y===0||x===W-1||y===H-1)boundaryPixels++;
   const adjacent=[x?i-1:-1,x+1<W?i+1:-1,y?i-W:-1,y+1<H?i+W:-1];if(adjacent.some(j=>j>=0&&!valid[j]))unavailableBoundaryPixels++;
   for(const j of adjacent){if(j<0)continue;if(valid[j]){for(let c=0;c<3;c++){edgeSum+=Math.abs(bg[i*4+c]-bg[j*4+c]);videoEdgeSum+=Math.abs(video.rgba[i*4+c]-video.rgba[j*4+c]);}edgeSamples+=3;}if(mask[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
  }
  const original=byId.get(id++);if(!original||original.pixels!==tail)throw Error('Raw residual component correspondence differs');
  rows.push({...original,frameBoundaryPixels:boundaryPixels,unavailableBoundaryPixels,boundaryRetained:boundaryPixels>0||unavailableBoundaryPixels>0,backgroundNeighborRGBDifference:edgeSamples?edgeSum/edgeSamples:null,videoNeighborRGBDifference:edgeSamples?videoEdgeSum/edgeSamples:null,noiseCertified:false,absenceCertified:false});
 }
 if(rows.length!==components.length)throw Error('Raw component count differs');
 return rows.sort((a,b)=>b.pixels-a.pixels||a.id-b.id);
}
export function selectResidualDisplay(regions,{minimumPixels=1}={}){
 if(!Number.isSafeInteger(minimumPixels)||minimumPixels<1||minimumPixels>49152)throw Error('表示画素数は1〜49152の整数です');
 const visible=[],withheldForDisplay=[];
 for(const r of regions)(r.pixels>=minimumPixels||r.boundaryRetained?visible:withheldForDisplay).push(r);
 return{minimumPixels,visible,withheldForDisplay,rawCount:regions.length,visibleCount:visible.length,withheldCount:withheldForDisplay.length,retainedSmallBoundaryCount:visible.filter(r=>r.pixels<minimumPixels).length,scope:'Display grouping only. Withheld inner regions can include distant enemies; boundary regions remain visible. No noise/absence/body/species/birth/AT certification.',minimumProvenATCalls:0};
}
