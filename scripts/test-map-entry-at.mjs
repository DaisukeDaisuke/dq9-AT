import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {ATKernel,ATSession} from '../web/at-core.mjs';import {projectMapEntry,deriveMapEntryMembership} from '../web/map-entry-at.mjs';
const {instance}=await WebAssembly.instantiate(await fs.readFile(new URL('../web/wasm/map_render.wasm',import.meta.url)),{}),kernel=new ATKernel(instance);
const call=(opcode,words,index)=>({opcode,index,offset:16+index*32,argumentCount:words.length,args:words.map((raw,i)=>({type:opcode===3&&words.length===5&&[2,3].includes(i)?0:1,raw:raw>>>0}))});
const origin=()=>({schema:'dq9-map-entry-origin-v1',frame:10,mapId:108,seed:123,epoch:'synthetic-local-only',ramSha256:'synthetic',story:[7,1,1],modeWord:2,questNibbles:{},storyBits:{}});
const source=(kinds=[0])=>({schema:'dq9-map-entry-source-v1',mapId:100,phaseOrder:['treasure-entry','npc-construction'],npc:{place:{calls:kinds.map((_,i)=>call(3,[100,i+1,0,0,0,0],i))},npc:{calls:kinds.map((kind,i)=>call(3,[i+1,kind,0xffffffff,0xffffffff,0],i))}},treasure:{format:'dq9-treasure-entry-source',map:{unknownOpcodes:[],entries:[{kind:0,entryId:5,sourceOrder:0,value:9,sourceFlags:0}]},tables:{tbox:{unknownOpcodes:[],rows:[]},ttt:{unknownOpcodes:[],rows:[]}}}});
const packet=(s=source(),o=origin(),id='entry-1')=>({id,source:s,origin:o,schedule:{originFrame:o.frame,endFrame:o.frame+1,segments:[{frames:1,buttons:[]}]}});
test('kind2 retains controller draw and does not receive an ordinary actor draw',()=>{const p=projectMapEntry(source([0,2,1]),origin(),kernel);assert(p.resolved);assert.deepEqual(p.draws.map(d=>[d.npcId,d.consumer]),[[3,'npc-controller-initialize'],[3,'npc-ordinary-actor-initialize'],[2,'npc-controller-initialize'],[1,'npc-controller-initialize'],[1,'npc-ordinary-actor-initialize']]);assert.equal(p.provedMinimumAT,0);assert.equal(p.bootProof,false);});
test('descriptor traversal is not truncated to32 storage slots',()=>{const p=projectMapEntry(source(Array(33).fill(1)),origin(),kernel);assert.equal(p.draws.length,66);assert.equal(p.membership.definitions.length,33);});
test('passed other-map conditional row removes; unconditional other-map row is a noop',()=>{const s=source();s.npc.place.calls.push(call(3,[101,1,0,0,0,0],1));assert.equal(deriveMapEntryMembership(s,origin()).definitions.length,1);s.npc.place.calls.push(call(5,[1,0,0,19,9,99,2,101,1,0,0,0,0],2));assert.equal(deriveMapEntryMembership(s,origin()).definitions.length,0);});
test('duplicate placements retain alternatives rather than claiming last-write-wins geometry',()=>{const s=source();s.npc.place.calls.push(call(3,[100,1,1,1,1,1],1));const m=deriveMapEntryMembership(s,origin());assert.equal(m.placementCandidates[0].alternatives.length,2);assert.equal(m.rankedPlacementGeometryResolved,false);assert.equal(m.definitions.length,1);});
test('unverified kind4 treasure fails closed, with unknown suffix and no invented0 proof',()=>{const s=source();s.treasure.map.entries.push({kind:4,entryId:6,sourceOrder:1,value:0,sourceFlags:64});const p=projectMapEntry(s,origin(),kernel);assert.equal(p.resolved,false);assert.equal(p.maximumActualAT,null);assert.equal(p.provedMinimumAT,0);assert.match(p.reason,/Kind4/);});
test('nonordinary unknown branch preserves its already projected controller prefix',()=>{const p=projectMapEntry(source([0,5]),origin(),kernel);assert.equal(p.resolved,false);assert.equal(p.draws.length,1);assert.equal(p.draws[0].npcId,2);assert.equal(p.boundary.afterClosedConditionalControllerDraw,true);});
test('setMap calls entry projection and JSON restore replays source, preserving unbounded suffix',()=>{const o=origin(),s=new ATSession(o.seed,kernel,{origin:'known-local-checkpoint',epoch:o.epoch});s.setMap({mapId:108});s.setMap({mapId:100},packet());const saved=JSON.parse(JSON.stringify(s.snapshot()));assert.equal(saved.conditionalBound,'2');assert.equal(saved.lowerBound,'0');assert.equal(saved.currentPositionEnvelope.exact,false);assert.deepEqual(ATSession.restore(saved,kernel,{}).snapshot(),saved);const before=JSON.stringify(s.snapshot());s.setMap({mapId:100},packet());assert.equal(JSON.stringify(s.snapshot()),before);assert.throws(()=>s.ingestBootTrace({origin:'boot-known-initial',initialSeed:o.seed,startPosition:'0',updates:[]}));});
test('a local source sequence does not promote an existing boot ledger proof',()=>{const s=new ATSession(0,kernel);const pair=kernel.generate(0,0n,1);s.ingestBootTrace({origin:'boot-known-initial',initialSeed:0,startPosition:'0',updates:[{sequence:1,before:0,after:pair[0],random:pair[1]}]});s.setMap({mapId:108});s.setMap({mapId:100},packet());assert.equal(s.lowerBound,1n);assert.equal(s.conditionalBound,1n);assert.equal(s.entryProjections[0].linkedToLocalEpoch,false);});
test('forged saved projection and bounds are rejected on replay',()=>{const o=origin(),s=new ATSession(o.seed,kernel,{origin:'known-local-checkpoint',epoch:o.epoch});s.setMap({mapId:108});s.setMap({mapId:100},packet());for(const field of ['conditionalBound','projection']){const saved=JSON.parse(JSON.stringify(s.snapshot()));if(field==='conditionalBound')saved.conditionalBound='999';else saved.events.at(-1).projection.draws[0].after=999;assert.throws(()=>ATSession.restore(saved,kernel,{}));}});
test('reentry is a fresh occurrence and overlapping entry windows are rejected',()=>{const o=origin(),s=new ATSession(o.seed,kernel,{origin:'known-local-checkpoint',epoch:o.epoch});s.setMap({mapId:108});s.setMap({mapId:100},packet());s.setMap({mapId:108});const next={...o,frame:11,seed:kernel.seedAt(o.seed,2n)};s.setMap({mapId:100},packet(source(),next,'entry-2'));assert.equal(s.conditionalBound,4n);assert.throws(()=>s.projectEntry(packet(source(),next,'overlap')));});

