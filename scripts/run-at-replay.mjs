// Replay real recorded ROM executions through the production ARand/WASM/enc.json path.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ATKernel,replayObservedTrace,selectFieldTables} from '../web/at-core.mjs';
import {FieldATKernel} from '../web/field-at.mjs';
import {metalCatalog} from '../web/monster-catalog.mjs';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await fs.readFile(new URL(path,root),'utf8'));
const enc=(await read('web/data/enc.json')).main,wasm=await fs.readFile(new URL('web/wasm/map_render.wasm',root));
const {instance}=await WebAssembly.instantiate(wasm,{}),kernel=new ATKernel(instance),field=new FieldATKernel(kernel);
const records=[],start=performance.now(),contexts=await read('docs/mining/encounter-contexts.json');
for(const path of ['docs/observations/metaru-soubi-at32.json','docs/observations/metaru-nasi-at128.json']){
 const trace=await read(path),replay=replayObservedTrace(trace,kernel,enc),tails=[];
 for(const [sequence,monsterId,tableId,mapId] of trace.spawnCreationEntries){const rows=contexts.groups.filter(g=>g.mapId===mapId&&g.condition.every(v=>v===0)).flatMap(g=>g.rows);const actual=field.naturalTail({seed:trace.startSeed,position:BigInt(sequence-2),rows,timeValue:2,areaMask:0,weightedReached:true},enc);const matches=actual.resolved&&actual.tableId===tableId&&Number(actual.monster?.monsterId)===monsterId;tails.push({sequence,monsterId,tableId,matches,consumed:actual.consumed,selectedMonster:Number(actual.monster?.monsterId)});}
 records.push({path,...replay,tailReplay:{basis:'observed branch entries and observed map7402 context, not inferred frame timing',rows:tails,mismatches:tails.filter(x=>!x.matches)}});
}
const observation=await read('docs/observations/map20003-field-tables.json'),graphRecord=await read('docs/observations/map20003-field-graph.json');
const areas=[...new Set(graphRecord.nodes.map(n=>n[2]))],areaTables=areas.map(areaMask=>({areaMask,actualTime:observation.timeValue,wasm:field.tableCandidates(observation.rows,observation.timeValue,areaMask).map(r=>r.tableId),reference:selectFieldTables(observation.rows,observation.timeValue,areaMask)}));
const targets=[...metalCatalog(enc).keys()],research=field.forecastNaturalTails({seed:(await read('docs/observations/metaru-nasi-at128.json')).startSeed,position:0n,rows:contexts.groups.find(g=>g.mapId===7402).rows,areaMasks:[0],timeValues:[2],targetIds:targets,window:50000},enc);
const result={format:'dq9-at-production-observation-replay',version:2,recordedAt:new Date().toISOString(),wasmSha256:createHash('sha256').update(wasm).digest('hex'),records,areaTables,metalCatalog:[...metalCatalog(enc)],researchForecast:{origin:'observed-state-relative-not-boot',window:50000,conditionalTailScenarios:research.scenarios,frameTimingKnown:research.frameTimingKnown},elapsedMs:performance.now()-start,bootProof:false};
result.mismatchCount=records.reduce((n,r)=>n+r.mismatches.length+r.tailReplay.mismatches.length,0)+areaTables.filter(x=>JSON.stringify(x.wasm)!==JSON.stringify(x.reference)).length;
await fs.writeFile(new URL('docs/observations/actual-at-replay.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(result.mismatchCount)process.exitCode=1;
