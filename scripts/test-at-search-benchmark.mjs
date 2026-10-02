import assert from 'node:assert/strict';
import {benchmark,bigState,oracleAccept,requestFor,WORKLOADS} from './benchmark-at-search.mjs';
assert.equal(bigState(0,1),12345);
assert.equal(bigState(0x12345678,4294967296n),0x12345678);
assert.equal(bigState(0x12345678,2147483648n),(0x12345678^0x80000000)>>>0);
for(const engine of['low31','index']){const q=requestFor(engine,WORKLOADS[0],17,{chunk:7});assert.equal(q.experiment.branches[0].events.length,2);assert.equal(oracleAccept(0,q.experiment.branches[0]),true);assert.equal(oracleAccept(0,q.experiment.branches[0],0),false);}
const r=await benchmark({count:257,repeats:1,chunk:63});
assert.equal(r.validation.length,37);
assert.equal(r.workloads.length,14);
for(const w of r.workloads){const t=w.trials[0];assert.equal(t.inspected,'257');assert.equal(t.searchCompleteWithinDomain,true);assert.equal(t.currentVideoStateRecovered,false);assert.equal(t.found,t.candidates);assert(t.adapterMs>0&&t.kernelMs>0);assert.equal(w.requestSHA256.length,64);assert.equal(w.maskSHA256.length,w.recipe.n);if(w.engine==='index'&&w.recipe.kind==='all'){assert.equal(t.candidates,'257');assert.equal(t.materialized,7);assert.equal(t.exportComplete,false);}}
console.log(JSON.stringify({passed:true,scope:'synthetic bounded benchmark runner, not native/video identification',validationCases:r.validation.length,workloads:r.workloads.length,inspectionsPerTrial:257}));
