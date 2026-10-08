import assert from 'node:assert/strict';
import {readNSBCA} from '../web/monster-animation.mjs';
let checks=0;
export function fixture({type='t',width=2,nf=5,end=(nf-1)&~1,start=0,rate=1,values=[-7,8,13,24,31,42],inverse=[5,-6,7,-8,9,-10]}={}){
 const b=new Uint8Array(192),d=new DataView(b.buffer),u16=(p,v)=>d.setUint16(p,v,true),u32=(p,v)=>d.setUint32(p,v,true),text=(p,s)=>b.set(new TextEncoder().encode(s),p);
 text(0,'BCA0');u16(4,0xfeff);u16(6,1);u32(8,b.length);u16(12,16);u16(14,1);u32(16,20);text(20,'JNT0');u32(24,b.length-20);b[29]=1;u16(30,40);u16(44,4);u32(48,48);text(52,'synthetic');text(68,'J\0AC');u16(72,nf);u16(74,1);u32(80,124);u32(84,124);u16(88,22);
 u16(90,type==='t'?0x270:0x3042);u32(94,(start|end<<16|width<<28|rate<<30)>>>0);u32(98,60);
 if(type==='t'){u32(102,0);u32(106,0);}else {for(let p=102;p<118;p+=4)u32(p,4096);}
 const size=width===0?4:2;
 for(let i=0;i<values.length;i++){const p=128+i*size*(type==='s'?2:1);size===4?d.setInt32(p,values[i],true):d.setInt16(p,values[i],true);if(type==='s')size===4?d.setInt32(p+size,inverse[i],true):d.setInt16(p+size,inverse[i],true);}
 return b;
}
for(const type of ['t','s'])for(const width of [0,2])for(const nf of [4,5]){
 const values=width===0?[-2147483647,2147483647,-9,6]:[-7,8,13,24];
 const a=readNSBCA(fixture({type,width,nf,values})),c=a.objects[0][type==='t'?'translation':'scale'][0],expected=[values[0],type==='t'&&width===0?(values[0]>>1)+(values[1]>>1):(values[0]+values[1])>>1,values[1],nf===4?values[2]:type==='t'&&width===0?(values[1]>>1)+(values[2]>>1):(values[1]+values[2])>>1,...(nf===5?[values[2]]:[])];
 assert.deepEqual(c.samples.map(x=>x*4096),expected);checks++;
 if(type==='s'){assert.deepEqual(c.inverseSamples.map(x=>x*4096),nf===4?[5,-1,-6,7]:[5,-1,-6,0,7]);checks++;}
}
for(const opts of [{start:1},{end:3},{end:5},{rate:2},{rate:3},{width:1},{width:3}]){assert.throws(()=>readNSBCA(fixture(opts)));checks++;}
for(let n=0;n<192;n++){assert.throws(()=>readNSBCA(fixture().subarray(0,n)));checks++;}
console.log(JSON.stringify({passed:true,checks,nativeEvidence:'Separate original ARM9 execution oracle; this file uses synthetic fixtures only.'}));
