import assert from 'node:assert/strict';
import {composeNativeBodyOverSourceDestination as compose,packNativeMapTranslucentFragments as pack} from '../web/monster-native-scene-composition.mjs?v=automatic-playback-source-cache-20261006-1100';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
assert(process.env.DQ9_BASELINE_ROOT,'DQ9_BASELINE_ROOT must identify the unchanged source baseline');
const {composeNativeBodyOverSourceDestination:prior}=await import(pathToFileURL(resolve(process.env.DQ9_BASELINE_ROOT,'web/monster-native-scene-composition.mjs')).href);
import {nativeBodyExtentEvidence as extent} from '../web/monster-native-extent-evidence.mjs';
import {createNativeBodyColorDependency} from '../web/monster-native-color-dependency.mjs';
const N=49152,I=40*256+40,camera={viewFx:Array(16).fill(0),projectionFx:Array(16).fill(0)},alignment={dx:0,dy:0},frame={romSHA256:'a'.repeat(64),fullRGBA_SHA256:'b'.repeat(64),recordKey:'map:test',sourceId:'test',sourceEpoch:0,timelineSegment:0,mediaTime:0};
function dest(){const d={kind:'source-prefog-opaque-body-destination-v1',recordKey:frame.recordKey,snapshot:camera,rgba6665:new Uint8Array(N*4),depth24:new Uint32Array(N).fill(1000),owner:new Int32Array(N).fill(90),frontFacing:new Uint8Array(N),knownMask:new Uint8Array(N).fill(1),sourceFogMask:new Uint8Array(N).fill(1),opaqueId:new Uint8Array(N).fill(20),unknownOrderMask:new Uint8Array(N),controls:{alphaBlendEnabled:true,alphaTestEnabled:false,alphaTestRef:null,translucentSortMode:'manual-source-order'},unknownReasons:[],sourceOrder:{kind:'source-ordinary-map-before-natural-body-v1'},binding:{kind:'same-frozen-source-destination-v1',frame:structuredClone(frame),camera:structuredClone(camera),alignment:{...alignment}}};for(let i=0;i<N;i++)d.rgba6665.set([10,20,30,31],i*4);d.mapFragments=pack([],{coverage:d.knownMask,depth24:d.depth24});return d;}
function poly(index,alpha,id,z,{rgb=[60,30,10],opaque=false,facing=true,fog=true}={}){return{index,translucent:!opaque,frontFacing:facing,attribute:((id<<24)|(31<<16)|(fog?0x8000:0)|192)>>>0,clipVerticesFx:[[0,0,0,4096],[2,0,0,4096],[0,2,0,4096]],fragments:[{x:40,y:40,depth24:z,rgb6:rgb,alpha5:alpha}]};}
const projected=parts=>({polygons:parts.map(p=>({index:p.index,material:{effective:{polygonAttribute:p.attribute}}})),transform:{camera}});
let count=0;function render(parts,map=[],options={},d=dest()){
 d.mapFragments=pack(map,{coverage:d.knownMask,depth24:d.depth24});const p=projected(parts),opts={destination:d,alignment,...options},b=prior(p,parts,opts),off=compose(p,parts,opts),r=compose(p,parts,{...opts,collectBodyColorDependency:true});assert.deepEqual(off,b,'Default remains byte/field exact');const{bodyColorDependency,...stripped}=r;assert.deepEqual(stripped,b,'Opt-in changes no original raster field');count++;return r;
}
const dependency=r=>r.bodyColorDependency?.displayMask[I];
let r=render([poly(0,31,1,500,{opaque:true})],[poly(9,15,9,400)]);assert.equal(r.nativeState.colorOwnerIsBody[I],0);assert.equal(dependency(r),1);let e=extent({rendered:r,alignment,frame,comparisonValidMask:new Uint8Array(N).fill(1)});assert.equal(e.bodyColorOwnership.allVisibleContributionsCapturedWithinComposition,false);assert.equal(e.bodyColorDependency.pixels,1);assert.equal(e.bodyColorDependency.diagnosticOnly,true);assert.equal(e.bodyColorDependency.completeBodyCertified,false);assert.equal(e.bodyColorDependency.allDisplayedRGBDependenciesCapturedWithinFixedTrace,true);assert.equal(e.minimumProvenATCalls,0);
assert.equal(dependency(render([poly(0,31,1,500,{opaque:true})],[poly(9,31,9,400)])),0);
let d=dest();d.controls.alphaBlendEnabled=false;assert.equal(dependency(render([poly(0,31,1,500,{opaque:true})],[poly(9,15,9,400)],{},d)),0);
for(const map of [[poly(9,0,9,400)],[poly(9,15,9,600)]])assert.equal(dependency(render([poly(0,31,1,500,{opaque:true})],map)),1);
r=render([poly(0,31,1,500,{opaque:true})],[poly(8,30,8,400,{rgb:[0,0,0]}),poly(9,30,9,300,{rgb:[0,0,0]})]);assert.equal(r.bodyColorDependency.preFogMask[I],0);assert.equal(dependency(r),0);
r=render([poly(0,31,1,500,{opaque:true})],[poly(9,30,9,400,{rgb:[0,0,0]})]);assert.equal(r.bodyColorDependency.preFogMask[I],1);assert.equal(dependency(r),0);
const fog=w=>({parameters:{enabled:true,alphaOnly:false,color:(31<<16),density:new Uint8Array(32),shift:0,offset:0},table:new Uint8Array(32768).fill(w)});
for(const [w,expected]of [[0,1],[64,1],[127,0],[128,0]])assert.equal(dependency(render([poly(0,31,1,500,{opaque:true})],[],{fog:fog(w)})),expected);
for(const k of ['alphaOnly','enabled']){const f=fog(128);f.parameters[k]=k==='alphaOnly';assert.equal(dependency(render([poly(0,31,1,500,{opaque:true})],[],{fog:f})),1);}
r=render([poly(0,31,1,500,{opaque:true})],[],{fog:fog(129)});assert.equal(r.bodyColorDependency,null);e=extent({rendered:r,alignment,frame,comparisonValidMask:new Uint8Array(N).fill(1)});assert.equal(e.bodyColorDependency.ready,false);
r=render([poly(0,15,7,500)],[poly(9,15,7,400)]);assert.equal(r.stats.duplicateIdSuppressed,1);assert.equal(dependency(r),0);
r=render([poly(0,31,1,1000,{opaque:true})]);assert.equal(r.ready,false);assert.equal(Object.hasOwn(r,'bodyColorDependency'),false);
d=dest();d.unknownOrderMask[I]=1;r=render([poly(0,15,1,500)],[],{},d);assert.equal(r.ready,false);
// The current post-actor MSE path invokes the identical accepted-write closure.
for(const [a,expected]of [[15,1],[30,0],[31,0]]){d=dest();d.postActorEffect={fragments:pack([poly(90,a,9,400,{rgb:[0,0,0]})],{coverage:d.knownMask,depth24:d.depth24})};r=render([poly(0,31,1,500,{opaque:true})],[],{},d);assert.equal(r.sourceAcceptedSubset,'conditional-source-map-actor-MSE-body');assert.equal(r.nativeState.colorOwnerIsBody[I],0);assert.equal(dependency(r),expected);}
// Malformed optional masks stay unsupported; they never rewrite ownership.
r=render([poly(0,31,1,500,{opaque:true})]);for(const bad of [null,{...r.bodyColorDependency,displayMask:new Uint8Array(1)},{...r.bodyColorDependency,diagnosticOnly:false}]){e=extent({rendered:{...r,bodyColorDependency:bad},alignment,frame,comparisonValidMask:new Uint8Array(N).fill(1)});assert.equal(e.bodyColorDependency.ready,false);assert.equal(e.bodyColorOwnership.allVisibleContributionsCapturedWithinComposition,false);}
// Exhaustive single-body-input domain for 4096 deterministic layered cases.
// Independent scalar oracle explicitly enumerates all 64 RGB6 inputs and all
// truncations. Multi-body fixed-trace extrema are also checked by enumeration.
let seed=0x715bd;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;},base=new Uint8Array(N*4),tracker=createNativeBodyColorDependency(base),footprint=new Uint8Array(N),depth24=new Uint32Array(N),isFogged=new Uint8Array(N),expected=[];
for(let i=0;i<4096;i++){
 footprint[i]=1;const ops=[{body:true,a:1+rand(31),rgb:rand(64),blend:!!rand(2)}];for(let k=0;k<rand(7);k++)ops.push({body:false,a:1+rand(31),rgb:rand(64),blend:!!rand(2)});
 let alpha=0;for(const op of ops){tracker.accept(i,[op.rgb,op.rgb,op.rgb],op.a,op.body,op.blend,alpha);alpha=op.a===31||!op.blend||alpha===0?op.a:Math.max(op.a,alpha);}
 const colors=Array.from({length:64},(_,x)=>{let v=0,a=0;for(const op of ops){const c=op.body?x:op.rgb;v=op.a===31||!op.blend||a===0?c:Math.floor(((op.a+1)*c+(31-op.a)*v)/32);a=op.a===31||!op.blend||a===0?op.a:Math.max(op.a,a);}return v;});expected.push({pre:+(Math.min(...colors)!==Math.max(...colors)),post:+(Math.min(...colors.map(x=>Math.floor(x/2)))!==Math.max(...colors.map(x=>Math.floor(x/2))))});
}
const masks=tracker.finish({footprint,depth24,isFogged,fog:null});for(let i=0;i<expected.length;i++){assert.equal(masks.preFogMask[i],expected[i].pre);assert.equal(masks.displayMask[i],expected[i].post);}
// All fog weights and every pair of two independent body RGB6 inputs.
// The second body blend is after the map stream, just like the admitted route.
const multiBase=new Uint8Array(N*4),multi=createNativeBodyColorDependency(multiBase),mf=new Uint8Array(N),md=new Uint32Array(N),mg=new Uint8Array(N),fogTable=new Uint8Array(32768),oracle=[];
for(let w=0;w<=128;w++){
 const i=w,a=1+rand(30),mapA=1+rand(30),mapC=rand(64),fogC=63;
 mf[i]=mg[i]=1;md[i]=i*512;fogTable[i]=w;
 multi.accept(i,[10,10,10],31,true,true,0);
 multi.accept(i,[mapC,mapC,mapC],mapA,false,true,31);
 multi.accept(i,[20,20,20],a,true,true,31);
 let lo=63,hi=0;for(let x=0;x<64;x++)for(let y=0;y<64;y++){
  const mapped=Math.floor(((mapA+1)*mapC+(31-mapA)*x)/32),body=Math.floor(((a+1)*y+(31-a)*mapped)/32),display=Math.floor(Math.floor(((128-w)*body+fogC*w)/128)/2);lo=Math.min(lo,display);hi=Math.max(hi,display);
 }oracle.push(+(lo!==hi));
}
const mm=multi.finish({footprint:mf,depth24:md,isFogged:mg,fog:{parameters:{enabled:true,alphaOnly:false,color:32767|(31<<16)},table:fogTable}});for(let i=0;i<oracle.length;i++)assert.equal(mm.displayMask[i],oracle[i]);
// A mismatch in retained alpha is not silently accepted as an exact trace.
const mismatch=createNativeBodyColorDependency(new Uint8Array(N*4));mismatch.accept(0,[1,2,3],31,true,true,31);assert.equal(mismatch.finish({footprint:mf,depth24:md,isFogged:mg,fog:null}),null);
console.log(JSON.stringify({passed:true,sourceCompositionOutputParityCases:count,exhaustiveRGB6DomainCases:expected.length,domainValuesPerCase:64,twoIndependentRGB6InputsFogCases:oracle.length,valuesPerTwoInputCase:4096,legacyOwnershipUnchanged:true,integerQuantizationMeasured:true,unknownOrderRetained:true,defaultOutputExact:true,postActorMseQuantizationChecked:true,diagnosticOnly:true},null,2));
