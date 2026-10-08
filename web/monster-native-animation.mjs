// Source-derived narrow J0AC sampler. Complete rate0 channels support fractions;
// bounded rate1 scalar/rotation expansion supports in-range integer phases only.
// Inputs are explicit source bytes and phaseFx. This does not select a live
// actor clip, phase, blend, visibility, model variant or callback state.
import {readNSBCA} from './monster-animation.mjs?v=source-rate1-curves-20261008-2e3ba48d';
import {fieldNativeNormalize} from './field-preferred-node.mjs';
const need=(v,m)=>{if(!v)throw Error(m);},i32=n=>Number(BigInt.asIntN(32,BigInt(n)));
const identity=()=>[4096,0,0,0,4096,0,0,0,4096];
const cross=(a,b)=>[i32(BigInt(a[1])*BigInt(b[2])-BigInt(a[2])*BigInt(b[1]))>>12,i32(BigInt(a[2])*BigInt(b[0])-BigInt(a[0])*BigInt(b[2]))>>12,i32(BigInt(a[0])*BigInt(b[1])-BigInt(a[1])*BigInt(b[0]))>>12];
const interpolate=(a,b,t)=>(a+(Math.imul((b-a)|0,t)>>12))|0;
function checksum(bytes){let h=0x811c9dc5;for(const b of bytes)h=Math.imul(h^b,0x01000193)>>>0;return h;}
export function verifyNativeAnimationSource(sdk){
 need(sdk?.read,'Original SDK reader required');
 const spans=SOURCE_SPANS.map(([address,length,expected])=>{const b=sdk.read(address,length);need(b.length===length&&checksum(b)===expected,'Animation source mismatch at '+address.toString(16));return{address,length,checksum:expected};});
 return {kind:'verified-native-rate0-animation-source-v1',spans};
}
const SOURCE_SPANS=[[34314784, 4508, 1777849913], [34359780, 280, 1733261378], [34313096, 1688, 3681160365], [34509712, 36, 3839925253]];
export function readNativeRate0Animation(bytes,source){
 need(source?.kind==='verified-native-rate0-animation-source-v1'&&source.spans.length===SOURCE_SPANS.length&&SOURCE_SPANS.length>0,'Verified original animation source required');
 const parsed=readNSBCA(bytes);
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=p=>d.getUint16(p,true),u32=p=>d.getUint32(p,true),section=u32(16),dict=section+8,count=bytes[dict+1],base=section+u32(dict+16+4*count),resourceFlags=u32(base+8);
 need((resourceFlags&~3)===0,'Unknown J0AC resource flags');
 const rotations=parsed.objects.map((o,index)=>{let p=base+u16(base+20+index*2)+4;if(o.flags&1)return null;if((o.flags&6)===0)for(let k=0;k<3;k++){if(!(o.flags&(8<<k)))need([0,2].includes((u32(p)>>>28)&3),'Unsupported source scalar width');p+=(o.flags&(8<<k))?4:8;}if((o.flags&0xc0)!==0)return null;if(o.flags&0x100)return{refs:[u16(p)],constant:true};if(o.rotation.sourceIntegerSamples)return{sourceIntegerSamples:true};const off=base+u32(p+4);return{refs:Array.from({length:parsed.numFrames},(_,i)=>u16(off+i*2)),constant:false};});
 for(let index=0;index<parsed.numObjects;index++){const o=parsed.objects[index];let p=base+u16(base+20+index*2)+4;if(o.flags&1)continue;if((o.flags&6)===0)for(let k=0;k<3;k++)p+=(o.flags&(8<<k))?4:8;if((o.flags&0xc0)===0)p+=(o.flags&0x100)?4:8;if((o.flags&0x600)===0)for(let k=0;k<3;k++){if(!(o.flags&(0x800<<k)))need([0,2].includes((u32(p)>>>28)&3),'Unsupported source scalar width');p+=8;}}
 return{kind:parsed.integerFrameExpansion?'source-native-integer-scale-animation-v1':'source-native-rate0-animation-v1',parsed,resourceFlags,rotations,source,scope:parsed.integerFrameExpansion?'Source rate0 channels and bounded rate1 scalar/rotation curves; in-range integer phases only; fractional sampling unsupported; no live state or blend binding':'Complete rate0 source channels only; sparse rates/base-model fallbacks remain unsupported; no live state or blend binding'};
}
function rotationAt(curve,meta,index){if(meta.sourceIntegerSamples)return{values:curve.samples[index].map(x=>Math.round(x*4096)),basis:false,sourceIntegerSamples:true};const r=(curve.samples?curve.samples[index]:curve.constant).map(x=>Math.floor(x*4096)),ref=meta.refs[meta.constant?0:index],basis=!(ref&0x8000);if(basis)r.splice(6,3,...cross(r.slice(0,3),r.slice(3,6)));return{values:r,basis};}
/** Exact source FX channels before model scaling callback. Integer phases retain
 * original stored values or the bounded source scalar expansion. Fractional
 * rotations are component lerp + original
 * FX normalization, not quaternion SLERP or an interpolated 4x4 matrix. */
