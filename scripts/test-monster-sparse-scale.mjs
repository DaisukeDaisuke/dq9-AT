// Invented FX16 pairs only. Original ARM / actual-ROM comparisons are separate.
import assert from 'node:assert/strict';
import {readNSBCA,sampleMatrices} from '../web/monster-animation.mjs';
import {readNativeRate0Animation,sampleNativeRate0Animation} from '../web/monster-native-animation.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},bad=(f,re)=>{assert.throws(f,re);checks++;};
function fixture(numFrames,pairs){
 const count=numFrames/2+1,length=118+count*12,b=new Uint8Array(length),d=new DataView(b.buffer),put=(p,s)=>b.set(new TextEncoder().encode(s),p),h=(p,v)=>d.setUint16(p,v,true),w=(p,v)=>d.setUint32(p,v,true);
 put(0,'BCA0');h(4,0xfeff);h(6,1);w(8,length);h(12,16);h(14,1);w(16,20);put(20,'JNT0');w(24,length-20);b[29]=1;h(30,40);h(44,4);w(48,48);put(52,'synthetic-scale');put(68,'J\0AC');h(72,numFrames);h(74,1);w(76,3);w(80,50);w(84,50);h(88,22);h(90,0x42);
 for(let axis=0;axis<3;axis++){const offset=118+axis*count*4;w(94+axis*8,(0x60000000|((numFrames-2)<<16))>>>0);w(98+axis*8,offset-68);for(let i=0;i<count;i++)for(let k=0;k<2;k++)d.setInt16(offset+i*4+k*2,pairs[axis][i][k],true);}
 return b;
}
// Synthetic source-token only tests the parser/sampler API guard. No source
// byte verification or actual ARM equivalence is claimed by this unit test.
const syntheticSource={kind:'verified-native-rate0-animation-source-v1',spans:Array(4).fill(null)},extremes=[-32768,32767,-3,-2,-1,0,1,2,3,4095,4096];
let seed=0x71245bcd;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed>>>16)-32768;};let expandedFrames=0;
for(const numFrames of[2,4,6,8,28,510,512])for(let test=0;test<4;test++){
 const count=numFrames/2+1,pairs=Array.from({length:3},(_,axis)=>Array.from({length:count},(_,i)=>[0,1].map(k=>test===0?extremes[(i+axis+k)%extremes.length]:next()))),b=fixture(numFrames,pairs),saved=b.slice(),a=readNSBCA(b),native=readNativeRate0Animation(b,syntheticSource);
 eq(a.integerFrameExpansion,'source-rate1-fx16-scale-pairs-v1');eq(native.kind,'source-native-integer-scale-animation-v1');eq(a.nativePlaybackEquivalent,false);eq(a.numFrames,numFrames);
 for(let f=0;f<numFrames;f++){
  const nodes=sampleNativeRate0Animation(native,f*4096).nodes,m=sampleMatrices(a,f)[0];
  for(let axis=0;axis<3;axis++)for(let k=0;k<2;k++){const i=f>>1,expected=f%2?(f===numFrames-1?pairs[axis][i+1][k]:Math.floor((pairs[axis][i][k]+pairs[axis][i+1][k])/2)):pairs[axis][i][k],field=k?'inverseSamples':'samples';eq(a.objects[0].scale[axis][field][f]*4096,expected);eq(nodes[0][k?'inverseScaleFx12':'scaleFx12'][axis],expected);if(k===0)eq(m[axis*5]*4096,expected);}
  expandedFrames++;
 }
 eq(b,saved);for(const phase of[-4096,-1,1,2048,4095,4097,(numFrames-1)*4096+1,numFrames*4096])bad(()=>sampleNativeRate0Animation(native,phase),/in-range integer phase/);
 const last=a.objects[0].scale[0].samples.at(-1);a.objects[0].scale[0].samples[0]=999;eq(readNSBCA(b).objects[0].scale[0].samples.at(-1),last);eq(readNSBCA(b).objects[0].scale[0].samples[0]*4096,pairs[0][0][0]);
}
const pairs=Array.from({length:3},()=>[[1,-3],[2,-2],[32767,-32768],[-5,9],[77,88]]),good=fixture(8,pairs);
for(const descriptor of[0x60060001,0xa0060000,0xe0060000,0x50060000,0x70060000,0x60080000,0x60040000]){const b=good.slice();new DataView(b.buffer).setUint32(94,descriptor,true);bad(()=>readNSBCA(b),/Only complete rate0/);}
// These descriptor reinterpretations are now within the source-derived rate1 scalar scope.
{const b=good.slice();new DataView(b.buffer).setUint32(94,0x40060000,true);eq(readNSBCA(b).integerFrameExpansion,'source-rate1-scalar-curves-v1');}
for(const flags of[0x270,0x202]){const b=good.slice();new DataView(b.buffer).setUint16(90,flags,true);if(flags===0x270)eq(readNSBCA(b).integerFrameExpansion,'source-rate1-scalar-curves-v1');else bad(()=>readNSBCA(b),/Only complete rate0/);}
{const b=good.slice();new DataView(b.buffer).setUint16(72,7,true);eq(readNSBCA(b).integerFrameExpansion,'source-rate1-scalar-curves-v1');}
for(const offset of[good.length-2,good.length,0xfffffffc]){const b=good.slice();new DataView(b.buffer).setUint32(98,offset-68,true);bad(()=>readNSBCA(b),/outside declared section/);}
for(let n=0;n<good.length;n++){const b=good.slice(0,n);if(n>=28){const d=new DataView(b.buffer);d.setUint32(8,n,true);d.setUint32(24,n-20,true);}bad(()=>readNSBCA(b));}
console.log(JSON.stringify({passed:true,checks,syntheticExpandedFrames:expandedFrames,syntheticOnly:true,actualROMOrARMChecked:false,newScope:'start0, rate1, FX16 scale pairs, even frame count, end=numFrames-2; integer phases only'}));
