// Read-only COL2 v3 decoder for the source-verified monster terrain query.
// Resource identity and runtime object eligibility remain explicit caller inputs.
import {NitroFS, BufferReader, Compression} from './vendor/nitro-fs.mjs';
import {Narc} from './vendor/narc-source.js';

function bytes(input) {
 if (input instanceof Uint8Array) return input;
 if (input instanceof ArrayBuffer) return new Uint8Array(input);
 throw new TypeError('A byte array or ArrayBuffer is required');
}
function range(offset,length,total,label) {
 if (!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>total) throw Error(`COL2 ${label} outside resource`);
}
export function decodeMonsterCol2(input) {
 const data=bytes(input),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 if(data.length<0x3c||data.length>0x200000)throw Error('COL2 size outside bounded decoder');
 const u32=o=>view.getUint32(o,true),u16=o=>view.getUint16(o,true),s16=o=>view.getInt16(o,true);
 const version=u32(0),coordinateShift=u32(4),triangleCount=u32(0x14),columns=u32(0x1c),rows=u32(0x20),cellSize=s16(0x18);
 if(version!==3)throw Error('Only source-verified COL2 version3 is supported');
 if(coordinateShift>16||triangleCount>65535||columns===0||rows===0||cellSize<=0)throw Error('COL2 dimensions outside supported native query domain');
 const cellCount=columns*rows+Math.floor(rows/2);
 if(!Number.isSafeInteger(cellCount)||cellCount>65536)throw Error('COL2 cell count outside bounded decoder');
 const offsets={triangles:u32(0x24),counts:u32(0x28),starts:u32(0x2c),indices:u32(0x30),extra:u32(0x38)};
 range(offsets.triangles,triangleCount*28,data.length,'triangles');range(offsets.counts,cellCount,data.length,'cell counts');range(offsets.starts,cellCount*2,data.length,'cell starts');range(offsets.extra,0,data.length,'extra offset');
 if(offsets.triangles<0x3c||offsets.counts<offsets.triangles+triangleCount*28||offsets.starts<offsets.counts+cellCount||offsets.indices<offsets.starts+cellCount*2||offsets.extra<offsets.indices)throw Error('COL2 table layout outside supported resource format');
 const counts=data.slice(offsets.counts,offsets.counts+cellCount),starts=new Uint16Array(cellCount);let indexCount=0;
 for(let i=0;i<cellCount;i++){starts[i]=u16(offsets.starts+i*2);indexCount=Math.max(indexCount,starts[i]+counts[i]);}
 range(offsets.indices,indexCount*2,offsets.extra,'triangle indices');
 const triangleIndices=new Uint16Array(indexCount);
 for(let i=0;i<indexCount;i++){triangleIndices[i]=u16(offsets.indices+i*2);if(triangleIndices[i]>=triangleCount)throw Error('COL2 cell refers to a missing triangle');}
 const triangleWords=new Int16Array(triangleCount*12),boundsIndices=new Uint8Array(triangleCount*6),triangleFlags=new Uint8Array(triangleCount);
 for(let i=0;i<triangleCount;i++){
  const p=offsets.triangles+i*28;
  for(let k=0;k<12;k++)triangleWords[i*12+k]=s16(p+k*2);
  for(let k=0;k<6;k++){const n=(data[p+24+(k>>1)]>>((k&1)*4))&15;if(n>8)throw Error('COL2 bounds index outside vertex coordinates');boundsIndices[i*6+k]=n;}
  triangleFlags[i]=data[p+27];
 }
 const min=[8,10,12].map(s16),max=[14,16,18].map(s16),scale=2**coordinateShift;
 if(min.some((x,i)=>x>max[i]))throw Error('COL2 inverted resource bounds');
 const resourceBounds={min:min.map(x=>x*scale),max:max.map(x=>x*scale)};
 return {format:'dq9-monster-col2-v3',version,coordinateShift,triangleCount,resourceBounds,grid:{columns,rows,cellCount,cellSize,min,counts,starts,triangleIndices},triangleWords,boundsIndices,triangleFlags,source:{constructor:0x0204cd64,query:0x0204ce50,byteLength:data.length,offsets},queryResolved:false};
}