test('rejected setMap packets leave the complete ledger intact and permit retry',()=>{
 const o=origin(),s=new ATSession(o.seed,kernel,{origin:'known-local-checkpoint',epoch:o.epoch});s.setMap({mapId:108});
 const before=JSON.stringify(s.snapshot()),bad=packet();bad.schedule.endFrame=o.frame;
 assert.throws(()=>s.setMap({mapId:100},bad),/closed entry/);assert.equal(JSON.stringify(s.snapshot()),before);
 assert.throws(()=>s.setMap({mapId:101},packet()),/destination/);assert.equal(JSON.stringify(s.snapshot()),before);
 s.setMap({mapId:100},packet());const saved=JSON.stringify(s.snapshot());
 assert.throws(()=>s.setMap({mapId:101},packet()),/destination/);assert.equal(JSON.stringify(s.snapshot()),saved);
 s.setMap({mapId:108});const overlapBefore=JSON.stringify(s.snapshot()),overlap=packet(source(),{...o,seed:kernel.seedAt(o.seed,2n)},'entry-overlap');
 assert.throws(()=>s.setMap({mapId:100},overlap),/overlap/);assert.equal(JSON.stringify(s.snapshot()),overlapBefore);
 assert.deepEqual(ATSession.restore(JSON.parse(overlapBefore),kernel,{}).snapshot(),JSON.parse(overlapBefore));
});

