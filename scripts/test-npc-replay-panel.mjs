// Production controller with a synthetic DOM; this is not visual browser QA.
import assert from 'node:assert/strict';
import {attachNpcReplayPanel} from '../web/npc-at-replay-panel.mjs';
class Element{
 constructor(){this.textContent='';this.children=[];this.files=[];this.disabled=false;}
 set value(v){if(v==='')this.files=[];}
 replaceChildren(){this.children=[];}append(e){this.children.push(e);}
}
class Root extends Element{constructor(){super();this.nodes=new Map();}set innerHTML(s){this.html=s;}querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}}
globalThis.document={createElement:()=>new Element()};
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const result={resolved:true,conditionalConsumed:4,provedMinimumAT:0,originFrame:10,frames:[{sourceFrame:11}],controllers:[{},{}],seedBefore:1,seedAfter:2,draws:[]};
let resolve,reject,calls=0,saved=null;
const root=new Root(),get=k=>root.querySelector(`[data-npc="${k}"]`);
attachNpcReplayPanel(root,{send:()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b;});},save:(name,value)=>saved={name,value}});
const select=key=>{get(key).files=[new File(['{}'],key+'.json')];get(key).onchange();};
eq(get('run').disabled,true);
for(const k of ['origin','clocks'])select(k);eq(get('run').disabled,true);select('romData');eq(get('run').disabled,false);
const run=get('run').onclick();await get('run').onclick();eq(calls,1);eq(get('run').disabled,true);resolve(result);await run;eq(get('save').disabled,false);eq(get('status').textContent.includes('条件付き4 draw'),true);get('save').onclick();eq(saved.value,result);
const clear=get('run').onclick();get('clear').onclick();resolve(result);await clear;eq(get('run').disabled,true);eq(get('save').disabled,true);eq(get('result').children.length,0);
for(const k of ['origin','clocks','romData'])select(k);
const old=get('run').onclick();select('origin');resolve(result);await old;eq(get('run').disabled,false);eq(get('save').disabled,true);eq(get('result').children.length,0);
const bad=get('run').onclick();reject(Error('bad input'));await bad;eq(get('status').textContent,'予測できません: bad input');eq(get('save').disabled,true);
const unknown=get('run').onclick();resolve({...result,resolved:false,conditionalConsumed:0,reason:'unsupported mode',boundary:{sourceFrame:11,pc:0x020411d8}});await unknown;eq(get('status').textContent.includes('未解決境界で停止'),true);eq(get('result').children.some(p=>p.textContent.includes('unsupported mode')),true);
console.log(JSON.stringify({suite:'npc-replay-panel-controller',checks,passed:true,visualBrowserQA:false}));
