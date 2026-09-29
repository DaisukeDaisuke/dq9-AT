// Actual-ROM entry point for the production WebAssembly map miner, not a test harness.
import fs from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {MapProject,MapRenderer} from '../web/map-core.mjs';
const rom=await fs.readFile(process.argv[2]||new URL('../../dq9_new2.nds',import.meta.url));
const csv=await fs.readFile(new URL('../web/data/map-id-names.csv',import.meta.url),'utf8');
const wasm=await fs.readFile(new URL('../web/wasm/map_render.wasm',import.meta.url));
const begin=performance.now(),{instance}=await WebAssembly.instantiate(wasm,{}),renderer=new MapRenderer(instance);
const project=new MapProject(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength),csv);
const metadata=project.metadata(),report={createdAt:new Date().toISOString(),rom:{name:'dq9_new2.nds',size:rom.length,gameCode:project.header.gameCode,sha256:createHash('sha256').update(rom).digest('hex')},wasmSha256:createHash('sha256').update(wasm).digest('hex'),summary:metadata.summary,images:[],composites:[],specialPacks:[]};
for(const a of project.assets.values()){
 if(a.info){try{const x=renderer.decodeAsset(a);report.images.push({path:a.path,width:x.width,height:x.height,rgbaHash:createHash('sha256').update(x.rgba).digest('hex')});}catch(e){report.images.push({path:a.path,error:e.message});}}
 if(a.path.endsWith('.pac')){const b=a.data,signatures=[];for(let i=0;i+4<b.length;i++){const s=String.fromCharCode(...b.subarray(i,i+4));if(['NARC','BNCG','RGCN','RLCN','RCSN','BNSC','BNCL','RLCM'].includes(s))signatures.push({offset:i,magic:s,header:Array.from(b.subarray(i,i+48))});}report.specialPacks.push({path:a.path,size:b.length,header:Array.from(b.subarray(0,128)),ascii:new TextDecoder('ascii').decode(b.subarray(0,128)).replace(/[^ -~]/g,'.'),signatures});}
}
for(const d of project.descriptors.values())try{const x=renderer.compose(project,d.path);report.composites.push({path:d.path,width:x.width,height:x.height,originPixel:x.originPixel,parts:x.parts});}catch(e){report.composites.push({path:d.path,error:e.message});}
report.elapsedMs=performance.now()-begin;
await fs.writeFile(new URL('../docs/observations/actual-map-wasm.json',import.meta.url),JSON.stringify(report,null,2));
await fs.writeFile(new URL('../docs/mining/map-metadata.json',import.meta.url),JSON.stringify(metadata,null,2));
// PNG observations remain outside the repository, never in web/ or any transfer selection.
const privateDir=new URL('../../dq9-at-observations/',import.meta.url);await fs.mkdir(privateDir,{recursive:true});
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,bytes){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([t,bytes])));return Buffer.concat([len,t,bytes,crc]);}
for(const name of ['D04M01.bmmp','D04M02.bmmp','C01.bmmp','mapt_001.pac']){try{const image=name.endsWith('.pac')?renderer.decodeAsset(project.getAsset(name,'data/pack_lv5/minimapt.gp2')):renderer.compose(project,name),raw=Buffer.alloc((image.width*4+1)*image.height);for(let y=0;y<image.height;y++)raw.set(image.rgba.subarray(y*image.width*4,(y+1)*image.width*4),y*(image.width*4+1)+1);const h=Buffer.alloc(13);h.writeUInt32BE(image.width,0);h.writeUInt32BE(image.height,4);h[8]=8;h[9]=6;const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);await fs.writeFile(new URL(name+'.png',privateDir),png);}catch(e){console.error(name,e.message);}}
console.log(JSON.stringify({summary:report.summary,elapsedMs:report.elapsedMs,imagesOK:report.images.filter(x=>!x.error).length,imageErrors:report.images.filter(x=>x.error),compositesOK:report.composites.filter(x=>!x.error).length,compositeErrors:report.composites.filter(x=>x.error),pacImagesOK:report.images.filter(x=>x.path.endsWith('.pac')&&!x.error).length,privateDir:privateDir.href},null,2));
