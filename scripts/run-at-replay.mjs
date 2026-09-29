// Replay actual recorded ROM executions through production ARand/WASM/enc.json.
// This is the existing harness observation workflow, not synthetic fixtures or a test suite.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ATKernel,ATSession,replayObservedTrace} from '../web/at-core.mjs';
const trace=JSON.parse(await fs.readFile(new URL('../docs/observations/metaru-soubi-at32.json',import.meta.url),'utf8'));
const enc=JSON.parse(await fs.readFile(new URL('../web/data/enc.json',import.meta.url),'utf8')).main;
const wasm=await fs.readFile(new URL('../web/wasm/map_render.wasm',import.meta.url));
const {instance}=await WebAssembly.instantiate(wasm,{}),kernel=new ATKernel(instance);
const start=performance.now(),result=replayObservedTrace(trace,kernel,enc);
result.replayMs=performance.now()-start;
result.wasmsSha256=createHash('sha256').update(wasm).digest('hex');
result.recordedAt=new Date().toISOString();
// Analysis relative to the observed state anchor is explicitly a research forecast,
// not a user boot-session or a claimed proven initial seed.
const pairs=kernel.generate(trace.startSeed,0n,50000);let hits=[];
const {monsterForRandom}=await import('../web/at-core.mjs');
for(let i=0;i<pairs.length/2;i++){const m=monsterForRandom(enc['30'],pairs[2*i+1]);if(m.monster?.monsterName==='メタルスライム')hits.push({offset:i+1,seed:pairs[2*i],random:pairs[2*i+1],value:m.value});}
result.researchForecast={origin:'observed-state-relative-not-boot',window:50000,metalHits:hits.length,first:hits.slice(0,20),elapsedIncludingReplayMs:performance.now()-start};
result.metalCatalog=Array.from(new Map(Object.values(enc).flatMap(t=>t.data||[]).filter(m=>/^(メタルスライム|はぐれメタル|メタルキング|プラチナキング)$/.test(m.monsterName)).map(m=>[m.monsterId,m.monsterName])));
await fs.writeFile(new URL('../docs/observations/actual-at-replay.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(result.mismatches.length)process.exitCode=1;
