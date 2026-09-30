// Execute the production ROM miner against the user's ROM and real recorded memory, not synthetic cases.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import {decodeCalls} from '../web/map-core.mjs';
import {mineFieldGraphs,bindFieldGraphs,compareObservedGraph} from '../web/field-graph.mjs';
const root=new URL('../',import.meta.url),rom=await fs.readFile(process.argv[2]||new URL('../../dq9_new2.nds',import.meta.url));
const n=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
const start=performance.now(),mined=mineFieldGraphs(n,decodeCalls);
const metadata=JSON.parse(await fs.readFile(new URL('docs/mining/map-metadata.json',root),'utf8'));
bindFieldGraphs(metadata.records,mined);
mined.bindings=metadata.records.map(r=>({mapId:r.mapId,name:r.name,fieldCode:r.fieldCode,...r.fieldGraph}));
mined.summary.boundRecords=mined.bindings.filter(r=>r.key).length;
mined.summary.unboundRecords=mined.bindings.length-mined.summary.boundRecords;
const observed=[];for(const [path,key] of [['docs/observations/map7402-field-graph-fresh.json','D04P02.bin'],['docs/observations/map20003-field-graph.json','F03P00.bin']]){const o=JSON.parse(await fs.readFile(new URL(path,root),'utf8'));observed.push({source:path,mapId:o.mapId,graph:key,...compareObservedGraph(mined.graphs.find(g=>g.key===key),o)});}
const report={format:'dq9-at-actual-field-mining',createdAt:new Date().toISOString(),romSha256:createHash('sha256').update(rom).digest('hex'),summary:mined.summary,observed,milliseconds:performance.now()-start,errors:mined.errors};
await fs.writeFile(new URL('docs/mining/field-graphs.json',root),JSON.stringify(mined,null,2));
await fs.writeFile(new URL('docs/observations/actual-field-mining.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(mined.errors.length||observed.some(x=>!x.matches))process.exitCode=1;
