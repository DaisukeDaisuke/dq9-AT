import fs from 'node:fs/promises';
import {NitroFS,Compression,BufferReader} from '../web/vendor/nitro-fs.mjs';
import {Narc} from '../web/vendor/narc-source.js';
import '../web/vendor/gp2.js';
const r=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url)),n=NitroFS.fromRom(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));
const entries=globalThis.NdsFontGp2.parseGp2(new Uint8Array(n.readFile('data/pack_lv5/path.gp2')));
for(const entry of entries.filter(x=>['D03P05.bin','F55P00.bin'].includes(x.path))){const a=Narc.load(entry.data);console.log(JSON.stringify({pack:entry.path,members:a.files.map((b,i)=>{const raw=Array.from(b.slice(0,24));if(b[0]===16)b=Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength));return {path:a.fnt.getFilenameOf(i),raw,size:b.length,header:Array.from(b.slice(0,24))};})}));}
