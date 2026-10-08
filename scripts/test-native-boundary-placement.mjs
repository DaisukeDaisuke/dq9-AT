// Synthetic source-projector regression. Real-ROM frozen replay is separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const projectNativeBodyPolygons=(program,{positionFx})=>({polygons:[{vertices:program.points.map(p=>{const w=p.map((x,k)=>Math.round(x*4096)+positionFx[k]),cameraFx=[w[0],w[2],w[1],4096];return{cameraFx,clipFx:cameraFx};})}]});
globalThis.__boundaryPlacementTest={projectNativeBodyPolygons,createNativeBodyBillboardState:()=>null};
async function load(file){const source=fs.readFileSync(file,'utf8').replace(/^import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"];\s*$/gm,(_,names)=>`const {${names}}=globalThis.__boundaryPlacementTest;`);return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
const current=await load(new URL('../web/monster-native-body-placement.mjs',import.meta.url)),baseline=process.argv[2]?await load(pathToFileURL(process.argv[2])):null;
const identity=[4096,0,0,0,0,4096,0,0,0,0,4096,0,0,0,0,4096],camera={viewFx:identity,projectionFx:identity},program={points:[[-.25,0,-.25],[.25,0,-.25],[.25,0,.25],[-.25,0,.25]],materials:[]},floor={planes:[{key:'floor',normal:[0,1,0],constant:0,triangles:[{vertices:[[-4,0,-4],[4,0,-4],[0,0,8]],source:{recordIndex:1},surfaceAttribute:1}]}]},alignments=[{dx:0,dy:0},{dx:12,dy:-2},{dx:-4,dy:2},{dx:-12,dy:-6},{dx:5,dy:8}];
let clips=0,parity=0;
for(const alignment of alignments){const envelope=current.prepareNativeBodyEnvelope(program,{camera,alignment,actorScaleFx:4096,yawFx:0}),viewport={left:Math.max(0,alignment.dx),right:Math.min(256,256+alignment.dx),top:Math.max(0,alignment.dy),bottom:Math.min(192,192+alignment.dy)};
 for(const [horizontal,vertical] of [['left',null],['right',null],[null,'top'],[null,'bottom'],['left','top'],['right','bottom'],[null,null]]){
  const center=[horizontal==='left'?viewport.left+16:horizontal==='right'?viewport.right-16:128,vertical==='top'?viewport.top+12:vertical==='bottom'?viewport.bottom-12:96],positionFx=[Math.round((2*(center[0]-alignment.dx)/256-1)*4096),0,Math.round((1-2*(center[1]-alignment.dy)/192)*4096)],actual=current.nativeProjectedBodyEnvelope(projectNativeBodyPolygons(program,{positionFx}),alignment),q=actual.roi,left=Math.max(q.x,viewport.left),right=Math.min(q.x+q.w,viewport.right),top=Math.max(q.y,viewport.top),bottom=Math.min(q.y+q.h,viewport.bottom),region={id:1,roi:{x:left,y:top,w:right-left,h:bottom-top}};
  const before=current.placeNativeBodyEnvelopeOnFloors(envelope,region,floor);if(baseline){assert.deepEqual(before,baseline.placeNativeBodyEnvelopeOnFloors(envelope,region,floor));parity++;}
  const after=current.placeNativeBodyBoundaryEnvelopeOnFloors(envelope,region,floor);
  if(!horizontal&&!vertical){assert.equal(after.placements.length,0);continue;}
  assert.equal(after.placements.length,1);const p=after.placements[0];assert(p.positionFx.every((x,k)=>x===positionFx[k]));assert.equal(p.completeGeometryCenterAssumed,false);assert.equal(p.sourceEmittedEnvelopeCenterAssumed,false);assert.equal(p.boundaryAnchor.observedClippingCertified,false);assert(p.quantizedRootFloorResidualFx===0);assert(p.nativeBoundaryResidualPixels.every(x=>Math.abs(x)<=.02));assert.notDeepEqual(before.placements[0].positionFx,positionFx);assert.equal(after.identityCertified,false);assert.equal(after.minimumProvenATCalls,0);clips++;
 }
 // Internal unknown cells are never geometrical viewport boundaries.
 assert.equal(current.nativeBoundaryPlacementAnchor(envelope,{roi:{x:50,y:50,w:20,h:20},unknownMask:new Uint8Array(49152).fill(1)}).ready,false);
 const both={roi:{x:viewport.left,y:50,w:viewport.right-viewport.left,h:20}};assert.match(current.nativeBoundaryPlacementAnchor(envelope,both).reason,/underdetermined/);assert.equal(current.placeNativeBodyBoundaryEnvelopeOnFloors(envelope,both,floor).placements.length,0);
}
assert.throws(()=>current.nativeBoundaryPlacementAnchor({alignment:{dx:.5,dy:0}},{roi:{x:0,y:0,w:10,h:10}}),/Exact alignment/);
assert.equal(current.nativeBoundaryPlacementAnchor({alignment:{dx:256,dy:0}},{roi:{x:0,y:0,w:10,h:10}}).ready,false);
console.log(JSON.stringify({passed:true,syntheticSourceProjector:true,clippedCases:clips,oldCompleteCenterExactParityCases:parity,translatedFourSidesAndCorners:true,inViewUnknownNotBoundary:true,oppositeEdgesRetainedUnknown:true,sourceRootAndUncertaintyRetained:true}));
// Exercise the production runner's new cursor using the same explicit source
// double, including empty planes, budget interruption and stale frame guards.
Object.assign(globalThis.__boundaryPlacementTest,current,{
 readSdkInitialMaterialGlobals:()=>({}),readInitialMode1RasterProfile:()=>({}),
 readMonsterAssets:()=>({models:[{model:{bytes:new Uint8Array(1)},animations:[]}]}),
 prepareNativeBodyProgram:()=>({...program,nodes:{count:0},sbc:{commands:[]},shapes:[]}),
 bindFrozenBodyProjection:r=>({camera:r.camera,alignment:r.alignment})
});
const {createNativeBodySupportRunner}=await load(new URL('../web/monster-native-support-runner.mjs',import.meta.url)),romSHA256='a'.repeat(64),frame={romSHA256,recordKey:'synthetic',sourceId:'test',sourceEpoch:0,timelineSegment:0,mediaTime:0,fullRGBA_SHA256:'b'.repeat(64)},request={frame,cameraFrame:frame,candidate:{modelId:'synthetic',variant:'_f'},pose:{clip:'bind',frame:null,actorScaleFx:4096,yawFx:0},camera,alignment:{dx:0,dy:2},region:{roi:{x:96,y:2,w:64,h:12}},floorPlan:floor};
const run=limit=>{const runner=createNativeBodySupportRunner({project:{sdk:{},nfs:{}},rom:new Uint8Array(1),catalog:new Map(),romSHA256,maxCacheBytes:1048576,maxPrograms:2}),all={placements:[],unresolved:[]};let state=null,last,turns=0;do{let checks=0;last=runner.proposeNativeEnvelope(request,{state,getCurrentFrame:()=>frame,shouldYield:()=>checks++>=limit});state=last.state;all.placements.push(...last.placements);all.unresolved.push(...last.unresolved);assert(++turns<20);}while(!last.complete);assert.equal(last.completedSteps,3);assert.equal(state.planeIndex,1);assert.equal(state.boundaryPlaneIndex,1);assert.equal(all.placements.length,2);assert.equal(all.placements[0].placementKind,'conditional-native-emitted-envelope');assert.equal(all.placements[1].placementKind,'conditional-native-boundary-envelope');assert.throws(()=>runner.proposeNativeEnvelope({...request},{state,getCurrentFrame:()=>frame,shouldYield:()=>false}),/another frozen request/);assert.throws(()=>runner.proposeNativeEnvelope(request,{state,getCurrentFrame:()=>({...frame,mediaTime:1}),shouldYield:()=>false}),/stale/);assert.throws(()=>runner.proposeNativeEnvelope(request,{state,signal:AbortSignal.abort(),getCurrentFrame:()=>frame,shouldYield:()=>false}),/stale/);runner.dispose();return all;};
assert.deepEqual(run(2),run(Infinity));
console.log(JSON.stringify({passed:true,runnerBudgetResumeExact:true,oldCenterBeforeNewBoundary:true,separatePlaneCursors:true,newPreparationStepsAccounted:true,requestStaleAndCancelGuards:true}));
