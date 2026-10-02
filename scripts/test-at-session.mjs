// Portable session-ledger regression. Synthetic output sweeps test predicate
// accounting; only the separate ARand trace fixture exercises boot-prefix input.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ATKernel,ATSession,monsterForRandom} from '../web/at-core.mjs';
import {compileEvent} from '../web/at-observation-compiler.mjs';
import {ARand} from '../web/vendor/arand-reference.mjs';

let checks=0;const failures=[];
const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const throws=(f,message)=>{checks++;assert.throws(f,message);};
function test(name,f){try{f();console.log('PASS '+name);}catch(e){failures.push({name,message:e.message});console.error('FAIL '+name+': '+e.message);}}
const row=(start,end,monsterId=9,trapMonster=false)=>({start,end,monsterId,trapMonster});
const table=(...data)=>({maxRand:2,data});
const fixtures={
 trap:table(row(0,0,9,true),row(1,1,3)),
 overlap:table(row(0,0),row(0,0,8),row(1,1,3)),
 gap:table(row(1,1,3)),
 known:table(row(0,0),row(1,1,3)),
 noTarget:table(row(0,1)),
 noTargetButUnknown:table(row(0,0,9,true),row(1,1)),
 empty:{maxRand:2,data:[]},
 missing:null,
 malformed:{maxRand:0,data:[row(0,1)]},
 sparse:{maxRand:2,data:[,row(1,1,3)]}
};
const constantKernel={generate(seed,position,count){return new Uint32Array(count*2);}};
const sweepKernel={generate(seed,position,count){return Uint32Array.from({length:count*2},(_,i)=>i%2?Math.floor(i/2)%32768:0);}};
const observe=(session,tables,extra={},window=1)=>session.observeMonster({id:'sighting',tableIds:[1],monsterId:3,...extra},tables,window);
const bootTrace=count=>{let seed=0n;return {origin:'boot-known-initial',initialSeed:0,startPosition:'0',source:'synthetic arithmetic fixture, not a native observation',updates:Array.from({length:count},(_,i)=>{const before=seed,[after,random]=ARand(seed);seed=after;return {sequence:String(i+1),before:String(before),after:String(after),random:String(random)};})};};

