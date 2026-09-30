import fs from 'node:fs/promises';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import '../web/vendor/gp2.js';
const r=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url));
const n=NitroFS.fromRom(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));
for(const p of ['data/map/D04M02.ambl','data/map/D04M02.amdj','data/map/F03.ambl','data/map/F03.amdj']){const b=new Uint8Array(n.readFile(p));let members;try{members=globalThis.NdsFontGp2.parseGp2(b).map(x=>({path:x.path,size:x.data.length,header:Array.from(x.data.slice(0,24))}));}catch(e){members={error:e.message};}console.log(JSON.stringify({path:p,header:Array.from(b.slice(0,80)),strings:new TextDecoder('ascii').decode(b.slice(0,2000)).match(/[\w.\/-]{4,}/g)?.slice(0,35),members},null,2));}
