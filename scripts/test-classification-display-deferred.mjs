import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createDeferredEvidenceJSON,renderClassificationSummary} from '../web/map-browser-preview/completed-classification-display.mjs';
import {recognitionDisplaySummary} from '../web/map-browser-preview/recognition-display-summary.mjs';

function fixture(){
 let nodes=0;
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.parentElement=null;this.listeners=new Map();this.dataset={};this.style={};this.open=false;this.text='';nodes++;}
  set textContent(value){this.text=String(value);this.replaceChildren();}get textContent(){return this.text+this.children.map(c=>c.textContent).join('');}
  get firstChild(){return this.children[0]??null;}
  append(...items){for(const n of items){n.parentElement=this;this.children.push(n);}}
  replaceChildren(...items){for(const n of this.children)n.parentElement=null;this.children=[];this.append(...items);}
  closest(tag){for(let n=this;n;n=n.parentElement)if(n.tagName===tag)return n;return null;}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  emit(name){for(const fn of this.listeners.get(name)??[])fn({target:this});}
  setAttribute(){}
 }
 const document={createElement:tag=>new Element(tag)},container=new Element('ol'),details=new Element('details'),pre=new Element('pre');details.append(pre);
 let serial=0;const queued=new Map(),all=new Map();
 const schedule=fn=>{queued.set(++serial,fn);all.set(serial,fn);return serial;},cancel=id=>queued.delete(id),flush=()=>{const work=[...queued];queued.clear();for(const [,fn] of work)fn();};
 return {document,container,details,pre,schedule,cancel,flush,queued,all,get nodes(){return nodes;},open(node){node.open=true;node.emit('toggle');},close(node){node.open=false;node.emit('toggle');}};
}
function observation(id='A'){
 const support={kind:'source-native-test',branches:[{branchId:'one',status:'evaluated-subset',ownGain:7,nullComparison:'improves-background-only',testedProposals:1,best:{proposalId:'p',positionFx:[1,2,3],fit:{pixelErrorReduction:7}},unsupported:[{reason:'retained unknown'}],assumptions:{condition:'test'},unknownAlternatives:['background']}]};
 return {schema:'test-observation',sightings:[{originalProposalId:id,sourcePTS:1,classificationEvidence:[{rankings:[{modelId:'m-'+id,similarity:.7,sourceNativeSupport:support}]}]}],unclassifiedRegionIds:['unseen'],coverage:{complete:false},classificationJob:{complete:true},minimumProvenATCalls:0};
}
function expandAll(f,node){if(node.tagName==='details')f.open(node);for(const c of node.children)expandAll(f,c);}