// The shared vendor readers clamp some slices and ignore some container headers.
// Validate declared extents before calling them; no parser/decompressor is replaced.
function validateFnt(data,fileCount,ordinalFileIds=false) {
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);range(0,8,data.length,'FNT root');
 const count=v.getUint16(6,true);if(count<1||count>4096)throw Error('FNT directory count invalid');range(0,count*8,data.length,'FNT directory table');
 const children=[];
 for(let i=0;i<count;i++){
  let p=v.getUint32(i*8,true),file=v.getUint16(i*8+4,true),ordinal=0,seenDirectory=false;const names=new Set(),edges=[];
  if(p<count*8||p>=data.length)throw Error('FNT subtable outside resource');
  while(true){
   range(p,1,data.length,'FNT entry');const control=data[p++];if(control===0)break;const length=control&127;if(!length)throw Error('FNT empty name');
   range(p,length,data.length,'FNT name');const name=String.fromCharCode(...data.subarray(p,p+length));p+=length;
   if(names.has(name)||name.includes('/')||name.includes('\\'))throw Error('FNT ambiguous name');names.add(name);
   if(control&128){range(p,2,data.length,'FNT child');const raw=v.getUint16(p,true);p+=2;if(raw<0xf000||raw>=0xf000+count)throw Error('FNT child directory missing');edges.push(raw-0xf000);seenDirectory=true;}
   else{if(ordinalFileIds&&seenDirectory)throw Error('FNT ordering unsupported by shared reader');if(file>=fileCount)throw Error('FNT file ID outside FAT');file++;}
   if(++ordinal>65536)throw Error('FNT entry count exceeds bound');
  }
  children.push(edges);
 }
 const visited=new Set();function visit(i,depth){if(depth>64||visited.has(i))throw Error('FNT directory cycle or repeated child');visited.add(i);for(const child of children[i])visit(child,depth+1);}visit(0,0);
 if(visited.size!==count)throw Error('FNT directory tree incomplete');
}
function validateRomContainers(rom) {
 const v=new DataView(rom.buffer,rom.byteOffset,rom.byteLength),fnt=v.getUint32(0x40,true),fntBytes=v.getUint32(0x44,true),fat=v.getUint32(0x48,true),fatBytes=v.getUint32(0x4c,true);
 if(fnt<0x200||fat<0x200||fatBytes===0||(fatBytes&7)!==0)throw Error('NDS filesystem header invalid');
 range(fnt,fntBytes,rom.length,'NDS FNT');range(fat,fatBytes,rom.length,'NDS FAT');const count=fatBytes/8;if(count>65536)throw Error('NDS FAT count exceeds bound');
 const extents=[];let copiedBytes=0;
 for(let i=0;i<count;i++){const start=v.getUint32(fat+i*8,true),end=v.getUint32(fat+i*8+4,true);if(end<start)throw Error('NDS FAT member inverted');range(start,end-start,rom.length,'NDS member');copiedBytes+=end-start;if(end>start)extents.push([start,end]);}
 if(copiedBytes>rom.length)throw Error('NDS FAT copy budget exceeds ROM size');
 extents.sort((a,b)=>a[0]-b[0]);for(let i=1;i<extents.length;i++)if(extents[i][0]<extents[i-1][1])throw Error('Aliased NDS FAT members outside bounded loader');
 validateFnt(rom.subarray(fnt,fnt+fntBytes),count,true);
}
function validateNarc(data) {
 range(0,0x10,data.length,'NARC header');const v=new DataView(data.buffer,data.byteOffset,data.byteLength),magic=o=>String.fromCharCode(...data.subarray(o,o+4));
 if(magic(0)!=='NARC'||v.getUint16(4,true)!==0xfffe||v.getUint16(6,true)!==0x100||v.getUint32(8,true)!==data.length||v.getUint16(12,true)!==0x10||v.getUint16(14,true)!==3)throw Error('NARC header outside verified format');
 let p=0x10;const blocks=[];
 for(const name of ['BTAF','BTNF','GMIF']){range(p,8,data.length,'NARC block');const size=v.getUint32(p+4,true);if(magic(p)!==name||size<8)throw Error('NARC block header invalid');range(p,size,data.length,'NARC block');blocks.push({offset:p,size});p+=size;}
 if(p!==data.length)throw Error('NARC block sizes do not cover archive');
 const [fat,fnt,img]=blocks;range(fat.offset+8,4,fat.offset+fat.size,'NARC member count');const count=v.getUint32(fat.offset+8,true);
 if(count>65536||fat.size!==12+count*8)throw Error('NARC FAT size/count mismatch');
 for(let i=0;i<count;i++){const start=v.getUint32(fat.offset+12+i*8,true),end=v.getUint32(fat.offset+16+i*8,true);if(end<start)throw Error('NARC member inverted');range(start,end-start,img.size-8,'NARC member');}
 validateFnt(data.subarray(fnt.offset+8,fnt.offset+fnt.size),count);
}

