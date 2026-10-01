import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {MapPositionMatcher} from '../web/map-position.mjs';
import {CandidateMapMatcher} from '../web/map-disambiguation.mjs';
import {splitFixedInterval,imageToMapCoordinateCandidate} from '../web/player-coordinate.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},ok=v=>{assert(v);checks++},bad=f=>{assert.throws(f);checks++};
const compact=r=>r.chunks.map(c=>[c.chunkSigned16,c.chunkUnsigned16,c.localRaw16.min,c.localRaw16.max]);
eq(compact(splitFixedInterval(-1,1)),[[-1,65535,65535,65535],[0,0,0,1]]);
eq(compact(splitFixedInterval(65535,65537)),[[0,0,65535,65535],[1,1,0,1]]);
eq(compact(splitFixedInterval(-65537,-65535)),[[-2,65534,65535,65535],[-1,65535,0,1]]);
for(const [a,b] of [[0,0],[-2147483648,-2147483648],[2147483647,2147483647],[-65536,-1]]){const r=splitFixedInterval(a,b);eq(r.worldMin,a/4096);eq(r.worldMax,b/4096);ok(r.complete);for(const c of r.chunks){ok(c.localRaw16.min>=0&&c.localRaw16.max<=65535);eq(c.chunkSigned16*65536+c.localRaw16.min,Math.max(a,c.chunkSigned16*65536));eq(c.chunkSigned16*65536+c.localRaw16.max,Math.min(b,(c.chunkSigned16+1)*65536-1));}}
const huge=splitFixedInterval(-2147483648,2147483647,{maxChunks:2});eq(huge.chunkCount,65536);eq(huge.chunks.length,2);eq(huge.omittedChunks,65534);eq(huge.complete,false);eq(huge.chunkSignedMax,32767);
for(const args of [[1,0],[NaN,0],[0,Infinity],[-2147483649,0],[0,2147483648],[0,1,{maxChunks:0}],[0,1,{maxChunks:33}],[0,1,{maxChunks:1.5}]])bad(()=>splitFixedInterval(...args));
const a=imageToMapCoordinateCandidate({imageX:112,imageY:240,originPixel:[-112,-208],scale:2,imageBounds:{left:111,top:239,right:113,bottom:241}});eq(a.x,0);eq(a.z,16);eq(a.bounds.x.chunkIntervals.chunks.map(c=>c.chunkSigned16),[-1,0]);eq(a.bounds.z.chunkIntervals.chunks.map(c=>c.chunkSigned16),[0,1]);eq(a.transformVerified,false);eq(a.bounds.x.calibratedCoverage,false);eq(a.minimumProvenATCalls,0);
const b=imageToMapCoordinateCandidate({imageX:120,imageY:96,originPixel:[-112,-96],scale:2.6660001277923584,imageBounds:{left:119,top:95,right:121,bottom:97}});eq(b.x,8/2.6660001277923584);ok(b.x!==4);eq(b.z,0);
const {instance}=await WebAssembly.instantiate(await fs.readFile(new URL('../web/wasm/map_render.wasm',import.meta.url)));const matcher=new MapPositionMatcher(instance);
const width=224,height=256,rgba=new Uint8Array(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){let v=(Math.imul(x+13,73856093)^Math.imul(y+7,19349663))>>>0;v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);v=(v^(v>>>16))>>>0;rgba.set([v&255,v&255,v&255,255],(y*width+x)*4);}
const image={width,height,rgba,originPixel:[0,0],descriptor:{worldToMapScale:2}},frame={width:128,height:96,rgba:new Uint8Array(128*96*4)};frame.rgba.fill(128);
for(let y=0;y<96;y++)for(let x=0;x<128;x++){const rx=x-18,ry=y+43;if(rx<0||rx>=112||ry<0||ry>=128)continue;let sum=0;for(let j=0;j<2;j++)for(let i=0;i<2;i++)sum+=rgba[((ry*2+j)*224+rx*2+i)*4];const v=Math.round(sum/4);frame.rgba.set([v,v,v,255],(y*128+x)*4);}
matcher.setReference(image);const coarse=matcher.match(frame,{scales:[.5],coarseSeeds:24,maxMilliseconds:5000}),dense=matcher.match(frame,{scales:[.5],denseTranslation:true,maxMilliseconds:5000});
eq(dense.best.dx,18);eq(dense.best.dy,-43);ok(dense.best.score>.999);ok(dense.search.evaluatedTranslations<=65536);eq(dense.search.budgetExhausted,false);eq(dense.search.method,'bounded-dense-translation-fallback');
const zero=matcher.match(frame,{scales:[.5],denseTranslation:true,maxMilliseconds:0});eq(zero.resolved,false);eq(zero.search.budgetExhausted,true);eq(zero.search.evaluatedTranslations,0);
const capped=matcher.match(frame,{scales:[.5,.5],denseTranslation:true,maxMilliseconds:5000});eq(capped.resolved,false);eq(capped.search.budgetExhausted,true);eq(capped.search.budgetReason,'translation-budget');ok(capped.search.evaluatedTranslations<=65536);bad(()=>matcher.match(frame,{denseTranslation:'true'}));
// Behavioral orchestration: all text-nominated references get their coarse pass
// before any dense pass; unfinished dense work remains an unknown alternative.
const project={records:[{mapId:1,candidates:[{path:'one'}]},{mapId:2,candidates:[{path:'two'}]}],descriptors:new Map()},driver=new CandidateMapMatcher(instance,project,{compose(){return image;}}),calls=[];
driver.matcher={setReference(im){this.path=im.descriptor;},match(_frame,options){calls.push([this.path,!!options.denseTranslation]);const stop=this.path==='two'&&options.denseTranslation;return{resolved:!!options.denseTranslation&&!stop,best:{score:.8},candidates:[{dx:0,dy:0,scale:.5,score:.8}],search:{planComplete:!stop,budgetExhausted:stop,budgetReason:stop?'translation-budget':null}};}};
const observed=driver.match(frame,{mapIds:[1,2],unsearchedTextPossible:true},{maxMilliseconds:5000});eq(calls.slice(0,4),[['one',false],['one',false],['two',false],['two',false]]);eq(calls.slice(4),[['one',true],['two',true]]);ok(observed.unknown.some(x=>x.mapId===2&&x.reason==='registration-dense-fallback-translation-budget'));eq(observed.mapIdentityResolved,false);eq(observed.resolvedMapId,null);eq(observed.minimumProvenATCalls,0);eq(observed.automaticATConsumption,false);
console.log(JSON.stringify({passed:true,checks,syntheticCoarseBest:coarse.best,denseBest:dense.best,scope:'Portable synthetic source tests; no private pixels, ROM, input keys or native state'}));
