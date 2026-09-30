// Production ROM-drop constructor + actual recorded table-context comparison.
import fs from 'node:fs/promises';
import {MapProject} from '../web/map-core.mjs';
import {contextRows} from '../web/encounter-context.mjs';
import {selectFieldTables} from '../web/at-core.mjs';
const root=new URL('../',import.meta.url),rom=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url));
const csv=await fs.readFile(new URL('web/data/map-id-names.csv',root),'utf8');
const p=new MapProject(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength),csv);
const metadata=p.metadata(),comparisons=[];
for(const path of ['docs/observations/map20003-field-tables.json','docs/observations/metaru-soubi-field-v2.json']){
 const o=JSON.parse(await fs.readFile(new URL(path,root),'utf8')),r=p.records.find(r=>r.mapId===o.mapId),rows=contextRows(r.encounterContexts).rows;
 const expected=(o.rows||o.tables).map(({tableId,flags})=>({tableId,flags})),actual=rows.map(({tableId,flags})=>({tableId,flags}));
 const graph=p.fieldGraphs.graphs.find(g=>g.key===r.fieldGraph.key);
 comparisons.push({source:path,mapId:o.mapId,rowsMatch:JSON.stringify(actual)===JSON.stringify(expected),actual,expected,nodeAreas:graph.areaMasks.map(areaMask=>({areaMask,time0:selectFieldTables(rows,0,areaMask),time2:selectFieldTables(rows,2,areaMask)}))});
}
const enc=JSON.parse(await fs.readFile(new URL('web/data/enc.json',root),'utf8')).main;
const missingExistingTables=p.encounterContexts.groups.flatMap(g=>g.rows.filter(r=>!enc[String(r.tableId)]).map(r=>({mapId:g.mapId,tableId:r.tableId})));
const result={date:new Date().toISOString(),summary:metadata.summary,comparisons,missingExistingTables,errors:p.errors,source:'production MapProject with actual ROM; existing encounter distributions unchanged'};
await fs.writeFile(new URL('docs/mining/encounter-contexts.json',root),JSON.stringify(p.encounterContexts,null,2));
await fs.writeFile(new URL('docs/observations/actual-production-contexts.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
// Missing pre-existing distributions stay explicitly unavailable; they are not re-mined.
if(p.errors.length||comparisons.some(x=>!x.rowsMatch))process.exitCode=1;
