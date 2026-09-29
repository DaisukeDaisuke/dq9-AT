// Actual-ROM mining entry point. No fixture/test data; never writes extracted images or ROM bytes.
import fs from 'node:fs/promises';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import '../web/vendor/gp2.js';
const base = new URL('../', import.meta.url);
const romPath = process.argv[2] || new URL('../../dq9_new2.nds', import.meta.url);
const inventoryPath = new URL('../../LocalAI/work/dq9-respawn-timer/data/nds-data-inventory.json', base);
const result = {date: new Date().toISOString(), source: 'dq9_new2.nds', existingInventory: {}, archives: []};
try {
 const old = JSON.parse(await fs.readFile(inventoryPath,'utf8'));
 result.existingInventory.keys = Object.keys(old);
 const arrays = Object.entries(old).filter(([,v])=>Array.isArray(v));
 result.existingInventory.arrays = arrays.map(([k,v])=>({key:k,count:v.length}));
 for (const [k,v] of arrays) result.existingInventory[k] = v.filter(x=>/minimap|maplist9|w_offset/i.test(JSON.stringify(x)));
} catch(e) {result.existingInventory.error=e.message;}
const buffer=await fs.readFile(romPath);
const ab=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
const nitro=NitroFS.fromRom(ab);
result.header=nitro.cartridgeHeader;
function header(data,n=48){return Array.from(data.subarray(0,n));}
for (const p of ['data/pack_lv5/minimap.gp2','data/pack_lv5/minimapt.gp2']) {
 const data=new Uint8Array(nitro.readFile(p));
 const files=globalThis.NdsFontGp2.parseGp2(data);
 const entries=files.map((f,index)=>({index,path:f.path,size:f.data.length,magic:String.fromCharCode(...f.data.slice(0,4)),header:header(f.data)}));
 result.archives.push({path:p,size:data.length,count:files.length,entries});
}
for (const p of ['data/map/maplist9.bin','data/map/w_offset.bin']) {
 const b=new Uint8Array(nitro.readFile(p));
 result[p]={size:b.length,header:header(b,128)};
}
await fs.writeFile(new URL('docs/mining/rom-inventory.json',base),JSON.stringify(result,null,2));
console.log(JSON.stringify({existingInventory:result.existingInventory,header:result.header,archives:result.archives.map(a=>({...a,entries:a.entries.slice(0,12)})),maplist:result['data/map/maplist9.bin'],offset:result['data/map/w_offset.bin']},null,2));