export function sampleNativeRate0Animation(animation,phaseFx){
 need(['source-native-rate0-animation-v1','source-native-integer-scale-animation-v1'].includes(animation?.kind)&&Number.isInteger(phaseFx)&&phaseFx>=-2147483648&&phaseFx<=2147483647,'Explicit signed32 phaseFx required');
 const{parsed,resourceFlags,rotations}=animation;
 if(animation.kind==='source-native-integer-scale-animation-v1')need(phaseFx>=0&&phaseFx<parsed.numFrames*4096&&phaseFx%4096===0,'Sparse animation requires an in-range integer phase; fractional sampling unsupported');
 const clampedPhaseFx=Math.max(0,Math.min(phaseFx,parsed.numFrames*4096-1)),frame=clampedPhaseFx>>12,fraction=clampedPhaseFx&4095,enabled=Boolean((resourceFlags&1)&&fraction),next=frame===parsed.numFrames-1?(resourceFlags&2?0:frame):frame+1;
 const scalar=(c,otherwise,inverse=false)=>{if(c===null)return otherwise;const samples=inverse?c.inverseSamples:c.samples,constant=inverse?c.inverseConstant:c.constant,a=Math.round((samples?samples[frame]:constant)*4096);if(!samples||!enabled||next===frame)return a;const b=Math.round(samples[next]*4096);return interpolate(a,b,fraction);};
 const nodes=parsed.objects.map((o,index)=>{let rotation=identity();if(o.rotation){const a=rotationAt(o.rotation,rotations[index],frame);rotation=a.values;if(o.rotation.samples&&!a.sourceIntegerSamples&&!(enabled&&next!==frame)&&!a.basis){const third=fieldNativeNormalize(rotation.slice(6,9));need(third,'Degenerate stored pivot third-axis normalization');rotation=[...rotation.slice(0,6),...third];}if(enabled&&o.rotation.samples&&next!==frame){const b=rotationAt(o.rotation,rotations[index],next),mixed=a.values.map((v,k)=>interpolate(v,b.values[k],fraction)),first=fieldNativeNormalize(mixed.slice(0,3)),second=fieldNativeNormalize(mixed.slice(3,6));need(first&&second,'Degenerate source rotation normalization');let third;if(a.basis||b.basis)third=cross(first,second);else{third=fieldNativeNormalize(mixed.slice(6,9));need(third,'Degenerate source rotation normalization');}rotation=[...first,...second,...third];}}
 return{index,flags:(o.translation.every(c=>c===null)?1:0)|(o.rotation===null?2:0)|(o.scale.every(c=>c===null)?4:0),translationFx12:o.translation.map(c=>scalar(c,0)),rotationFx12:rotation,scaleFx12:o.scale.map(c=>scalar(c,4096)),inverseScaleFx12:o.scale.map(c=>scalar(c,4096,true))};});
 return{kind:animation.kind==='source-native-integer-scale-animation-v1'?'source-native-integer-scale-joint-channels-v1':'source-native-rate0-joint-channels-v1',phaseFx,clampedPhaseFx,frame,fraction,resourceFlags,nextFrame:next,interpolationEnabled:enabled,nodes,liveAnimationBindingKnown:false,blendEvaluated:false,modelScaleCallbackEvaluated:false};
}
