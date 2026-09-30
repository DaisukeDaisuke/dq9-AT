// Actual-ROM inspection for the missing field graph resource; reuses NitroFS/GP2.
import fs from 'node:fs/promises';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import '../web/vendor/gp2.js';
const root=new URL('../',import.meta.url);
const rom=await fs.readFile(process.argv[2]||new URL('../../dq9_new2.nds',import.meta.url));
const nitro=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
const all=[];function walk(dir,prefix=''){for(const f of dir.files)all.push({path:prefix+f.name,size:nitro.fileData[f.id].byteLength,id:f.id});for(const d of dir.directories)walk(d,prefix+d.name+'/');}walk(nitro.fnt.tree);
const metadata=JSON.parse(await fs.readFile(new URL('docs/mining/map-metadata.json',root),'utf8'));
const refs=metadata.records.filter(r=>[7402,0x7402].includes(r.mapId)||/エラフィタ/.test(r.name||''));
const inventory=all.filter(f=>/^data\/(map|pack|pack_lv5)\//.test(f.path));
const ext={};for(const f of inventory){const e=f.path.split('.').pop();ext[e]=(ext[e]||0)+1;}
const candidates=inventory.filter(f=>/node|graph|route|field|enemy|enc|D04|d04|F0[123]|f0[123]/.test(f.path));
const selected=process.argv.slice(3);const packs=[];
for(const path of selected){const data=new Uint8Array(nitro.readFile(path));if(path.endsWith('.gp2')){const members=globalThis.NdsFontGp2.parseGp2(data);packs.push({path,members:members.map(x=>({path:x.path,size:x.data.length,header:Array.from(x.data.slice(0,48))}))});}else packs.push({path,size:data.length,header:Array.from(data.slice(0,128))});}
const enc=JSON.parse(await fs.readFile(new URL('web/data/enc.json',root),'utf8'));
const result={date:new Date().toISOString(),header:nitro.cartridgeHeader,refs,extensions:ext,candidates,packNames:inventory.filter(x=>x.path.endsWith('.gp2')).map(x=>x.path),packs,encKeys:Object.keys(enc),table30:enc.main?.['30'],sampleNames:Object.values(enc.main||{}).flatMap(t=>t.data||[]).filter(m=>/メタル|はぐれ/.test(JSON.stringify(m))).slice(0,6)};
await fs.writeFile(new URL('docs/mining/field-resource-inspection.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify({saved:'docs/mining/field-resource-inspection.json',extensions:ext,candidateCount:candidates.length,packCount:result.packNames.length,packs:result.packs.map(p=>({path:p.path,size:p.size,members:p.members?.slice(0,12)}))},null,2));
