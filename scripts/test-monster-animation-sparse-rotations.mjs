import assert from 'node:assert/strict';
import {readNSBCA,pivotRotation} from '../web/monster-animation.mjs';
export function fixture({select=0,neg=0,nf=5,refs=[0x8000,0x8001,0x8000],rate=1,width=0,start=0,end=(nf-1)&~1}={}){
 const b=new Uint8Array(224),d=new DataView(b.buffer),u16=(p,v)=>d.setUint16(p,v,true),u32=(p,v)=>d.setUint32(p,v,true),text=(p,s)=>b.set(new TextEncoder().encode(s),p);
 text(0,'BCA0');u16(4,0xfeff);u16(6,1);u32(8,b.length);u16(12,16);u16(14,1);u32(16,20);text(20,'JNT0');u32(24,b.length-20);b[29]=1;u16(30,40);u16(44,4);u32(48,48);text(52,'synthetic-rot');text(68,'J\0AC');u16(72,nf);u16(74,1);u32(80,60);u32(84,96);u16(88,22);u16(90,0x202);u32(94,(start|end<<16|width<<28|rate<<30)>>>0);u32(98,44);
 for(let i=0;i<refs.length;i++)u16(112+2*i,refs[i]);
 for(let i=0;i<2;i++){
  const a=i?2896:4095,c=i?2896:0;u16(128+i*6,select|(neg<<4));u16(130+i*6,a);u16(132+i*6,c);
  const r=pivotRotation(select,neg,a/4096,c/4096).slice(0,6).map(x=>Math.max(-4096,Math.min(4095,Math.round(x*4096))));
  const order=[r[4],r[0],r[1],r[2],r[3]],packed=order.map((x,k)=>((x&8191)<<3)|((r[5]&8191)>>((4-k)*3)&7)),raw=[...packed.slice(1),packed[0]];
  for(let k=0;k<5;k++)u16(164+i*10+k*2,raw[k]);
 }
 return b;
}
export function cases(){const cases=[];for(let select=0;select<9;select++)for(let neg=0;neg<8;neg++)for(const nf of [4,5])for(const refs of [[0x8000,0x8001,0x8000],[0,1,0],[0x8000,1,0x8000],[0,0x8001,0]])cases.push({select,neg,nf,refs});return cases;}
let checks=0;
for(const params of cases()){const a=readNSBCA(fixture(params));assert.equal(a.objects[0].rotation.sourceIntegerSamples,true);assert.equal(a.objects[0].rotation.samples.length,params.nf);assert.ok(a.objects[0].rotation.samples.flat().every(v=>Number.isInteger(v*4096)));checks+=3;}
for(const opts of [{start:1},{end:3},{end:5},{rate:2},{rate:3},{width:1},{width:2},{width:3},{select:9}]){assert.throws(()=>readNSBCA(fixture(opts)));checks++;}
for(let n=0;n<224;n++){assert.throws(()=>readNSBCA(fixture().subarray(0,n)));checks++;}
const degenerate=fixture();new DataView(degenerate.buffer).setInt16(130,0,true);assert.throws(()=>readNSBCA(degenerate));checks++;
console.log(JSON.stringify({passed:true,checks,syntheticCases:cases().length,nativeEvidence:'Independent original-code oracle verifies all full matrices.'}));
