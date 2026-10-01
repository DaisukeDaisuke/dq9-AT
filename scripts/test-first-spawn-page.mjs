#!/usr/bin/env node
import assert from 'node:assert/strict';
import {setupFirstSpawnPanel} from '../web/first-spawn-panel.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const ids=['spawn-replay-newborn','spawn-replay-status','spawn-replay-start','spawn-replay-step','spawn-replay-ten','spawn-replay-run','spawn-replay-cancel','spawn-replay-reset','spawn-replay-runtime','spawn-replay-trajectory','spawn-replay-declared','spawn-replay-inputs','spawn-replay-log','seed'];
const els=new Map(ids.map(id=>[id,{disabled:false,checked:false,value:id==='seed'?'1':'',files:[],textContent:'',listeners:{},addEventListener(n,f){this.listeners[n]=f;}}]));const $=id=>els.get(id);
let inputs={},draws=0,created=[],yields=[];
const controller=setupFirstSpawnPanel({document:{getElementById:$},getInputs:()=>inputs,redraw:()=>draws++,yieldTask:()=>new Promise(resolve=>yields.push(resolve)),create:o=>{
 const s={seed:o.seed,timer:0,consumed:0,events:[],heroTrace:[],birth:null,status:'ready',stopped:false,reason:'',advance(){this.timer++;this.consumed++;this.seed++;this.status='running';this.heroTrace.push([this.timer,0,0]);this.events.push({index:this.events.length,sourceFrame:null,heroXYZ:[this.timer,0,0],seed:this.seed,consumed:1,timer:this.timer,reason:'synthetic'});if(this.events.length===40){this.stopped=true;this.status='created';this.birth={species:83,slot:112,serial:1,xyz:[40,0,0]};return false;}return true;}};created.push({o,s});return s;
}});
const load=async(kind,data,size=100)=>{const e=$('spawn-replay-'+kind);e.files=[{size,text:async()=>JSON.stringify(data)}];await e.onchange();};
const start=()=>{$('spawn-replay-declared').checked=true;$('spawn-replay-declared').onchange();$('spawn-replay-start').onclick();};
eq($('spawn-replay-start').disabled,true);eq($('spawn-replay-runtime').disabled,true);
inputs={project:{}};controller.refresh();eq($('spawn-replay-runtime').disabled,false);
await load('runtime',{id:1});eq($('spawn-replay-start').disabled,true);await load('trajectory',{id:2});eq($('spawn-replay-start').disabled,true);start();eq(created.length,1);eq(created[0].o.seed,1);eq($('spawn-replay-step').disabled,false);
await $('spawn-replay-ten').onclick();eq(created[0].s.events.length,10);eq($('spawn-replay-run').disabled,false);
const running=$('spawn-replay-run').onclick();eq(created[0].s.events.length,26);eq($('spawn-replay-cancel').disabled,false);
$('spawn-replay-cancel').onclick();eq($('spawn-replay-run').disabled,false);yields.shift()();await running;eq(created[0].s.events.length,26);
await $('spawn-replay-run').onclick();eq(created[0].s.events.length,40);eq($('spawn-replay-step').disabled,true);assert.match($('spawn-replay-status').textContent,/species 83/);checks++;
// Restart during a yielded old run; old finally cannot clear the new busy state.
start();const oldRun=$('spawn-replay-run').onclick();eq(created[1].s.events.length,16);$('spawn-replay-reset').onclick();start();const newer=$('spawn-replay-run').onclick();eq(created[2].s.events.length,16);yields.shift()();await oldRun;eq($('spawn-replay-cancel').disabled,false);$('spawn-replay-cancel').onclick();yields.shift()();await newer;
// Seed edits invalidate the previous computation and declaration.
$('seed').value='2';$('seed').listeners.input();eq($('spawn-replay-step').disabled,true);eq($('spawn-replay-declared').checked,false);start();eq(created.at(-1).o.seed,2);
// Latest file wins; late success or failure cannot overwrite it.
let resolveA;const a=new Promise(r=>resolveA=r);$('spawn-replay-runtime').files=[{size:10,text:()=>a}];const readA=$('spawn-replay-runtime').onchange();await load('runtime',{id:3});resolveA(JSON.stringify({id:4}));await readA;start();eq(created.at(-1).o.runtime,{id:3});
let rejectB;const b=new Promise((r,j)=>rejectB=j);$('spawn-replay-trajectory').files=[{size:10,text:()=>b}];const readB=$('spawn-replay-trajectory').onchange();await load('trajectory',{id:5});const good=$('spawn-replay-status').textContent;rejectB(Error('old failure'));await readB;eq($('spawn-replay-status').textContent,good);start();eq(created.at(-1).o.trajectory,{id:5});
let resolveC;const c=new Promise(r=>resolveC=r);$('spawn-replay-runtime').files=[{size:10,text:()=>c}];const readC=$('spawn-replay-runtime').onchange();inputs={};controller.release();resolveC('{}');await readC;eq($('spawn-replay-start').disabled,true);eq($('spawn-replay-runtime').disabled,true);eq($('spawn-replay-log').textContent,'');
inputs={project:{}};controller.refresh();await load('runtime',{},9*1024*1024);assert.match($('spawn-replay-status').textContent,/8MiB/);checks++;eq($('spawn-replay-start').disabled,true);
await load('runtime',{});await load('trajectory',{});start();$('seed').value='3';controller.controlsChanged();eq($('spawn-replay-step').disabled,true);eq($('spawn-replay-declared').checked,false);eq($('spawn-replay-log').textContent,'');start();eq(created.at(-1).o.seed,3);
await load('runtime',{});await load('trajectory',{});start();const releasing=$('spawn-replay-run').onclick();controller.release();yields.shift()();await releasing;eq($('spawn-replay-cancel').disabled,true);eq($('spawn-replay-log').textContent,'');
await load('runtime',{});await load('trajectory',{});$('spawn-replay-newborn').checked=true;$('spawn-replay-newborn').onchange();eq($('spawn-replay-declared').checked,false);start();eq(created.at(-1).o.continueNewborn,true);$('spawn-replay-newborn').checked=false;$('spawn-replay-newborn').onchange();eq($('spawn-replay-step').disabled,true);eq($('spawn-replay-log').textContent,'');controller.release();eq($('spawn-replay-newborn').checked,false);
// Pending transition coordinates cannot render the closed source actor or a stale hero marker.
// Create a live session through the normal start path, then set its synthetic reached phase.
await load('runtime',{});await load('trajectory',{});start();const visible=created.at(-1).s;Object.assign(visible,{currentMapId:7401,mapTransitions:{},transitionIndex:3,pendingTransition:{phase:'map-changed-unplaced'},currentCoordinate:null,closedActors:[{}],actors:new Map(),birth:{species:83,slot:112,xyz:[1,2,3]},heroTrace:[]});controller.refresh();eq(controller.view().mapId,7401);assert.match($('spawn-replay-status').textContent,/現在座標 移動中または配置後未確定/);checks++;
const paints=[];const ctx=new Proxy({}, {get:(t,k)=>t[k]??((...a)=>paints.push([k,...a])),set:(t,k,v)=>(t[k]=v,true)});controller.draw(ctx,{x:0,z:0,scale:1});eq(paints.some(p=>p[0]==='fillRect'||p[0]==='arc'),false);
visible.requestedPlacement={mapId:7401,xyz:[0,3072,-16384],settledHeightKnown:false};controller.draw(ctx,{x:0,z:0,scale:1});eq(paints.some(p=>p[0]==='strokeRect'),true);const view=controller.view();view.requestedPlacement.xyz[0]=999;eq(visible.requestedPlacement.xyz[0],0);controller.controlsChanged();eq(controller.view(),null);eq($('spawn-replay-step').disabled,true);
console.log(JSON.stringify({passed:true,checks,scope:'Node-only small DOM controller; no browser/rendering claim',draws},null,2));
