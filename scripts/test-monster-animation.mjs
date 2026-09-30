import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readNSBCA,sampleMatrices,pivotRotation,basisRotation,identity} from '../web/monster-animation.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},bad=f=>{assert.throws(f);checks++;};
function container(){const b=new Uint8Array(94),d=new DataView(b.buffer),put=(p,s)=>b.set(new TextEncoder().encode(s),p);put(0,'BCA0');d.setUint16(4,0xfeff,true);d.setUint16(6,1,true);d.setUint32(8,b.length,true);d.setUint16(12,16,true);d.setUint16(14,1,true);d.setUint32(16,20,true);put(20,'JNT0');d.setUint32(24,74,true);b[29]=1;d.setUint16(30,40,true);d.setUint16(44,4,true);d.setUint32(48,48,true);put(52,'identity');b.set([74,0,65,67],68);d.setUint16(72,1,true);d.setUint16(74,1,true);d.setUint32(80,26,true);d.setUint32(84,26,true);d.setUint16(88,22,true);d.setUint16(90,1,true);return b;}
const bytes=container(),a=readNSBCA(bytes);eq(a.numFrames,1);eq(a.numObjects,1);eq(sampleMatrices(a,0),[identity()]);eq(bytes,container());
bad(()=>sampleMatrices(a,-1));bad(()=>sampleMatrices(a,1));bad(()=>sampleMatrices(a,.5));
for(let n=0;n<bytes.length;n++)bad(()=>readNSBCA(bytes.subarray(0,n)));
for(const [p,type,v] of [[0,'u8',0],[4,'u16',0],[6,'u16',0],[8,'u32',1000],[12,'u16',0],[14,'u16',2],[16,'u32',0xfffffff0],[20,'u8',0],[24,'u32',1000],[29,'u8',0],[30,'u16',65535],[44,'u16',8],[48,'u32',0xfffffff0],[68,'u8',0],[72,'u16',0],[74,'u16',65],[80,'u32',0xfffffff0],[88,'u16',65535],[92,'u8',1],[93,'u8',1]]){const b=bytes.slice(),d=new DataView(b.buffer);if(type==='u8')d.setUint8(p,v);if(type==='u16')d.setUint16(p,v,true);if(type==='u32')d.setUint32(p,v,true);bad(()=>readNSBCA(b));}
for(const flag of [4,0x80,0x400]){const b=bytes.slice();new DataView(b.buffer).setUint16(90,flag,true);bad(()=>readNSBCA(b));}
eq(pivotRotation(0,0,1,0),[1,0,0,0,1,0,0,0,1]);bad(()=>pivotRotation(9,0,1,0));bad(()=>basisRotation([0]));
// Packed basis fixture: column A=(1-1/4096,0,0), B=(0,1-1/4096,0).
const r=basisRotation([32760,0,0,0,32760]);eq(r.slice(0,6),[4095/4096,0,0,0,4095/4096,0]);eq(r[8],(4095/4096)**2);
const privateChecks=null;
console.log(JSON.stringify({passed:true,checks,privateChecks,nativePlaybackValidated:false},null,2));
