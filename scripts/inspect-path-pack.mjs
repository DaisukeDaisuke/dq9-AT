import fs from 'node:fs/promises';
import {NitroFS,Compression,BufferReader} from '../web/vendor/nitro-fs.mjs';
import {Narc} from '../web/vendor/narc-source.js';
import {decodeCalls} from '../web/map-core.mjs';
import '../web/vendor/gp2.js';
const r=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url)),n=NitroFS.fromRom(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));
const files=globalThis.NdsFontGp2.parseGp2(new Uint8Array(n.readFile('data/pack_lv5/path.gp2')));
const result=[];for(const f of files.filter(x=>/D04P02|F03P00/.test(x.path))){const a=Narc.load(f.data);for(let i=0;i<a.files.length;i++){let b=a.files[i];if(b[0]===16)b=Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength));let calls,error;try{calls=decodeCalls(b);}catch(e){error=e.message;}result.push({pack:f.path,path:a.fnt.getFilenameOf(i),size:b.length,opcodes:calls?[...new Set(calls.map(x=>x.opcode))]:[],calls:calls?.map(x=>({opcode:x.opcode,values:x.values})),error});}}
const metadata=JSON.parse(await fs.readFile(new URL('../docs/mining/map-metadata.json',import.meta.url),'utf8'));
await fs.writeFile(new URL('../docs/mining/path-member-inspection.json',import.meta.url),JSON.stringify({memberCount:files.length,names:files.map(x=>x.path),result,records:metadata.records.filter(x=>[7402,20003].includes(x.mapId))},null,2));
console.log(JSON.stringify({memberCount:files.length,result:result.map(x=>({...x,calls:x.calls?.slice(0,9)})),records:metadata.records.filter(x=>[7402,20003].includes(x.mapId)).map(x=>({mapId:x.mapId,args:x.args}))},null,2));
