import fs from 'node:fs/promises';
const r=JSON.parse(await fs.readFile(new URL('../docs/mining/map-structure.json',import.meta.url),'utf8'));
const compact=x=>({id:x.mapId,secondary:x.secondaryId,resource0:x.resource0,resource1:x.resource1,field:x.fieldCode,strings:x.rawArgs.map((a,i)=>a.string?{i,s:a.string}:null).filter(Boolean)});
console.log(JSON.stringify({records:r.records.length,shrine:r.shrine.map(compact),bmmp:r.bmmp.filter(x=>['D04M01.bmmp','D04.bmmp','C01.bmmp'].includes(x.path)),obg:r.obg.filter(x=>/D04|C01M0001/.test(x.path)),depths:[...new Set(r.obg.map(x=>x.depth))],badSize:r.obg.filter(x=>x.size!==x.expected),maxTileExceeds:r.obg.filter(x=>x.maxTile>=x.count).map(x=>x.path)},null,0));