test('closed summary does not read rankings or allocate nested evidence',()=>{
 const f=fixture(),value=observation();Object.defineProperty(value.sightings[0],'classificationEvidence',{get(){throw Error('closed ranking traversed');}});
 renderClassificationSummary(f.container,value,{document:f.document});assert(f.nodes<25);assert.match(f.container.textContent,/残差 A/);
});
test('each nested level opens once and keeps diagnostics and original export intact',()=>{
 const f=fixture(),value=observation(),before=JSON.stringify(value);renderClassificationSummary(f.container,value,{document:f.document});
 const root=f.container.firstChild,outer=root.children.at(-1);assert.equal(outer.children.length,1);f.open(outer);const ranks=outer.children[1].children[0].children[0];assert.equal(ranks.children.length,1);
 f.open(ranks);const native=ranks.children[2];assert.equal(native.children.length,1);f.open(native);assert.match(native.textContent,/retained unknown/);assert.match(native.textContent,/自身の誤差減少量 7/);
 const count=f.nodes;f.close(native);f.open(native);assert.equal(f.nodes,count);assert.equal(JSON.stringify(value),before);
});
test('same displayed identity preserves opened details; clear and new values rebuild',()=>{
 const f=fixture(),value=observation();renderClassificationSummary(f.container,value,{document:f.document});const root=f.container.firstChild;expandAll(f,root);const count=f.nodes;
 renderClassificationSummary(f.container,value,{document:f.document});assert.equal(f.nodes,count);assert.equal(f.container.firstChild,root);
 f.container.replaceChildren();renderClassificationSummary(f.container,value,{document:f.document});assert.notEqual(f.container.firstChild,root);
 renderClassificationSummary(f.container,observation('B'),{document:f.document});assert.match(f.container.textContent,/残差 B/);assert.doesNotMatch(f.container.textContent,/残差 A/);
});
test('closed JSON skips projection, then opening shows the same full display summary',()=>{
 const f=fixture(),value=observation();let calls=0;const display=createDeferredEvidenceJSON(f.pre,v=>{calls++;return recognitionDisplaySummary(v);},f);
 display.set(value);assert.equal(calls,0);assert.equal(f.queued.size,0);f.open(f.details);assert.equal(calls,0);f.flush();assert.equal(calls,1);assert.equal(f.pre.textContent,JSON.stringify(recognitionDisplaySummary(value),null,2));
});
test('open JSON coalesces updates and publishes the newest result',()=>{
 const f=fixture();f.open(f.details);let calls=0;const display=createDeferredEvidenceJSON(f.pre,v=>{calls++;return v;},f),a={id:'A'},b={id:'B'};
 display.set(a);display.set(b);assert.equal(f.queued.size,1);f.flush();assert.equal(calls,1);assert.equal(f.pre.textContent,JSON.stringify(b,null,2));display.set(b);assert.equal(f.queued.size,0);
 display.set(a);assert.equal(f.queued.size,1);f.flush();assert.equal(f.pre.textContent,JSON.stringify(a,null,2));
});
test('close cancels queued JSON and reopening projects the latest value',()=>{
 const f=fixture();f.open(f.details);let calls=0;const display=createDeferredEvidenceJSON(f.pre,v=>{calls++;return v;},f);display.set({id:'A'});const stale=[...f.all.values()][0];f.close(f.details);stale();assert.equal(calls,0);assert.equal(f.pre.textContent,'');display.set({id:'B'});f.open(f.details);f.flush();assert.equal(calls,1);assert.match(f.pre.textContent,/B/);
});
test('clear prevents late display publication and releases shown content',()=>{
 const f=fixture();f.open(f.details);const display=createDeferredEvidenceJSON(f.pre,v=>v,f);display.set({id:'old'});const stale=[...f.all.values()][0];display.clear();stale();assert.equal(f.pre.textContent,'');f.flush();assert.equal(f.pre.textContent,'');display.set({id:'new'});f.flush();assert.match(f.pre.textContent,/new/);
});
test('dispose and remount leave exactly one listener and ignore all old work',()=>{
 const f=fixture();f.open(f.details);const old=createDeferredEvidenceJSON(f.pre,v=>v,f);old.set({id:'old'});const stale=[...f.all.values()][0],next=createDeferredEvidenceJSON(f.pre,v=>v,f);assert.equal(f.details.listeners.get('toggle').size,1);next.set({id:'new'});old.set({id:'wrong'});old.clear();stale();f.flush();assert.match(f.pre.textContent,/new/);old.dispose();assert.match(f.pre.textContent,/new/);next.dispose();assert.equal(f.details.listeners.get('toggle').size,0);next.set({id:'ignored'});f.open(f.details);f.flush();assert.equal(f.pre.textContent,'');
});
test('display expansion and JSON refresh do not change full exported observations',()=>{
 const f=fixture(),value=observation(),before=JSON.stringify(value);renderClassificationSummary(f.container,value,{document:f.document});expandAll(f,f.container.firstChild);const display=createDeferredEvidenceJSON(f.pre,recognitionDisplaySummary,f);display.set(value);f.open(f.details);f.flush();display.clear();assert.equal(JSON.stringify(value),before);
 const panel=readFileSync(new URL('../web/map-browser-preview/map-video-comparison.mjs',import.meta.url),'utf8');assert.match(panel,/const exported=latestCompletedClassification\?\.value\?\?classification/);assert.match(panel,/new Blob\(\[JSON.stringify\(exported,null,2\)\]/);assert.doesNotMatch(panel,/textContent=JSON.stringify\(recognitionDisplaySummary/);
});
