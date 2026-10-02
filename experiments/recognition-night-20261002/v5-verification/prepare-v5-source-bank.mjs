import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {NitroFS} from '../sources/dq9-AT-main/web/vendor/nitro-fs.mjs';
import {parseMonsterAssetCatalog} from '../sources/dq9-AT-main/web/monster-assets.mjs';
import {MonsterGeometry} from '../sources/dq9-AT-main/web/monster-geometry.mjs';
import {prepareLocalPositionBank} from '../sources/dq9-AT-main/web/monster-recognition-engine-v5-candidate.mjs';
import {cropRGBA} from '../sources/dq9-AT-main/web/monster-roi-descriptor.mjs';
import {pythonBackend} from './python-backend.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),rom=await fs.readFile('/workspace/scratch/4d4d74ad4379/split-rom-verification/verified-from-parts.nds'),wasm=await fs.readFile('../private-inputs/work1/vision-comparison/generated/monster_geometry.wasm');
if(hash(rom)!=='3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7')throw Error('ROM mismatch');
const {instance}=await WebAssembly.instantiate(wasm,{}),catalog=parseMonsterAssetCatalog(await fs.readFile('../sources/dq9-AT-main/web/data/monsters.csv','utf8')),backend=await pythonBackend(),old=JSON.parse(await fs.readFile('../private-inputs/work1/vision-comparison/references/BANK.json','utf8')),rows=[];
const originalEncode=backend.encodePatchGrid.bind(backend);let index=0;
backend.encodePatchGrid=async(image,options)=>{const reference=old.images[index++],{data,info}=await sharp(`../private-inputs/work1/vision-comparison/${reference.image_path}`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),im={width:info.width,height:info.height,rgba:data};let x0=64,y0=64,x1=0,y1=0;
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(data[(y*64+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}const tight=cropRGBA(im,x0,y0,x1-x0,y1-y0);
 rows.push({id:reference.id,work1_tight_sha256:hash(tight.rgba),production_tight_sha256:hash(image.rgba),same_pixels:hash(tight.rgba)===hash(image.rgba),dimensions:{width:image.width,height:image.height}});return originalEncode(image,options);};
try{const result=await prepareLocalPositionBank({romEpoch:1,modelIds:['z019b','z021a','z064a','z000c'],variant:'_f',preset:'quick',featureMethod:'dinov2',inferenceBackend:'wasm'},{nitro:NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.length)),catalog,geometry:new MonsterGeometry(instance),romSHA256:hash(rom),getDino:async()=>backend});
 if(process.argv.includes('--save-bank'))await fs.writeFile('private-evidence/v5-source-bank.json',JSON.stringify({model_sha256:'3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917',actual_provider:'Python ORT CPUExecutionProvider',references:result.bank.references.map(r=>({...r,cls:Array.from(r.cls),positives:r.positives.map(p=>({...p,vector:Array.from(p.vector)})),negative:Array.from(r.negative)}))}));
 await fs.writeFile('results/V5_ROM_REFERENCE_VERIFICATION.json',JSON.stringify({rom_sha256:hash(rom),geometry_sha256:hash(wasm),count:rows.length,every_reference_identical:rows.every(r=>r.same_pixels),rows,timings:result.timings,actual_provider:'Python ORT CPUExecutionProvider; not browser performance'},null,2));console.log(JSON.stringify({references:rows.length,same:rows.filter(r=>r.same_pixels).length}));
}finally{await backend.dispose();}
