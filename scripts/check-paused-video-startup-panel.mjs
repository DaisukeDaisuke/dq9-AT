// Production panel control flow in a Node VM. Synthetic pixels/capture binding,
// fake DOM/video and deferred background only; no browser/decoder accuracy claim.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {createVideoTrackingCapture} from '../web/map-browser-preview/video-tracking-capture.mjs';
const panelURL=new URL('../web/map-browser-preview/map-video-comparison.mjs?v=upper-reasons-20261008-719ff923',import.meta.url),source=await readFile(panelURL,'utf8'),imports=new Map();
for(const spec of [...source.matchAll(/^import.*?from\s*['"]([^'"]+)['"]/gm)].map(m=>m[1]))imports.set(spec,await import(new URL(spec,panelURL)));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const turns=async(n=20)=>{for(let i=0;i<n;i++)await Promise.resolve();};
async function fixture({romReady=true,decoded=true,bound=true}={}){
 const elements=new Map(),windowListeners=new Map(),backgrounds=[],captures=[];let playCalls=0;
 class Element{
  constructor(tag='div'){this.tag=tag;this.listeners=new Map();this.children=[];this.style={};this.dataset={};this.value='0';this.checked=false;this.open=false;this.width=256;this.height=192;}
  addEventListener(n,fn){if(!this.listeners.has(n))this.listeners.set(n,new Set());this.listeners.get(n).add(fn);}removeEventListener(n,fn){this.listeners.get(n)?.delete(fn);}emit(n){for(const fn of this.listeners.get(n)??[])fn({target:this});}
  set textContent(v){this.text=String(v);this.children=[];}get textContent(){return this.text??'';}get firstChild(){return this.children[0]??null;}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(){}removeAttribute(n){delete this[n];}
  closest(){return this.detail??=new Element('details');}insertAdjacentElement(){}
  getContext(){return this.context??={drawImage(){},putImageData(){},clearRect(){},strokeRect(){},fillText(){},getImageData(_x,_y,w,h){return{data:new Uint8ClampedArray(w*h*4),width:w,height:h};}};}
 }
 const document={createElement:tag=>new Element(tag),getElementById:id=>{if(!elements.has(id)){const e=new Element(id.includes('video')?'video':'div');e.id=id;elements.set(id,e);}return elements.get(id);}},$=document.getElementById;
 const video=$('comparison-video');Object.assign(video,{currentTime:1,pixelPTS:1,duration:100,videoWidth:1920,videoHeight:1080,readyState:decoded?2:0,paused:true,seeking:false,ended:false,error:null,playbackRate:1,load(){},pause(){if(!this.paused){this.paused=true;this.emit('pause');}},play(){playCalls++;this.paused=false;this.emit('play');return Promise.resolve();},requestVideoFrameCallback(fn){this.frame=fn;return 1;},cancelVideoFrameCallback(){this.frame=null;}});
 const window={addEventListener(n,fn){if(!windowListeners.has(n))windowListeners.set(n,new Set());windowListeners.get(n).add(fn);},emit(n){for(const fn of windowListeners.get(n)??[])fn();}};
 const capture=()=>{const pts=video.pixelPTS;return{draw(){},stamp:s=>({...structuredClone(s),mediaTime:pts,videoTime:pts,timestampBasis:'retained-VideoFrame.timestamp',callbackStamp:structuredClone(s),captureTiming:{pixelTimestampBound:bound,pixelTimestampUs:Math.round(pts*1e6)}}),bind(){},close(){},evidence:()=>({}),result:()=>null};};
 const context=vm.createContext({document,window,console,URL,Blob,File,DOMException,performance,structuredClone,Uint8Array,Uint8ClampedArray,ArrayBuffer,setTimeout,clearTimeout,ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},crypto:{subtle:{digest:async()=>new Uint8Array(32).buffer}}});
 const module=new vm.SourceTextModule(source,{context,identifier:panelURL.href});
 await module.link(spec=>{let values=imports.get(spec);
  if(spec.includes('/capture-analysis-pixels.mjs'))values={...values,createFrozenAnalysisCapture:capture};
  if(spec.includes('/video-tracking-capture.mjs'))values={...values,createVideoTrackingCapture:args=>createVideoTrackingCapture({...args,document,makeCapture:capture,hash:async()=>{captures.push(video.pixelPTS);return'0'.repeat(64);}})};
  return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});
 });await module.evaluate();
 const api=module.namespace.mountMapVideoComparison({canAnalyze:()=>romReady,getRomIdentity:()=>'rom',deriveMapBackground:input=>{const held=deferred();backgrounds.push({...held,input});return held.promise;},derivePlayerBackground:async()=>{},renderBackground:async()=>{},classifyResiduals:()=>{throw Error('No positive classification is expected in this fixture');}});
 $('comparison-file').files=[new File(['synthetic'],'fixture.webm')];$('comparison-file').onchange();
 return{api,$,video,window,backgrounds,captures,get playCalls(){return playCalls;},setROM:value=>romReady=value,async waitBackground(){for(let i=0;i<30&&!backgrounds.length;i++)await turns();assert(backgrounds.length,'background preparation started');},finish(){backgrounds.at(-1)?.resolve();}};
}
test('actual panel keeps a decoded paused file held through background preparation and resumes without enemy proof',async()=>{
 const f=await fixture(),pending=f.api.startAutomatic();await f.waitBackground();assert.equal(f.playCalls,0);assert.equal(f.video.paused,true);assert.equal(f.video.currentTime,1);assert.equal(f.api.measuredTrackingSnapshot().retainedFrames,1);assert.equal(f.api.measuredTrackingSnapshot().recentGaps.length,0);assert(f.captures.length>=1);f.finish();const result=await pending;assert.equal(result.started,true);assert.equal(f.playCalls,1);assert.equal(f.api.timelineSnapshot().frames[0].sourcePTS,1);assert.equal(f.api.hasComparison(),false);f.api.stopAutomatic();
});
for(const reason of ['stop','seek','replacement','unload','error'])test(`actual panel ${reason} blocks stale resume`,async()=>{
 const f=await fixture(),pending=f.api.startAutomatic();await f.waitBackground();
 if(reason==='stop')f.api.stopAutomatic();if(reason==='seek'){f.video.seeking=true;f.video.emit('seeking');}if(reason==='replacement'){f.$('comparison-file').files=[new File(['second'],'replacement.webm')];f.$('comparison-file').onchange();}if(reason==='unload')f.window.emit('pagehide');if(reason==='error'){f.video.error={message:'synthetic media error'};f.video.emit('error');}
 f.finish();assert.equal((await pending).started,false);assert.equal(f.playCalls,0);f.api.stopAutomatic();
});
test('actual second Start waits for the same paused preparation and only the latest resumes',async()=>{
 const f=await fixture(),first=f.api.startAutomatic();await f.waitBackground();const second=f.api.startAutomatic();await turns();assert.equal(f.backgrounds.length,1);f.finish();const a=await first,b=await second;assert.equal(a.started,false);assert.equal(b.started,true);assert.equal(f.playCalls,1);assert.equal(f.backgrounds.length,1);f.api.stopAutomatic();
});
test('unknown-map background outcome can resume once its real frozen frame is retained',async()=>{
 const f=await fixture(),pending=f.api.startAutomatic();await f.waitBackground();f.backgrounds[0].reject(Error('map remains unresolved'));const result=await pending;assert.equal(result.started,true);assert.equal(f.playCalls,1);assert.equal(f.api.hasComparison(),false);assert.equal(f.api.measuredTrackingSnapshot().retainedFrames,1);f.api.stopAutomatic();
});
test('already-playing Start holds the first admitted slow analysis and resumes after completion',async()=>{
 const f=await fixture();f.video.paused=false;const pending=f.api.startAutomatic();assert.equal(f.playCalls,1);assert.equal(f.video.paused,true);await f.waitBackground();f.finish();await pending;await turns();assert.equal(f.video.paused,false);assert.equal(f.playCalls,2);f.api.stopAutomatic();
});
test('not-yet-decoded and ROM-not-ready Starts preserve their immediate playback behavior',async()=>{
 for(const options of [{decoded:false},{romReady:false}]){const f=await fixture(options);await f.api.startAutomatic();assert.equal(f.playCalls,1);assert.equal(f.backgrounds.length,0);f.api.stopAutomatic();}
});
test('unbound pixel timestamps never satisfy the new retained-seed readiness guard',async()=>{
 const f=await fixture({bound:false}),pending=f.api.startAutomatic();await f.waitBackground();f.finish();const result=await pending;assert.equal(result.reason,'startup-frame-unavailable');assert.equal(f.playCalls,0);assert.equal(f.api.measuredTrackingSnapshot().retainedFrames,0);f.api.stopAutomatic();
});
