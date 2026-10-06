import assert from 'node:assert/strict';
import {lineMinimum,refineGeometryPosition} from '../web/map-browser-preview/geometry-position-refinement.mjs';
const checks=[];
function testLine(name,fn,p,d,bounds,verify){
 let calls=0;
 const result=lineMinimum(q=>{calls++;assert(q.every((v,j)=>v>=bounds[j][0]&&v<=bounds[j][1]),'Every probe stays within source bounds');return fn(q);},p,d,bounds);
 assert(calls<=48,'Fixed objective-call ceiling');assert(!(result.value>fn(p)),'Initial point is retained');
 verify(result,calls);checks.push({name,calls,result});
}
testLine('multimodal line retains better sampled basin',([x])=>Math.min((x+2.3)**2+.1,(x-.55)**2+.8),[0,0],[1,0],[[-3,3],[-3,3]],r=>{assert(Math.abs(r.point[0]+2.3)<1e-4);assert(r.value<.101);});
testLine('initial point is kept when between subdivision samples',([x])=>(x-.013)**2,[.013,0],[1,0],[[-2,3],[-1,1]],r=>assert.equal(r.point[0],.013));
testLine('boundary minimum is returned exactly, for caller rejection',([x])=>x,[0,0],[1,0],[[-3,3],[-1,1]],r=>assert.equal(r.point[0],-3));
testLine('all non-finite outcomes remain unsupported',()=>Infinity,[0,0],[1,0],[[-3,3],[-1,1]],r=>assert.equal(r.value,Infinity));
testLine('non-finite samples do not hide finite basin',([x])=>x<0?NaN:(x-.6)**2,[0,0],[1,0],[[-3,3],[-1,1]],r=>assert(Math.abs(r.point[0]-.6)<1e-4));
testLine('zero direction preserves initial point',([x])=>x*x,[1,0],[0,0],[[-3,3],[-1,1]],(r,c)=>{assert.deepEqual(r.point,[1,0]);assert.equal(c,1);});
testLine('fixed source axis is not expanded',([x])=>x*x,[1,0],[1,0],[[1,1],[-1,1]],(r,c)=>{assert.deepEqual(r.point,[1,0]);assert.equal(c,1);});
testLine('large line consumes no more than fixed call cap',([x])=>(x-.6)**2,[0,0],[1,0],[[-1e6,1e6],[-1,1]],(r,c)=>assert.equal(c,48));
for(let i=0;i<32;i++){
 const center=i/7-2,span=1+i/9,target=center+span*.23,p=[center,center],d=[1,.5],bounds=[[center-span,center+span],[center-span,center+span]];
 testLine('translated/scaled oblique convex interval '+i,([x,y])=>(x-target)**2+(y-(center+(target-center)*.5))**2,p,d,bounds,r=>assert(Math.abs(r.point[0]-target)<1e-4));
}
const rgba=new Uint8ClampedArray(256*192*4);
for(let y=0;y<192;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,v=128+50*Math.sin(x/7)+50*Math.cos(y/9);rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=255;}
const image={width:256,height:192,rgba},depth24=new Uint32Array(49152).fill(0x7fffff),knownMask=new Uint8Array(49152).fill(1),bounds=()=>({inSigned32Range:true,rawMin:-4096,rawMax:4096}),position={world:{xFx:0,zFx:0},coordinate:{bounds:{x:bounds(),z:bounds()}}},camera={viewFx:[4096,0,0,0,0,4096,0,0,0,0,4096,0,0,0,0,4096],projectionFx:[4096,0,0,0,0,4096,0,0,0,0,-4096,-4096,0,0,-8192,0]},args={position,camera,image,depth24,knownMask,video:image};
let r=await refineGeometryPosition(args);assert(r.ready);assert.deepEqual(r.world,{xFx:0,zFx:0});assert(!r.currentCameraCertified);assert.equal(r.minimumProvenATCalls,0);checks.push({name:'same-image synthetic geometry has zero displacement',world:r.world,evaluations:r.evaluations});
r=await refineGeometryPosition({...args,knownMask:new Uint8Array(49152)});assert(!r.ready);assert.equal(r.reason,'Insufficient known source geometry edges');checks.push({name:'unknown source owners cannot manufacture position',reason:r.reason});
const far=structuredClone(position);far.world.xFx=4096000;far.coordinate.bounds.x.rawMin=4096000-4096;far.coordinate.bounds.x.rawMax=4096000+4096;
r=await refineGeometryPosition({...args,position:far,referenceWorld:{xFx:0,zFx:0}});assert(!r.ready);assert.equal(r.reason,'No finite source geometry refinement outcome');assert.equal(r.minimumProvenATCalls,0);checks.push({name:'disjoint previous source view still fails finite guard',reason:r.reason,evaluations:r.evaluations});
await assert.rejects(()=>refineGeometryPosition({...args,isCurrent:()=>false}),e=>e.name==='AbortError');checks.push({name:'cancelled geometry fails closed'});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
