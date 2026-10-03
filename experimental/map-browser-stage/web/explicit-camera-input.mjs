import{cameraFromPlayerFx}from'./native/camera-from-player.mjs';
// Applied matrices are an explicit snapshot, never an inferred player camera.
export function cameraFromExplicitInput(input,trig){
 if(!input?.nativeAppliedMatrices)return cameraFromPlayerFx(input,trig);
 const c=input.nativeAppliedMatrices,check=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
 if(!check(c.view4x3Fx,12)||!check(c.projectionFx,16)||!check(c.eyeFx,3))throw Error('Explicit signed FX matrix snapshot required');
 if(c.projectionFx[11]!==-4096||c.projectionFx[15]!==0)throw Error('Only explicit perspective snapshot accepted');
 return{view4x3Fx:c.view4x3Fx.slice(),projectionFx:c.projectionFx.slice(),eyeFx:c.eyeFx.slice(),scope:'Caller-supplied applied camera snapshot. No player-follow, blend progression, map-click or state derivation.'};
}