for(const kind of ['trap','overlap','gap'])test(kind+' unresolved output retains earliest conditional index',()=>{
 const s=new ATSession(0,constantKernel),result=observe(s,{1:fixtures[kind]});
 eq(result.conditionalBound,'1');eq(result.candidates.positions,['1']);eq(result.candidates.tableMatches,[]);
 eq(result.candidates.unresolvedTableIds,[1]);
 eq(result.lowerBound,'0');eq(result.exactCurrentPosition,false);eq(result.candidates.tailPossible,true);
});
for(const [kind,fixture]of Object.entries(fixtures))test(kind+' full-output membership agrees with observation compiler',()=>{
 const tables={1:fixture},compiled=compileEvent({id:'weighted',stateBoundary:'immediately-after-draw',operation:'weighted-species',tableSpeciesAlternatives:[{tableId:1,monsterId:3}]},{tables});
 const s=new ATSession(0,sweepKernel);
 if(!compiled.possibleOutputCount){throws(()=>observe(s,tables,{},32768));eq(s.events,[]);eq(s.conditionalBound,0n);return;}
 const result=observe(s,tables,{},32768),actual=new Set(result.candidates.positions);
 for(let random=0;random<32768;random++)eq(actual.has(String(random+1)),!!compiled.possibleMask[random],kind+' random '+random);
 eq(result.conditionalBound,String(compiled.possibleMask.findIndex(v=>v)+1));
 eq(result.lowerBound,'0');eq(result.candidates.unsearchedTailFrom,'32769');eq(result.candidates.tailPossible,true);
});
test('union retains unknown branch regardless of table order and duplicates',()=>{
 for(const tableIds of [[1,2],[2,1],[1,2,1]]){
  const s=new ATSession(0,constantKernel),result=observe(s,{1:fixtures.noTarget,2:fixtures.trap},{tableIds});
  eq(result.conditionalBound,'1');eq(result.candidates.positions,['1']);eq(result.candidates.tableMatches,[]);eq(result.lowerBound,'0');
 }
});
test('resolved mismatch may narrow only the conditional branch',()=>{
 const s=new ATSession(0,constantKernel),r=observe(s,{1:fixtures.known});
 eq(r.conditionalBound,'2');eq(r.candidates.positions,[]);eq(r.candidates.unsearchedTailFrom,'2');eq(r.lowerBound,'0');eq(r.candidates.tailPossible,true);
});
test('natural-field assumption keeps destination draw offset separate from proof',()=>{
 const s=new ATSession(0,constantKernel),r=observe(s,{1:fixtures.trap},{naturalConfirmed:true});
 eq(r.conditionalBound,'2');eq(r.candidates.searchedFrom,'2');eq(r.candidates.positions,['2']);eq(r.lowerBound,'0');
});
test('map changes and video/input gaps preserve proved prefix and unknown suffix',()=>{
 const s=new ATSession(0,constantKernel);s.ingestBootTrace(bootTrace(4));
 const tables={1:fixtures.trap,2:fixtures.overlap,3:fixtures.gap};
 s.setMap({mapId:7402});observe(s,tables,{id:'A'});
 s.setMap({mapId:20003});s.noteInput({button:'left'});s.noteVideo({kind:'video-gap',reason:'synthetic seek'});
 s.noteUnresolvedConsumption({id:'gap',consumer:'map-entry'});observe(s,tables,{id:'B',tableIds:[2]});
 s.setMap(null);observe(s,tables,{id:'C',tableIds:[3]});
 const r=s.snapshot();eq(r.lowerBound,'4');eq(r.conditionalBound,'7');eq(r.currentPositionEnvelope.intervals,[{first:'7',last:null}]);eq(r.exactCurrentPosition,false);
 eq(r.consumerUncertainty.filter(e=>e.kind==='map-entry').length,3);eq(r.consumerUncertainty.every(e=>e.minimumCalls==='0'&&e.maximumCalls===null),true);
 const before=JSON.stringify(r);throws(()=>observe(s,{1:fixtures.gap},{id:'C'}));eq(JSON.stringify(s.snapshot()),before);
 const restored=ATSession.restore(JSON.parse(before),constantKernel,tables);
 eq(restored.snapshot(),JSON.parse(before));
});
test('boot prefix extends by absolute count, duplicate prefix never double counts',()=>{
 const s=new ATSession(0,constantKernel);s.ingestBootTrace(bootTrace(4));s.setMap({mapId:7402});s.ingestBootTrace(bootTrace(4));eq(s.lowerBound,4n);
 s.setMap({mapId:20003});s.ingestBootTrace(bootTrace(6));eq(s.lowerBound,6n);
 const before=JSON.stringify(s.snapshot());throws(()=>s.ingestBootTrace(bootTrace(3)));eq(JSON.stringify(s.snapshot()),before);
 const wrong=bootTrace(7);wrong.origin='paused-state-observation-not-boot';throws(()=>s.ingestBootTrace(wrong));eq(JSON.stringify(s.snapshot()),before);
 const broken=bootTrace(7);broken.updates[6].random='32768';throws(()=>s.ingestBootTrace(broken));eq(JSON.stringify(s.snapshot()),before);
 const reset=new ATSession(1,constantKernel);eq(reset.lowerBound,0n);throws(()=>reset.ingestBootTrace(bootTrace(7)));eq(reset.lowerBound,0n);
});
test('legacy saved inflated conditional bound fails safely after predicate correction',()=>{
 const s=new ATSession(0,constantKernel);observe(s,{1:fixtures.trap});
 const legacy=JSON.parse(JSON.stringify(s.snapshot()));legacy.conditionalBound='2';
 legacy.events[0].conditionalAfter='2';legacy.candidates.positions=[];
 throws(()=>ATSession.restore(legacy,constantKernel,{1:fixtures.trap}));eq(s.lowerBound,0n);eq(s.conditionalBound,1n);
});
test('restore rejects forged proof and conditional bound values',()=>{
 const s=new ATSession(0,constantKernel);observe(s,{1:fixtures.trap});
 for(const field of ['lowerBound','conditionalBound']){const saved=JSON.parse(JSON.stringify(s.snapshot()));saved[field]='999';throws(()=>ATSession.restore(saved,constantKernel,{1:fixtures.trap}));}
});
const wasm=(await WebAssembly.instantiate(await readFile(new URL('../web/wasm/map_render.wasm',import.meta.url)),{})).instance;
test('production WASM first draw retains each unresolved table branch',()=>{
 const kernel=new ATKernel(wasm);eq(kernel.generate(0,0n,1)[1],0);
 for(const kind of ['trap','overlap','gap']){
  const s=new ATSession(0,kernel),r=observe(s,{1:fixtures[kind]});
  eq(r.conditionalBound,'1');eq(r.lowerBound,'0');eq(ATSession.restore(JSON.parse(JSON.stringify(r)),kernel,{1:fixtures[kind]}).snapshot(),r);
 }
});
const publicTables=JSON.parse(await readFile(new URL('../web/data/enc.json',import.meta.url),'utf8')).main;
test('public resolved table predicates retain exact positive/negative filtering',()=>{
 const s=new ATSession(0,sweepKernel),result=observe(s,publicTables,{tableIds:[30]},32768),actual=new Set(result.candidates.positions);
 for(let random=0;random<32768;random++)eq(actual.has(String(random+1)),Number(monsterForRandom(publicTables[30],random).monster?.monsterId)===3);
 eq(result.lowerBound,'0');eq(result.candidates.unsearchedTailFrom,'32769');
});
console.log(JSON.stringify({passed:failures.length===0,checks,failures,scope:'portable synthetic session ledger and public encounter table; no native reachability, all-map proof increments or video identification'},null,2));
if(failures.length)process.exitCode=1;
