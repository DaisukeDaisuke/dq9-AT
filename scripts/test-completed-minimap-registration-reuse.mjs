import assert from 'node:assert/strict';import {test} from 'node:test';import {readFile} from 'node:fs/promises';
import {MapPositionMatcher} from '../web/map-position.mjs';
import {matchVideoMinimapRegistration} from '../web/map-browser-preview/video-minimap-registration.mjs';
import {createCompletedMinimapRegistrationReuse} from '../web/map-browser-preview/completed-minimap-registration-reuse.mjs';
const {instance}=await WebAssembly.instantiate(await readFile(new URL('../web/wasm/map_render.wasm',import.meta.url)),{});
const strip=x=>Array.isArray(x)?x.map(strip):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['elapsedMilliseconds','remainingMillisecondsAtDenseStart','sameFrameCompletedSearchReuse'].includes(k)).map(([k,v])=>[k,strip(v)])):x;
function fixture({blank=false}={}){let calls=0;const e={...instance.exports,map_registration:(...args)=>{calls++;return instance.exports.map_registration(...args);}},matcher=new MapPositionMatcher({exports:e}),mapImage={width:64,height:64,rgba:new Uint8ClampedArray(64*64*4),descriptor:{path:'a.bmmp'}},frame={width:32,height:32,rgba:new Uint8ClampedArray(32*32*4)},excluded=[];
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){const v=(x*17+y*31+x*y*7)%251;frame.rgba.set([blank?0:v,blank?0:v,blank?0:v,255],(y*32+x)*4);for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)mapImage.rgba.set([v,v,v,255],((2*y+dy)*64+2*x+dx)*4);}
 const reuse=createCompletedMinimapRegistrationReuse(),run=(mapId=1,path='a.bmmp',changes={})=>{const image={...mapImage,descriptor:{path}},f={matcher,frame,excluded,mapImage:image,mapId,...changes};f.matcher.setReference({...f.mapImage,mapId:f.mapId,descriptor:f.mapImage.descriptor.path});return reuse(f);};return{e,matcher,mapImage,frame,excluded,reuse,run,calls:()=>calls};}
test('completed coarse search reuses exact inputs with current per-map labels and independent copies',()=>{
 const f=fixture(),first=f.run(),count=f.calls();assert.equal(first.resolved,true);const second=f.run(2,'b.bmmp');assert.equal(f.calls(),count);assert(second.sameFrameCompletedSearchReuse);assert.equal(second.mapId,2);assert.equal(second.descriptor,'b.bmmp');assert.equal(f.matcher.reference.mapId,2);
 f.matcher.setReference({...f.mapImage,mapId:2,descriptor:'b.bmmp'});const actual=matchVideoMinimapRegistration(f.matcher,f.frame,{excluded:f.excluded});assert.deepEqual(strip(second),strip(actual));assert.notStrictEqual(second.candidates,first.candidates);second.candidates[0].score=-1;first.candidates[0].score=-2;const third=f.run(3,'c.bmmp');assert(third.candidates[0].score>.9);assert.equal(third.sameFrameCompletedSearchReuse.searchTimingsReferToOriginalComputation,true);
});
test('completed unresolved dense fallback stays unresolved and rebinds nested initial metadata',()=>{
 const f=fixture({blank:true}),first=f.run(),count=f.calls();assert.equal(first.resolved,false);assert.equal(first.search.planComplete,true);assert.equal(first.search.method,'bounded-dense-translation-fallback');const second=f.run(2,'b.bmmp');assert.equal(f.calls(),count);assert(second.sameFrameCompletedSearchReuse);assert.equal(second.resolved,false);assert.equal(second.fallback.initialRegistration.mapId,2);assert.equal(second.fallback.initialRegistration.descriptor,'b.bmmp');
 f.matcher.setReference({...f.mapImage,mapId:2,descriptor:'b.bmmp'});assert.deepEqual(strip(second),strip(matchVideoMinimapRegistration(f.matcher,f.frame,{excluded:f.excluded})));
});
test('budget-exhausted incomplete searches are rerun and never returned as completed reuse',()=>{
 const f=fixture(),descriptor=Object.getOwnPropertyDescriptor(performance,'now');let clock=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>clock+=2000});let first;try{first=f.run();}finally{if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;}assert.equal(first.search.budgetExhausted,true);assert.equal(first.search.planComplete,false);assert.equal(first.resolved,false);const second=f.run();assert.equal(second.sameFrameCompletedSearchReuse,undefined);assert.equal(second.search.planComplete,true);assert(f.run().sameFrameCompletedSearchReuse);
});
test('reference/frame pixel changes, alpha, dimensions, exclusions and algorithm identity invalidate reuse',()=>{
 for(const mutate of [f=>f.mapImage.rgba[0]++,f=>f.mapImage.rgba[3]=0,f=>f.frame.rgba[0]++,f=>f.excluded.push({x:0,y:0,w:4,h:4}),f=>{f.mapImage.width=32;f.mapImage.height=128;},f=>{f.frame.width=16;f.frame.height=64;},f=>{f.e.map_registration=(...args)=>instance.exports.map_registration(...args);}]){const f=fixture();f.run();mutate(f);assert.equal(f.run().sameFrameCompletedSearchReuse,undefined);}
});
test('owned input keys detect in-place mutations and the slot retains only the latest completed input',()=>{
 const f=fixture();f.run();const old=f.frame.rgba.slice();f.frame.rgba[0]^=127;f.run();f.frame.rgba.set(old);assert.equal(f.run().sameFrameCompletedSearchReuse,undefined);assert(f.run().sameFrameCompletedSearchReuse);const other=createCompletedMinimapRegistrationReuse();f.matcher.setReference({...f.mapImage,mapId:1,descriptor:'a.bmmp'});assert.equal(other({matcher:f.matcher,frame:f.frame,excluded:f.excluded,mapImage:f.mapImage,mapId:1}).sameFrameCompletedSearchReuse,undefined);
});
test('custom matchers and out-of-bound input keys keep the ordinary search path',()=>{
 let calls=0;const matcher={match(){calls++;return{kind:'video-map-registration',resolved:true,search:{planComplete:true,budgetExhausted:false},candidates:[]};}},reuse=createCompletedMinimapRegistrationReuse(),f=fixture();reuse({...f,matcher});reuse({...f,matcher});assert.equal(calls,2);
 const g=fixture();g.excluded.push(...Array.from({length:257},()=>({x:0,y:0,w:0,h:0})));g.run();assert.equal(g.run().sameFrameCompletedSearchReuse,undefined);
});

test('exclusion keys include only consumed finite coordinates, ignoring unconsumed/cyclic metadata',()=>{
 const f=fixture(),box={x:0,y:0,w:0,h:0,extra:'x'.repeat(1024*1024)};f.excluded.push(box);f.run();const count=f.calls();box.extra=box;Object.defineProperty(box,'ignored',{get(){throw Error('unconsumed property read');}});const reused=f.run(2,'b.bmmp');assert(reused.sameFrameCompletedSearchReuse);assert.equal(f.calls(),count);box.w=1;assert.equal(f.run().sameFrameCompletedSearchReuse,undefined);
});
