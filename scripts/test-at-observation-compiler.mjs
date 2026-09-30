import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compileEvent,compileGap,compileExperiment} from '../web/at-observation-compiler.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const tables=JSON.parse(await readFile(root+'/web/data/enc.json','utf8')).main;
const weighted=(id,alternatives)=>({id,stateBoundary:'immediately-after-draw',operation:'weighted-species',tableSpeciesAlternatives:alternatives});
const node=(order,selected)=>({id:'node',stateBoundary:'immediately-after-draw',operation:'direct-output-modulo',eligibleNodeIdsInOrder:order,selectedNodeAlternatives:selected});
let checks=0;function check(v){assert(v);checks++;}function throws(f){assert.throws(f);checks++;}
const silverCatalogIds=(await readFile(root+'/web/data/monsters.csv','utf8')).split(/\r?\n/).map(r=>r.split(',')).filter(r=>r[1]==='z000c').map(r=>parseInt(r[0],16));assert.deepEqual(silverCatalogIds,[3,297]);checks++;
for(const species of [31,108,83,3,297]){
 const e=weighted('e',[{tableId:30,monsterId:species}]),r=compileEvent(e,{tables});check(r.exactPredicate);
 for(let o=0;o<32768;o++){const value=Number((16n*(BigInt(o)-1n))/32767n);const hit=tables[30].data.find(x=>value>=x.start&&value<=x.end);check(r.possibleMask[o]===Number(hit.monsterId===species));}
 check(r.fullUint32StateCount===2*r.postDrawStateClassCount);check(r.currentVideoStateRecovered===false);
}
const unavailable=compileEvent(weighted('unavailable',[{tableId:30,monsterId:3}]),{tables:null});check(unavailable.possibleOutputCount===32768);check(!unavailable.exactPredicate);
const union=compileEvent(weighted('union',[{tableId:30,monsterId:3},{tableId:30,monsterId:83}]),{tables});
for(let o=0;o<32768;o++){const value=Number((16n*(BigInt(o)-1n))/32767n);check(union.possibleMask[o]===Number(value>=10));}
for(const count of [1,2,3,7,31]){const order=Array.from({length:count},(_,i)=>i),r=compileEvent(node(order,[count-1]));for(let o=0;o<32768;o++)check(r.possibleMask[o]===Number(o%count===count-1));}
for(const event of [weighted('u',[]),weighted('u',[{tableId:65535,monsterId:3}]),node(null,[1]),node([],[1]),node([1,2],[])]){const r=compileEvent(event,{tables});check(r.possibleOutputCount===32768);check(!r.exactPredicate);}
const trap=compileEvent(weighted('trap',[{tableId:1,monsterId:3}]),{tables:{1:{maxRand:2,data:[{start:0,end:0,monsterId:9,trapMonster:true},{start:1,end:1,monsterId:3,trapMonster:false}]}}});check(trap.possibleOutputCount===32768);check(trap.unresolvedOutputCount>0);
const partial=compileEvent(weighted('hole',[{tableId:1,monsterId:3}]),{tables:{1:{maxRand:2,data:[{start:1,end:1,monsterId:9,trapMonster:false}]}}});check(partial.possibleMask[0]===1);check(partial.unresolvedMask[32767]===0);check(partial.possibleMask[32767]===0);
for(const x of [null,{},weighted('x',[null]),weighted('x',[{tableId:30,monsterId:NaN}]),node([,2],[2]),node([1],[256]),{...node([1],[1]),stateBoundary:'current-video-time'}])throws(()=>compileEvent(x,{tables}));
const ids=new Set(['a','b']);for(const raw of [{min:1,max:1},{min:'2',max:'9007199254740993'},{min:1,max:null},null]){const r=compileGap({from:'a',to:'b',callsBetweenPostStates:raw,provenance:'assumed'},ids);check(r.destinationDrawIncluded);check(r.gapInferredFromVideoTime===false);}
for(const raw of [{min:0,max:1},{min:2,max:1},{min:1,max:undefined},{min:NaN,max:null},{min:'01',max:null},{min:1.5,max:null}])throws(()=>compileGap({from:'a',to:'b',callsBetweenPostStates:raw,provenance:'assumed'},ids));
throws(()=>compileGap({from:'a',to:'a',callsBetweenPostStates:null,provenance:'unknown'},ids));
if(!process.argv[2]){console.log(JSON.stringify({passed:true,checks,scope:'synthetic and public-table predicate tests; private-video regression not requested',currentVideoStateRecovered:false},null,2));process.exit(0);}
const ledgerPath=process.argv[2],ledgerBytes=await readFile(ledgerPath),ledger=JSON.parse(ledgerBytes);
const silver=ledger.sightings.find(s=>s.id==='L01'),knight=ledger.sightings.find(s=>s.id==='K03'),emergence=ledger.directRenderedEvents.find(e=>e.id==='render-emergence-K03');
check(silver.provenBirth===false&&knight.provenBirth===false&&emergence.certifiedEngineEvent===null);
const input={sightings:[silver,knight],associationAlternatives:[{id:'same-silver-track',sightingId:'L01',sampleCount:5,generation:'g-silver'},{id:'knight-new',sightingId:'K03',possibility:'new-generation-emergence'},{id:'knight-existing',sightingId:'K03',possibility:'visibility-of-existing-generation'},{id:'label-error',possibility:'manual-label-error'}],hypotheses:[{id:'conditional-natural-births',association:'knight-new',assumptions:['table30','manual-species','natural-generation','generation-order'],sightingEventBindings:{K03:'knight',L01:'silver'},observationEdges:[{from:'silver',toSighting:'L01',callsAfterEvent:{min:0,max:null},provenance:'unknown-birth-to-observation'}],events:[weighted('knight',[{tableId:30,monsterId:83}]),weighted('silver',[{tableId:30,monsterId:3},{tableId:30,monsterId:297}])],edges:[{from:'knight',to:'silver',callsBetweenPostStates:{min:1,max:null},provenance:'assumed-order-only'}]},{id:'existing-or-occluded',association:'knight-existing',events:[],edges:[]},{id:'label-error',events:[],edges:[]}],coverage:{associationEnumerationComplete:false,eventHypothesesComplete:false},origin:{initialSeed:0x32741,provenance:'user-confirmed-run-origin; not current clip state'}};
for(const kind of ['existing-before-window','scripted-origin','unknown-origin']){
 input.associationAlternatives.push({id:'silver-'+kind,sightingId:'L01',possibility:kind,sameLocalGenerationAcrossFiveSamples:true,newDrawInObservedWindowCertified:false});
 input.hypotheses.push({id:'silver-'+kind,association:'silver-'+kind,sightingEventBindings:{L01:null},assumptions:['silver local track retained; no weighted event certified'],events:[],edges:[]});
}
const original=structuredClone(input),compiled=compileExperiment(input,{tables});assert.deepEqual(input,original);checks++;
check(compiled.branches[0].events.length===2);check(compiled.branches[0].events.filter(e=>e.id==='silver').length===1);check(compiled.branches[1].events.length===0);for(const kind of ['existing-before-window','scripted-origin','unknown-origin'])check(compiled.branches.find(b=>b.id==='silver-'+kind).events.length===0);check(compiled.branches[0].edges[0].callsBetweenPostStates.max===null);check(compiled.branches[0].observationEdges[0].callsAfterEvent.max===null);check(compiled.branches[0].observationEdges[0].destinationIsDraw===false);check(compiled.certifiedDrawsAddedFromSightings===0);check(compiled.currentVideoStateRecovered===false);check(compiled.jointCandidateCount===null);check(compiled.fullStateLiftAmbiguityRetained);
const repeated=structuredClone(input);repeated.sightings[0].positiveSampleTimesSeconds=[1216,1216.25,1216.5,1216.75,1217];const again=compileExperiment(repeated,{tables});assert.deepEqual(again.branches,compiled.branches);checks++;
const originless=structuredClone(input);delete originless.origin;assert.deepEqual(compileExperiment(originless,{tables}).branches,compiled.branches);checks++;
const summary={passed:true,checks,coverage:'predicate compilation and real-video-ledger association regression; no state search',ledgerSHA256:createHash('sha256').update(ledgerBytes).digest('hex'),videoRegression:{silverCatalogAlternatives:silverCatalogIds,silverSamples:5,silverLatentDrawsInConditionalBranch:1,certifiedDraws:0,knightBirthAndVisibilityBranchesRetained:true,unboundedGapRetained:true,eventStateIsNotCurrentVideoState:true},conditionalEvents:compiled.branches[0].events.map(({id,possibleOutputCount,postDrawStateClassCount,fullUint32StateCount,exactPredicate})=>({id,possibleOutputCount,postDrawStateClassCount,fullUint32StateCount,exactPredicate})),jointCandidateCount:null,currentVideoStateRecovered:false};

console.log(JSON.stringify(summary,null,2));
