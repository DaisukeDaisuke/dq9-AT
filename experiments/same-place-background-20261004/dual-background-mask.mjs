// Experimental same-place background disagreement gate. No enemy/absence/AT proof.
// Reference acquisition, target exclusion and registration identity belong to caller.
function residual(frame,reference,blocked){
 const nPixels=blocked.length,histogram=new Uint32Array(256),difference=new Uint8Array(nPixels);let validPixels=0,sum=0;
 for(let i=0;i<nPixels;i++)if(reference[i*4+3]===255){const d=Math.max(Math.abs(frame[i*4]-reference[i*4]),Math.abs(frame[i*4+1]-reference[i*4+1]),Math.abs(frame[i*4+2]-reference[i*4+2]));difference[i]=d;histogram[d]++;validPixels++;sum+=d;}
 let lowerCount=0,lowerSum=0,best=-1,threshold=null;
 for(let t=0;t<255;t++){lowerCount+=histogram[t];lowerSum+=histogram[t]*t;const upperCount=validPixels-lowerCount;if(!lowerCount||!upperCount)continue;const delta=lowerSum/lowerCount-(sum-lowerSum)/upperCount,score=lowerCount*upperCount*delta*delta;if(score>best){best=score;threshold=t;}}
 if(threshold===null)throw Error('Background residual histogram is degenerate; foreground remains unresolved');
 const mask=new Uint8Array(nPixels);for(let i=0;i<nPixels;i++)mask[i]=!blocked[i]&&reference[i*4+3]===255&&difference[i]>threshold?1:0;
 return{mask,threshold,validPixels,pixels:mask.reduce((sum,v)=>sum+v,0)};
}
export function dualBackgroundMask(frameRGBA,rawMedianRGBA,affineMedianRGBA,blocked){
 const pixelCount=256*192,isBytes=x=>x instanceof Uint8Array||x instanceof Uint8ClampedArray;
 if(!isBytes(blocked)||blocked.length!==pixelCount||![frameRGBA,rawMedianRGBA,affineMedianRGBA].every(x=>isBytes(x)&&x.length===pixelCount*4))throw Error('Native256x192 RGBA and blocked mask required');
 const raw=residual(frameRGBA,rawMedianRGBA,blocked),affine=residual(frameRGBA,affineMedianRGBA,blocked),mask=Uint8Array.from(raw.mask,(v,i)=>v&&affine.mask[i]?1:0);
 return{mask,thresholds:[{method:'raw-median',threshold:raw.threshold,pixels:raw.pixels},{method:'affine-median',threshold:affine.threshold,pixels:affine.pixels}],jointPixels:mask.reduce((sum,v)=>sum+v,0),safeForHardPruning:false,absenceCertified:false,ATDrawsCertified:0};
}
