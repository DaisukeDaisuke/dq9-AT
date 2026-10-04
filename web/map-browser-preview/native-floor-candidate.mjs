// Static-derived02030df4/020316bc/02031bc8 subset. Caller supplies the actual
// ordered native candidate list and local-space segment, not all-map guesses.
import {fxCross,fxDot,fxDiv} from './native/native-camera-fx.mjs';
const i32=n=>Number(BigInt.asIntN(32,BigInt(n)));
const sub=(a,b)=>a.map((x,i)=>i32(x-b[i]));
const mul=(a,b)=>i32((BigInt(a)*BigInt(b)+0x800n)>>12n);
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
export function intersectNativeSegmentTriangle(start,end,a,b,c){
 if(![start,end,a,b,c].every(vec))throw Error('Five explicit FX32 vectors required');
 const ab=sub(b,a),ac=sub(c,a),direction=sub(start,end),normal=fxCross(ab,ac),den=fxDot(direction,normal);
 if(den<1)return null;
 const ap=sub(start,a),distance=fxDot(ap,normal);if(distance<0||distance>den)return null;
 const cross=fxCross(direction,ap),v=fxDot(ac,cross),w=i32(-fxDot(ab,cross));
 if(v<0||v>den||w<0||i32(v+w)>den)return null;
 const inverse=fxDiv(4096,den),vf=mul(v,inverse),wf=mul(w,inverse);
 return {barycentricFx:[i32(4096-vf-wf),vf,wf],fractionFx:mul(distance,inverse)};
}
export function intersectNativePlaneSegment(start,end,normalFx,planeConstantFx){
 if(![start,end,normalFx].every(vec)||!Number.isInteger(planeConstantFx)||planeConstantFx< -2147483648||planeConstantFx>2147483647)throw Error('Explicit FX32 segment and plane required');
 const delta=sub(end,start),den=fxDot(normalFx,delta);if(den===0)throw Error('Zero native plane divisor outside accepted subset');
 const fractionFx=fxDiv(i32(planeConstantFx-fxDot(normalFx,start)),den);
 return {accepted:fractionFx>=0&&fractionFx<=4096,fractionFx,pointFx:fractionFx>=0&&fractionFx<=4096?start.map((x,i)=>i32(x+mul(delta[i],fractionFx))):null};
}
export function selectNativeFloorCandidate(candidates,start,end){
 if(!Array.isArray(candidates)||!vec(start)||!vec(end))throw Error('Explicit native candidate list and FX32 segment required');
 let selected=-1,highest=0;
 for(let i=0;i<candidates.length;i++){
  const t=candidates[i];if(!Array.isArray(t.verticesFx)||t.verticesFx.length!==3||!t.verticesFx.every(vec)||!vec(t.normalFx))throw Error('Three native vertices and normal required');
  if(t.normalFx[1]<=0x800)continue;
  const hit=intersectNativeSegmentTriangle(start,end,...t.verticesFx);if(!hit)continue;const bc=hit.barycentricFx;
  const y=i32(t.verticesFx.reduce((s,v,k)=>s+mul(v[1],bc[k]),0));if(selected<0||y>highest){selected=i;highest=y;}
 }
 if(selected<0)return {selected:-1,pointFx:null,reason:'No candidate accepted within supplied segment'};
 const [a,b,c]=candidates[selected].verticesFx,plane=fxCross(sub(b,a),sub(c,a)),hit=intersectNativePlaneSegment(start,end,plane,fxDot(plane,a));
 if(!hit.accepted)return {selected:-1,pointFx:null,reason:'Selected plane misses supplied segment'};
 return {selected,pointFx:hit.pointFx,barycentricHeightFx:highest,scope:'Static-derived candidate math; native dynamic parity and field/grid/instance selection unverified. Caller owns +0x199 wrapper adjustment and coordinate transform.'};
}