test('main panel restores a local session through the production Worker without a boot label or handoff',async()=>{
 const {Worker:NodeWorker}=await import('node:worker_threads');
 const nodes=new Map(),workers=[],webRoot=new URL('../web/',import.meta.url).href;
 class Element{
  constructor(){this.children=[];this.nodes=new Map();this.files=[];this.value='';this.textContent='';this.disabled=false;this.classList={toggle(){}};}
  set innerHTML(html){for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes.set(m[1],new Element());}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=[...children];}add(child){this.append(child);}addEventListener(){}
  querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key);}
 }
 class BrowserWorker extends NodeWorker{
  constructor(url){super(`const {parentPort}=require('node:worker_threads');const fs=require('node:fs/promises');globalThis.self=globalThis;globalThis.fetch=async p=>{const bytes=await fs.readFile(new URL(p,${JSON.stringify(webRoot)}));return{ok:true,arrayBuffer:async()=>bytes,json:async()=>JSON.parse(bytes)};};globalThis.postMessage=m=>parentPort.postMessage(m);import(${JSON.stringify(String(url))}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});this.on('message',data=>this.onmessage?.({data}));this.on('error',error=>this.onerror?.(error));workers.push(this);}
 }
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},workspace=new Element();
 const globals={document:{createElement:()=>new Element(),getElementById:id=>nodes.get(id),querySelector:()=>workspace},window:{addEventListener(){},location:{href:'unchanged'}},localStorage:storage,sessionStorage:storage,Worker:BrowserWorker,Option:class extends Element{constructor(text,value){super();this.textContent=text;this.value=value;}},fetch:async p=>({json:async()=>JSON.parse(await fs.readFile(new URL(p,webRoot)))})};
 const previous=Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
  for(const [k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
  const {eventLogPreview}=await import('../web/at-panel.mjs');
  const rawRows=Array.from({length:20000},(_,i)=>({sequence:i,payload:'x'.repeat(100)}));
  const heavy={kind:'npc-continuation-observation',id:'large-native',evidence:{events:rawRows},comparison:{orderedConsumptionMatches:true,firstDifference:{field:'controllerFlags',expected:0,actual:1}}};
  const preview=eventLogPreview([heavy]);assert(preview.length<4096);assert.match(preview,/20000/);assert.match(preview,/controllerFlags/);assert(!preview.includes('payload'));assert.equal(heavy.evidence.events,rawRows);
  const smallEvent={kind:'monster-observation',id:'visible-id',monsterId:31,tableIds:[30]};assert.match(eventLogPreview([smallEvent]),/visible-id/);
  if(process.env.WORK8_SESSION_FIXTURE){
   const bytes=await fs.readFile(process.env.WORK8_SESSION_FIXTURE,'utf8'),actual=JSON.parse(bytes),before=JSON.stringify(actual);
   const start=performance.now(),rendered=eventLogPreview(actual.events),elapsedMs=performance.now()-start;
   assert(rendered.length<65536);assert.match(rendered,/controllerFlags/);assert.equal(JSON.stringify(actual),before);
   console.log(JSON.stringify({fixtureBytes:Buffer.byteLength(bytes),previewBytes:Buffer.byteLength(rendered),previewElapsedMs:elapsedMs,fullEvidenceUnchanged:true}));
  }
  // Preserve the memory-marked synthetic fixture as a rejected production input.
  const forbiddenOrigin=origin(),forbiddenSession=new ATSession(forbiddenOrigin.seed,kernel,{origin:'known-local-checkpoint',epoch:forbiddenOrigin.epoch});forbiddenSession.setMap({mapId:108});forbiddenSession.setMap({mapId:100},packet());
  const rejectedInput=nodes.get('at-restore');rejectedInput.files=[{text:async()=>JSON.stringify(forbiddenSession.snapshot())}];await rejectedInput.onchange();
  assert.match(nodes.get('at-message').textContent,/DST・メモリ/);assert.equal(memory.has('dq9-at-active-session'),false);
  // Independently authored numerical hypothesis; no memory capture/provenance.
  const o={schema:'dq9-map-entry-origin-v1',frame:10,mapId:108,seed:123,epoch:'synthetic-hand-authored',story:[7,1,1],modeWord:2,questNibbles:{},storyBits:{},provenance:'Synthetic arithmetic only; not a current video state'};
  const session=new ATSession(o.seed,kernel,{origin:'known-local-checkpoint',epoch:o.epoch});session.setMap({mapId:108});session.setMap({mapId:100},packet(source(),o));const saved=JSON.parse(JSON.stringify(session.snapshot()));
  const input=nodes.get('at-restore');input.files=[{text:async()=>JSON.stringify(saved)}];await input.onchange();
  assert.match(nodes.get('at-state').textContent,/既知局所checkpoint起点（起動証明なし）/);assert.doesNotMatch(nodes.get('at-state').textContent,/ · 起動起点/);
  assert.equal(nodes.get('at-bound').textContent,'0');assert.equal(nodes.get('at-conditional').textContent,'2');assert.match(nodes.get('at-envelope').textContent,/局所起点から/);
  assert.equal(nodes.get('at-identify-session').disabled,true);assert.match(nodes.get('at-identify-session').title,/起動seed前提/);
  assert.deepEqual(JSON.parse(memory.get('dq9-at-active-session')),saved);
  await nodes.get('at-identify-session').onclick();assert.equal(window.location.href,'unchanged');assert.match(nodes.get('at-message').textContent,/起動履歴の証明には変換しません/);
  const forged=structuredClone(saved);forged.conditionalBound='999';input.files=[{text:async()=>JSON.stringify(forged)}];await input.onchange();assert.deepEqual(JSON.parse(memory.get('dq9-at-active-session')),saved);
  nodes.get('at-seed').value='123';await nodes.get('at-start').onclick();assert.equal(nodes.get('at-state').textContent,'0x0000007b · 起動起点');assert.equal(nodes.get('at-identify-session').title,'');assert.doesNotMatch(nodes.get('at-envelope').textContent,/局所起点から/);
 }finally{await Promise.all(workers.map(w=>w.terminate()));for(const [k,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}
});

