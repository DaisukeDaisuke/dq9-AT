import {upperVideoROI} from './video-player-map-input.mjs?v=complete-registration-reuse-20261006-1523';
import {gameplayVideoROI} from './map-video-residual.mjs?v=camera-loss-evidence-20261006-1205';
// Input contract for the supplied recordings, not a visual/layout classifier.
// The supplied 1920x1080 recording puts both 960x720 DS screens above the stream HUD.
// Name visibility, map identity and player position are independently unresolved.
export function inferPairedVideoLayout(sourceImage){
 const supported=sourceImage.width===1920&&sourceImage.height===1080;
 const layout=supported?'obs-side-1920':null;
 return{layout,basis:'provided-recording-format',namePanelRequired:false,
  candidates:supported?[{layout,upper:upperVideoROI(1920,1080,layout),gameplay:gameplayVideoROI(1920,1080,layout),accepted:true}]:[],
  reason:supported?null:'provided-recording-dimensions-required',
  scope:'Only the supplied 1920x1080 recording format: map at (0,0,960,720), gameplay at (960,0,960,720). This crop contract does not establish map identity, player position, or current gameplay state.'};
}
