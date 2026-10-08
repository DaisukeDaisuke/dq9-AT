import assert from 'node:assert/strict';
import {composeNativeBodyOverSourceDestination as compose} from '../web/monster-native-scene-composition.mjs';
import {nativeBodyExtentEvidence} from '../web/monster-native-extent-evidence.mjs';
import {comparePerspectiveBody} from '../web/monster-perspective-body.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const prior=process.env.DQ9_BASELINE_ROOT?(await import(pathToFileURL(resolve(process.env.DQ9_BASELINE_ROOT,'web/monster-native-scene-composition.mjs')).href)).composeNativeBodyOverSourceDestination:null;
const N=256*192,attribute=(31<<16)|192,camera={viewFx:Array(16).fill(0),projectionFx:Array(16).fill(0)};
function destination(){const rgba6665=new Uint8Array(N*4);for(let i=0;i<N;i++)rgba6665.set([10,20,30,31],i*4);return{kind:'source-prefog-opaque-body-destination-v1',rgba6665,depth24:new Uint32Array(N).fill(1000),owner:new Int32Array(N).fill(20),frontFacing:new Uint8Array(N),knownMask:new Uint8Array(N).fill(1),sourceFogMask:new Uint8Array(N),opaqueId:new Uint8Array(N),unknownOrderMask:new Uint8Array(N),unknownReasons:[],controls:{translucentSortMode:'manual-source-order',alphaBlendEnabled:true,alphaTestEnabled:false,alphaTestRef:null}};}
function render(points,alignment,d,{translucent=false,depth24=500,alpha5=31,implementation=compose}={}){const participants=[{index:0,frontFacing:true,translucent,attribute,clipVerticesFx:[[0,0,0,4096],[2,0,0,4096],[0,2,0,4096]],fragments:points.map(([x,y])=>({x,y,depth24,alpha5,rgb6:[60,30,10]}))}],projected={transform:{camera},polygons:[{index:0,material:{effective:{polygonAttribute:attribute}}}]};return implementation(projected,participants,{destination:d,alignment});}
let cases=0;
for(const [alignment,outside,inside] of [[{dx:-1,dy:0},[0,50],[1,50]],[{dx:1,dy:0},[255,50],[254,50]],[{dx:0,dy:-1},[50,0],[50,1]],[{dx:0,dy:1},[50,191],[50,190]],[{dx:-5,dy:2},[150,190],[150,189]]]){
 const i=outside[1]*256+outside[0],j=inside[1]*256+inside[0];
 for(const translucent of [false,true]){
  const d=destination();d.knownMask[i]=0;d.unknownOrderMask[i]=1;
  const r=render([outside,inside],alignment,d,{translucent,alpha5:translucent?15:31});assert.equal(r.ready,true);assert.equal(r.stats.bodyFootprintPixels,2);assert.equal(r.sourceCoverage[i],1);assert.equal(r.sourceCoverage[j],1);assert.equal(r.observationViewport.clippedSourceFootprintPixels,1);assert.equal(r.observationViewport.unknownInViewSkipped,false);assert.equal(r.observationViewport.completeBodyCertified,false);assert.equal(r.stats.unknownDestinationPixels,0);const extent=nativeBodyExtentEvidence({projected:{},rendered:r,alignment,comparisonValidMask:new Uint8Array(N).fill(1),frame:{sourceId:'test'}});assert.equal(extent.rasterFootprint.clippedByAlignment,true);assert.equal(extent.rasterFootprint.outsideFramePixels,1);assert.equal(extent.bodyExtentCertified,false);const o=((inside[1]+alignment.dy)*256+inside[0]+alignment.dx)*4;assert.equal(r.rgba[o+3],255);
  const only=render([inside],alignment,d,{translucent,alpha5:translucent?15:31});assert.deepEqual(r.rgba,only.rgba);assert.deepEqual(r.nativeState,only.nativeState);
  d.knownMask[j]=0;assert.equal(render([outside,inside],alignment,d,{translucent}).ready,false);d.knownMask[j]=1;d.unknownOrderMask[j]=1;assert.equal(render([outside,inside],alignment,d,{translucent}).ready,false);d.unknownOrderMask[j]=0;
  if(!translucent)assert.equal(render([outside,inside],alignment,d,{depth24:1000}).ready,false);
  if(prior){const known=destination(),old=render([outside,inside],alignment,known,{translucent,alpha5:translucent?15:31,implementation:prior}),now=render([outside,inside],alignment,known,{translucent,alpha5:translucent?15:31});assert.equal(old.ready,true);assert.deepEqual(now.rgba,old.rgba);assert.deepEqual(now.sourceCoverage,old.sourceCoverage);const e={videoRGBA:new Uint8Array(N*4),backgroundRGBA:new Uint8Array(N*4),validMask:new Uint8Array(N).fill(1),region:{id:1}};assert.deepEqual(comparePerspectiveBody(now,e),comparePerspectiveBody(old,e));}
  cases++;
 }
 // Empty visible support remains a zero-support image, never positive evidence.
 const empty=render([outside],alignment,destination());assert.equal(empty.ready,true);assert.equal(empty.observationViewport.visibleSourceFootprintPixels,0);assert(!empty.rgba.some(Boolean));const fit=comparePerspectiveBody(empty,{videoRGBA:new Uint8Array(N*4),backgroundRGBA:new Uint8Array(N*4),validMask:new Uint8Array(N).fill(1),region:{id:1}});assert.equal(fit.pixelErrorReduction,0);assert.equal(fit.backgroundOnlyPreferred,true);assert.equal(fit.bodyCertified,false);
}
// Unknown cells inside the rectangle must remain rejected even at a known border.
for(const [x,y]of [[0,0],[255,0],[0,191],[255,191],[100,100]]){const d=destination();d.knownMask[y*256+x]=0;assert.equal(render([[x,y]],{dx:0,dy:0},d).ready,false);cases++;}
console.log(JSON.stringify({passed:true,cases,allFourViewportBorders:true,opaqueAndTranslucent:true,inViewUnknownAndDepthTieGatesRetained:true,noBodyCertification:true,baselineVisibleRGBAAndScoreParity:!!prior}));
