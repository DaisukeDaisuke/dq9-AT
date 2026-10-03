import {imageToMapCoordinateCandidate} from './native/player-coordinate.mjs';
import {cameraFromPlayerFx} from './native/camera-from-player.mjs';
// A clicked desired viewpoint is not an observation of the live party.
// Use composed-map pixel coordinates, not DOM/CSS/capture-scaled coordinates.
export function cameraForMapClick({imageX,imageY,originPixel,worldToMapScale,playerYFx,cameraState},trig){
 if(!Number.isInteger(playerYFx)||playerYFx< -2147483648||playerYFx>2147483647)throw Error('Explicit player height coordinate required; floor height is not inferred');
 const coordinate=imageToMapCoordinateCandidate({imageX,imageY,originPixel,scale:worldToMapScale});if(!coordinate.splitX||!coordinate.splitZ)throw Error('Requested coordinate outside native signed range');
 const requestedPlayerPositionFx=[coordinate.splitX.rawSigned32,playerYFx,coordinate.splitZ.rawSigned32];
 const camera=cameraFromPlayerFx({...cameraState,playerPositionFx:requestedPlayerPositionFx},trig);
 return {requestedPlayerPositionFx,camera,coordinate,scope:'Requested preview position only; no live actor position/height proof, emulator movement, encounter or AT update'};
}
