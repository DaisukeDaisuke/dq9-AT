#!/usr/bin/env node
// Tiny generated fixtures only. These checks validate malformed-input handling,
// not creator accuracy, gameplay, or any reconstructed runtime allocation.
import assert from 'node:assert/strict';
import {Narc} from '../web/vendor/narc-source.js';
import {BufferReader,Compression} from '../web/vendor/nitro-fs.mjs';
import '../web/vendor/gp2.js';
const {BinaryReader,parseGp2,decompressSelection}=globalThis.NdsFontGp2;
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},bad=f=>{assert.throws(f);checks++;};
const stream=(type,length,payload)=>{const b=new Uint8Array(4+payload.length);new DataView(b.buffer).setUint32(0,length*8+type,true);b.set(payload,4);return b;};
const decode=(b,end=b.length)=>decompressSelection(new BinaryReader(b),end);
eq([...decode(stream(0,3,[65,66,67]))],[65,66,67]);
eq([...decode(stream(1,4,[0x40,65,0,0]))],[65,65,65,65]);
eq([...decode(stream(2,4,[1,0xc0,1,2,0,0,0,0]))],[17,17,17,17]);
eq([...decode(stream(3,4,[1,0xc0,65,66,0,0,0,0]))],[65,65,65,65]);
eq([...decode(stream(4,4,[3,65,66,67,68]))],[65,66,67,68]);
eq([...decode(stream(4,130,[255,7]))],Array(130).fill(7));
for(const fixture of [stream(0,4,[65]),stream(1,4,[0,65]),stream(1,3,[128,0,0]),stream(2,4,[1,0xc0,1,2]),stream(3,40,[1,0xc0,65,66,0,0,0,0]),stream(4,4,[2,65]),stream(4,130,[255]),stream(5,0,[]),stream(2,4,[1,0xc1,1,2,0,0,0,0]),stream(2,4,[1,0xc0,99,2,0,0,0,0])])bad(()=>decode(fixture));
// Valid bytes after the declared section cannot satisfy missing compressed data.
for(const type of [0,1,2,3,4]){const b=stream(type,4,Array(30).fill(0));bad(()=>decode(b,5));}
for(const type of [0,1,2,3,4])bad(()=>decode(stream(type,0x1fffffff,Array(8).fill(0))));
for(const position of [-1,1.5,Infinity,5])bad(()=>new BinaryReader(new Uint8Array(4)).seek(position));
const r=new BinaryReader(stream(1,4,[0,65]));bad(()=>decompressSelection(r,6));eq(r.end,r.length);
function pack(){const b=new Uint8Array(48),v=new DataView(b.buffer);v.setUint32(0,0x32435047,true);v.setUint16(4,1,true);v.setUint16(6,5,true);v.setUint16(8,9,true);v.setUint16(10,11,true);v.setUint32(16,0x10000000,true);v.setUint32(20,12*8,true);v.setUint32(32,4,true);v.setUint32(36,4*8,true);b.set([111,110,101,0],40);b.set([65,66,67,68],44);return b;}
eq(parseGp2(pack()).map(f=>({path:f.path,data:[...f.data]})),[{path:'one',data:[65,66,67,68]}]);
eq(parseGp2(pack(),new Set(['other'])),[]);
for(const n of [0,19,20,35,43,47])bad(()=>parseGp2(pack().subarray(0,n)));
for(const mutate of [b=>b[43]=33,b=>b[6]=4,b=>b[8]=4,b=>b[10]=255,b=>b[28]=255,b=>b[32]=255,b=>new DataView(b.buffer).setUint32(20,13*8,true)]){const b=pack();mutate(b);bad(()=>parseGp2(b));}
function narc(){const b=new Uint8Array(69),v=new DataView(b.buffer),ascii=(p,s)=>b.set(new TextEncoder().encode(s),p);ascii(0,'NARC');v.setUint16(4,0xfffe,true);v.setUint16(6,0x100,true);v.setUint32(8,b.length,true);v.setUint16(12,16,true);v.setUint16(14,3,true);ascii(16,'BTAF');v.setUint32(20,20,true);v.setUint16(24,1,true);v.setUint32(32,1,true);ascii(36,'BTNF');v.setUint32(40,24,true);v.setUint32(44,8,true);v.setUint16(50,1,true);b[52]=5;ascii(53,'a.bin');ascii(60,'GMIF');v.setUint32(64,9,true);b[68]=42;return b;}
eq([...Narc.load(narc()).getFile('a.bin')],[42]);
for(const mutate of [b=>new DataView(b.buffer).setUint32(8,b.length+1,true),b=>b[12]=15,b=>b[14]=2,b=>b[20]=12,b=>b[24]=2,b=>b[40]=7,b=>b[64]=8,b=>b[64]=100,b=>b[28]=2]){const b=narc();mutate(b);bad(()=>Narc.load(b));}
const appended=new Uint8Array(70);appended.set(narc());appended[69]=99;const av=new DataView(appended.buffer);av.setUint32(8,70,true);av.setUint32(32,2,true);bad(()=>Narc.load(appended));
const lz=b=>Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength));
eq([...lz(Uint8Array.from([16,4,0,0,0x40,65,0,0]))],[65,65,65,65]);
for(const bytes of [[16,3,0,0,128,0,0],[16,4,0,0,0,65],[16,255,255,255,0]])bad(()=>lz(Uint8Array.from(bytes)));
console.log(JSON.stringify({passed:true,checks,scope:'generated GP2/NARC/LZ10 bounds fixtures only; no creator accuracy claim'},null,2));
