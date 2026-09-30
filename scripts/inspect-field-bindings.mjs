// Inspect only map/table-reference command metadata; never regenerate encounter weights.
import fs from 'node:fs/promises';
import {NitroFS,Compression,BufferReader} from '../web/vendor/nitro-fs.mjs';
import {decodeCalls} from '../web/map-core.mjs';
const rom=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url)),n=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
const result=[];
for(const path of ['data/map/maplist9.bin','data/prm/encmons.bin','data/prm/encfld.bin']){
 try{let b=new Uint8Array(n.readFile(path));if(b[0]===16)b=Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength));const calls=decodeCalls(b);const freq={};for(const c of calls)freq[c.opcode]=(freq[c.opcode]||0)+1;result.push({path,size:b.length,calls:calls.length,opcodes:freq,first:calls.slice(0,3).map(c=>({op:c.opcode,args:c.values})),knownMaps:calls.filter(c=>[7402,20003].includes(c.values[0])).slice(0,5).map(c=>({op:c.opcode,args:c.values}))});}catch(error){result.push({path,error:error.message});}}
console.log(JSON.stringify(result,null,2));
