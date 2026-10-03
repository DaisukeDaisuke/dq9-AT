import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NitroFS,Compression,BufferReader} from './web/vendor/nitro-fs.mjs';
import {Narc} from './web/vendor/narc-source.js';
import {readArm9SdkImage} from './web/rom-arm9.mjs';
import {buildStaticGeometry} from './web/static-geometry.mjs';
const [romPath,out]=process.argv.slice(2);if(!out)throw Error('Usage: original-ROM private-output');
const rom=await fs.readFile(romPath),hash=createHash('sha256').update(rom).digest('hex');if(hash!=='3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7')throw Error('ROM mismatch');
const n=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.length)),z=Narc.load(new Uint8Array(n.readFile('data/map/D04M02.amdj'))),sdk=readArm9SdkImage(rom),rows=[];
for(let i=0;i<z.files.length;i++){const name=z.fnt.getFilenameOf(i);if(!name?.endsWith('.nsbmd'))continue;
const b=z.files[i],bytes=b[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.length))):b;
try{const geometry=buildStaticGeometry(bytes,sdk.read(0x020e936c,36));rows.push({name,memberIndex:i,status:'decoded',draws:geometry.draws.length,vertices:geometry.draws.reduce((s,d)=>s+d.vertices.length,0),triangles:geometry.draws.reduce((s,d)=>s+d.indices.length/3,0),missingColors:geometry.draws.reduce((s,d)=>s+d.vertices.filter(v=>v.color555===null).length,0)});}catch(e){rows.push({name,memberIndex:i,status:'unsupported',reason:e.message});}}
await fs.writeFile(out,JSON.stringify({romSha256:hash,rows,scope:'Parser/adapter exercise only, not native geometry or pixel acceptance'},null,2)+'\n');console.log(JSON.stringify(rows));
