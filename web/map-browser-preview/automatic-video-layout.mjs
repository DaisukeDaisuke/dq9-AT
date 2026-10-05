import {upperVideoROI} from './video-player-map-input.mjs';
import {gameplayVideoROI,sampleGameplayFrame} from './map-video-residual.mjs';
import {detectMapNameROI} from '../map-name-roi.mjs';
// Enumerate the existing paired-screen layouts and require observed label-panel
// evidence. Dimensions alone never certify a layout. Unknown layouts stay unknown.
export function inferPairedVideoLayout(sourceImage){
 const candidates=[];
 for(const layout of ['obs-side-1920','ds-vertical','ds-horizontal']){
  try{const upper=upperVideoROI(sourceImage.width,sourceImage.height,layout),gameplay=gameplayVideoROI(sourceImage.width,sourceImage.height,layout),image=sampleGameplayFrame(sourceImage,upper),panel=detectMapNameROI({width:256,height:192,data:image.rgba});candidates.push({layout,upper,gameplay,panel,accepted:panel.resolved});}catch(error){candidates.push({layout,accepted:false,reason:error.message});}
 }
 const accepted=candidates.filter(c=>c.accepted);
 return{layout:accepted.length===1?accepted[0].layout:null,candidates,scope:'Pixel-confirmed panel within existing supported paired layouts. Arbitrary OBS layouts, hidden map labels, transition/battle screens and ambiguous layouts remain unresolved.'};
}
