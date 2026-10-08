#!/usr/bin/env node
// Minimal DOM-only event harness, NOT a browser or visual/accessibility test.
// No network, browser, native fixture or private state. Pass the user's NDS path.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
if(!process.argv[2])throw Error('Usage: node scripts/test-monster-explorer-dom.mjs user.nds');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.disabled=false;this.checked=false;this._value='';this._text='';this.files=[];this.classList={toggle(){}};}
 get value(){return this._value;}set value(v){this._value=String(v);}get textContent(){return this._text;}set textContent(v){this._text=String(v);}
 append(...xs){this.children.push(...xs);if(this.tagName==='SELECT'&&this.children.length&&this.value==='')this.value=this.children[0].value;}
 replaceChildren(...xs){this.children=[];if(this.tagName==='SELECT')this.value='';this.append(...xs);}
 add(x){this.append(x);}setAttribute(){}addEventListener(n,fn){(this.listeners[n]??=[]).push(fn);}click(){this.onclick?.();}
 getContext(){return new Proxy({}, {get:(t,k)=>t[k]??(()=>{}),set:(t,k,v)=>(t[k]=v,true)});}
}
globalThis.Option=class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}};
globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const html=await readFile(new URL('../web/monster-explorer.html',import.meta.url),'utf8'),elements=new Map();
for(const m of html.matchAll(/<([a-z0-9]+)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){const e=new Element(m[1]);e.id=m[3];e.value=m[2].match(/\bvalue="([^"]*)"/)?.[1]??'';e.checked=/\bchecked\b/.test(m[2]);e.disabled=/\bdisabled\b/.test(m[2]);e.width=Number(m[2].match(/\bwidth="(\d+)"/)?.[1]??0);e.height=Number(m[2].match(/\bheight="(\d+)"/)?.[1]??0);elements.set(e.id,e);}
const $=id=>elements.get(id);globalThis.document={getElementById:$,createElement:tag=>new Element(tag)};
const fetched=[];globalThis.fetch=async path=>{assert(['./wasm/monster_movement.wasm','./wasm/map_render.wasm','./data/map-id-names.csv'].includes(path),'only static same-site source assets may be fetched');fetched.push(path);const b=await readFile(new URL('../web/'+path.slice(2),import.meta.url));return{ok:true,status:200,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),text:async()=>b.toString('utf8')};};
await import('../web/monster-explorer.mjs?v=motion-closure-20261008-89e290ef');assert($('step-ai').disabled);assert($('initialize').disabled);
const b=await readFile(process.argv[2]),rom=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),file={name:'user.nds',size:rom.byteLength,arrayBuffer:async()=>rom.slice(0)};
$('rom').files=[file];await $('rom').onchange();assert.equal($('inputs').disabled,false,$('status').textContent);assert.equal($('step-ai').disabled,true);
for(const id of ['no-other-actors','animation-type1','scene-complete','declared'])$(id).checked=true;
$('anchor-mode').value='none';$('anchor-mode').onchange();$('add-object').click();$('initial-ground').click();$('initialize').click();
assert.equal($('step-ai').disabled,false,$('status').textContent);assert.equal($('step-cycle10').disabled,false,$('readiness').textContent);$('step-cycle10').click();assert($('log').children.length>=31,$('status').textContent);
const before=$('log').children.length;$('external-count').value=3;$('external').click();assert.equal($('log').children.length,before+1);
$('angle').value=100;for(const f of $('config').listeners.input)f();assert.equal($('step-ai').disabled,true);assert.match($('readiness').textContent,/設定変更/);const retained=$('log').children.length;$('step-ai').click();assert.equal($('log').children.length,retained);
$('initialize').click();assert.equal($('log').children.length,1);assert.equal($('step-ai').disabled,false);
$('anchor-mode').value='unknown';$('anchor-mode').onchange();$('initialize').click();assert.equal($('step-ground').disabled,true);assert.equal($('step-ai').disabled,false);assert.match($('readiness').textContent,/anchor/);
$('x').value='';$('initialize').click();assert.match($('status').textContent,/未入力/);assert.equal($('log').children.length,1);$('x').value=0;
// Release while local file reading is unresolved. Late data cannot revive input.
let resolve;const pending=new Promise(r=>resolve=r);$('rom').files=[{...file,arrayBuffer:()=>pending}];const loading=$('rom').onchange();$('release').click();resolve(rom.slice(0));await loading;assert($('inputs').disabled);assert($('step-ai').disabled);assert.equal($('log').children.length,0);
// Bad file after a released session must not restore previous pose/resources.
$('rom').files=[{name:'bad.bin',size:200,arrayBuffer:async()=>new ArrayBuffer(200)}];await $('rom').onchange();assert($('inputs').disabled);assert($('step-ai').disabled);
// Repeated load works and no prior declaration or trajectory is carried.
$('rom').files=[file];await $('rom').onchange();assert.equal($('inputs').disabled,false,$('status').textContent);assert.equal($('declared').checked,false);assert.equal($('log').children.length,0);
// Latest selected config wins, even if an older file finishes reading later.
let exported;const create=URL.createObjectURL,revoke=URL.revokeObjectURL;URL.createObjectURL=blob=>{exported=blob;return 'blob:test';};URL.revokeObjectURL=()=>{};$('export-config').click();const initial=JSON.parse(await exported.text());
let finishA;const slowA=new Promise(r=>finishA=r);$('import-config').files=[{size:1000,text:()=>slowA}];const importA=$('import-config').onchange();$('import-config').files=[{size:1000,text:async()=>JSON.stringify({...initial,angle:222})}];await $('import-config').onchange();assert.equal($('angle').value,'222');finishA(JSON.stringify({...initial,angle:111}));await importA;assert.equal($('angle').value,'222');assert.equal($('declared').checked,false);
// Releasing while a config is reading also invalidates the import.
let finishC;const slowC=new Promise(r=>finishC=r);$('import-config').files=[{size:1000,text:()=>slowC}];const importC=$('import-config').onchange();$('release').click();finishC(JSON.stringify(initial));await importC;assert($('inputs').disabled);assert.equal($('log').children.length,0);URL.createObjectURL=create;URL.revokeObjectURL=revoke;
console.log(JSON.stringify({passed:true,scope:'Node-only minimal DOM event harness; no browser or visual QA',checks:['local ROM load','explicit initialization','10 predictive cycles','external draw','dirty setting disables stepping','reset initializes once','unknown anchor disables ground only','blank coordinate rejected','release during pending load','bad file','reload clears declarations and trace','latest config import wins','release invalidates pending config import'],staticAssetFetches:fetched.length},null,2));