function validateLz10(data,size) {
 let src=4,out=0;
 while(out<size){
  if(src>=data.length)throw Error('COL2 LZ10 flags truncated');const flags=data[src++];
  for(let bit=7;bit>=0&&out<size;bit--){
   if(flags&(1<<bit)){
    if(src+2>data.length)throw Error('COL2 LZ10 reference truncated');const a=data[src++],b=data[src++],count=(a>>>4)+3,distance=((a&15)<<8|b)+1;
    if(distance>out||out+count>size)throw Error('COL2 LZ10 reference outside decoded prefix');out+=count;
   }else{if(src>=data.length)throw Error('COL2 LZ10 literal truncated');src++;out++;}
  }
 }
}

export function monsterCol2FromRom(input,{archivePath,memberName}={}) {
 const rom=bytes(input);
 if(rom.length<0x200||String.fromCharCode(...rom.subarray(12,16))!=='YDQJ'||rom[0x1e]!==0)throw Error('Japanese DQ9 revision0 ROM required');
 if(typeof archivePath!=='string'||!/^data\/map\/[A-Za-z0-9_]+\.amdj$/.test(archivePath)||typeof memberName!=='string'||!/^[-A-Za-z0-9_]+\.col2$/.test(memberName))throw Error('Exact map archive and COL2 member names are required');
 validateRomContainers(rom);
 const nitro=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength)),archiveBytes=new Uint8Array(nitro.readFile(archivePath));validateNarc(archiveBytes);const archive=Narc.load(archiveBytes);
 const matches=[];for(let i=0;i<archive.files.length;i++)if(archive.fnt.getFilenameOf(i)===memberName)matches.push(i);
 if(matches.length!==1)throw Error('COL2 member missing or ambiguous');
 let data=archive.files[matches[0]],compression='none';
 if(data[0]===0x10){
  if(data.length<4)throw Error('COL2 compressed header truncated');
  const size=data[1]|data[2]<<8|data[3]<<16;if(size<0x3c||size>0x200000)throw Error('COL2 decompressed size outside bounded decoder');
  validateLz10(data,size);data=Compression.decompress(new BufferReader(data.buffer,data.byteOffset,data.byteLength));if(data.length!==size)throw Error('COL2 decompressed size mismatch');compression='lz10';
 }
 const decoded=decodeMonsterCol2(data);
 return {...decoded,source:{...decoded.source,archivePath,memberName,memberIndex:matches[0],compression},bindingResolved:false};
}
