import fs from 'node:fs/promises';
import {NitroFS,Compression,BufferReader} from '../web/vendor/nitro-fs.mjs';
import {Narc} from '../web/vendor/narc-source.js';
import {decodeCalls} from '../web/map-core.mjs';
const r=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url)),n=NitroFS.fromRom(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));
const paths=[];function walk(d,p=''){for(const f of d.files)if(/D04M02|F03|node|route|field/i.test(p+f.name))paths.push(p+f.name);for(const s of d.directories)walk(s,p+s.name+'/');}walk(n.fnt.tree);
console.log('matching ROM paths',JSON.stringify(paths));
for(const p of paths.filter(x=>!/(\.nsb|\.col|\.gp2)/.test(x))){const raw=new Uint8Array(n.readFile(p));if(new TextDecoder().decode(raw.slice(0,4))!=='NARC')continue;const a=Narc.load(raw);const rows=[];for(let i=0;i<a.files.length;i++){let b=a.files[i];const path=a.fnt.getFilenameOf(i);if(/(nsb|col2)/.test(path))continue;let error,calls;try{if(b[0]===16)b=Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength));calls=decodeCalls(b).map(c=>({op:c.opcode,args:c.values}));}catch(e){error=e.message;}rows.push({path,size:b.length,header:Array.from(b.slice(0,16)),opcodes:calls?[...new Set(calls.map(x=>x.op))]:[],calls:calls?.slice(0,6),error});}console.log(p,JSON.stringify(rows));}
