import assert from 'node:assert/strict';
import {clipNativePositionPolygon,rasterizeNativePositionClippedZPolygon} from '../web/map-browser-preview/integer/native-position-clip.mjs';
import {rasterizePositionClippedNativeZPolygon,rasterizeUnclippedNativeZPolygon,prepareBinaryNativeZScanlines,prepareTexturedTranslucentNativeZScanlines} from '../web/map-browser-preview/integer/native-polygon-depth.mjs';

// Synthetic coordinates only. The left-plane intersection ratio rounds to zero,
// preserving the inside vertex Y/Z/W but placing the clipped X on the plane.
const input=[[-100000,100,0,8192],[-100000,2000,0,8192],[-8191,1000,0,8192]];
const clip=clipNativePositionPolygon(input);
assert.equal(clip.discarded,false);assert.equal(clip.positionsFx.length,3);
assert(clip.intersections.every(v=>v.ratioFx===0));
assert(clip.positionsFx.every(v=>v[1]===1000));
assert(clip.positionsFx.some(v=>v[0]!==clip.positionsFx[0][0]));
const base={polygonAttribute:(31<<16)|(3<<6),primitiveMode:2,viewportWord:0xbfff0000,depthMode:'Z',fragmentSamplingHack:false,textureFormat:3,textureAllAlpha255:true};
let checks=0;
for(const textureFormat of [2,3,4,7])for(const cull of [0,1,2,3])for(const primitiveMode of [0,2]){
 const result=rasterizeNativePositionClippedZPolygon({...base,textureFormat,primitiveMode,polygonAttribute:(31<<16)|(cull<<6),clipVerticesFx:input});
 assert.equal(result.ready,true);assert.equal(result.culled,cull<2);
 assert.equal(result.facing,0n);assert.equal(result.fragments.length,0);assert.equal(result.scanlines.length,0);
 assert(result.coverage.every(v=>v===0));assert(result.depth24.every(v=>v===0));
 if(cull>=2){assert(result.edgeRuns.length>0);assert(result.edgeRuns.every(r=>r.left.height===0&&r.right.height===0&&r.scanlineCount===0));}
 checks++;
}
// Points remain covered by the earlier collapsed-polygon fix, in all N-gon sizes.
for(const n of [3,4,5,6,7,8,9]){
 const r=rasterizePositionClippedNativeZPolygon({...base,clipVerticesFx:Array.from({length:n},()=>[0,0,0,8192])});
 assert.equal(r.ready,true);assert.equal(r.fragments.length,0);checks++;
}
const binary=prepareBinaryNativeZScanlines({...base,clipVerticesFx:clip.positionsFx,textureBinaryAlpha:true});
assert.equal(binary.ready,true);assert.equal(binary.scanlines.length,0);checks++;
for(const textureFormat of [1,3,6]){
 const r=prepareTexturedTranslucentNativeZScanlines({...base,polygonAttribute:(15<<16)|(3<<6),textureFormat,textureParameter:textureFormat<<26,clipVerticesFx:clip.positionsFx});
 assert.equal(r.ready,true);assert.equal(r.scanlines.length,0);checks++;
}
// No relaxation of arbitrary zero-area, untextured-line, or unclipped guards.
const slanted=[[-2048,-2048,0,4096],[0,0,0,4096],[2048,2048,0,4096]],horizontal=[[-2048,0,0,4096],[0,0,0,4096],[2048,0,0,4096]];
assert.equal(rasterizePositionClippedNativeZPolygon({...base,clipVerticesFx:slanted}).ready,false);checks++;
assert.equal(rasterizeUnclippedNativeZPolygon({...base,clipVerticesFx:horizontal}).ready,false);checks++;
assert.throws(()=>rasterizePositionClippedNativeZPolygon({...base,textureFormat:0,clipVerticesFx:horizontal}),/Post-clip untextured line/);checks++;
assert.throws(()=>rasterizeNativePositionClippedZPolygon({...base,textureAllAlpha255:false,clipVerticesFx:input}),/Proven opaque texture/);checks++;
assert.throws(()=>rasterizeNativePositionClippedZPolygon({...base,fragmentSamplingHack:true,clipVerticesFx:input}),/integer sampling profile/);checks++;
console.log(JSON.stringify({passed:true,checks,syntheticOnly:true}));
