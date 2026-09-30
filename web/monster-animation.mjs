// Adapted from apicula by scurest, Copyright (C) 2019, 0BSD.
// Full license: ./licenses/apicula-0BSD.txt
// Bounded NSBCA reader, derived from vendored apicula (0BSD) animation.rs/rotation.rs.
// Exact integer sample frames only: no guessed sparse-rate interpolation or native playback claim.
const need=(v,m)=>{if(!v)throw Error(m);};
export const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const signed=(v,bits)=>{const mask=2**bits-1,vv=v&mask;return vv&(2**(bits-1))?vv-2**bits:vv;};
export function pivotRotation(select,neg,a,b){
 need(Number.isInteger(select)&&select>=0&&select<9,'Unsupported pivot selector');
 const o=neg&1?-1:1,c=neg&2?-b:b,d=neg&4?-a:a;
 return [[o,0,0,0,a,b,0,c,d],[0,o,0,a,0,b,c,0,d],[0,0,o,a,b,0,c,d,0],[0,a,b,o,0,0,0,c,d],[a,0,b,0,o,0,c,0,d],[a,b,0,0,0,o,c,d,0],[0,a,b,0,c,d,o,0,0],[a,0,b,c,0,d,0,o,0],[a,b,0,c,d,0,0,0,o]][select];
}
export function basisRotation(raw){
 need(Array.isArray(raw)&&raw.length===5&&raw.every(x=>Number.isInteger(x)&&x>=0&&x<=65535),'Five basis words required');
 const input=[raw[4],raw[0],raw[1],raw[2],raw[3]],o=Array(6).fill(0);
 for(let i=0;i<5;i++){o[i]=input[i]>>>3;o[5]=(o[5]<<3)|(input[i]&7);}
 const f=x=>signed(x,13)/4096,a=[f(o[1]),f(o[2]),f(o[3])],b=[f(o[4]),f(o[0]),f(o[5])];
 const c=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 return [...a,...b,...c];
}
export function readNSBCA(bytes){
 need(bytes instanceof Uint8Array&&bytes.length>=20&&bytes.length<=1048576,'Bounded BCA0 byte array required');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let lower=0,upper=bytes.length;
 const range=(p,n)=>need(Number.isSafeInteger(p)&&Number.isSafeInteger(n)&&n>=0&&p>=lower&&p+n<=upper,'Animation read outside declared section');
 const u8=p=>(range(p,1),d.getUint8(p)),u16=p=>(range(p,2),d.getUint16(p,true)),u32=p=>(range(p,4),d.getUint32(p,true));
 const s16=p=>(range(p,2),d.getInt16(p,true)/4096),s32=p=>(range(p,4),d.getInt32(p,true)/4096);
 const text=(p,n)=>(range(p,n),new TextDecoder().decode(bytes.subarray(p,p+n)).replace(/\0.*$/s,''));
 need(text(0,4)==='BCA0'&&u16(4)===0xfeff&&u16(6)===1&&u32(8)===bytes.length&&u16(12)===16&&u16(14)===1,'Unsupported BCA0 header');
 const section=u32(16);need(section>=20&&text(section,4)==='JNT0','One JNT0 section required');const sectionEnd=section+u32(section+4);range(section,sectionEnd-section);need(sectionEnd===bytes.length,'Trailing or overlapping sections unsupported');lower=section;upper=sectionEnd;
 const dict=section+8,count=u8(dict+1),dictSize=u16(dict+2);need(u8(dict)===0&&count===1,'Exactly one animation entry required');range(dict,dictSize);
 const data=dict+16+4*count;need(u16(data-4)===4,'Unsupported animation dictionary stride');range(data,count*20);const name=text(data+4,16),base=section+u32(data);
 range(base,20);need(u8(base)===0x4a&&u8(base+1)===0&&u8(base+2)===0x41&&u8(base+3)===0x43,'J0AC stamp required');
 const numFrames=u16(base+4),numObjects=u16(base+6);need(numFrames>0&&numFrames<=512&&numObjects>0&&numObjects<=64,'Animation frame/object budget exceeded');range(base+20,numObjects*2);
 const pivot=base+u32(base+12),basis=base+u32(base+16);range(pivot,0);range(basis,0);
 const stats={constantTranslation:0,sampledTranslation:0,constantRotation:0,sampledRotation:0,pivotReferences:0,basisReferences:0,constantScale:0,sampledScale:0};
 function rotation(ref){
  const index=ref&32767;
  if(ref&32768){const p=pivot+index*6,flags=u16(p);stats.pivotReferences++;return pivotRotation(flags&15,(flags>>4)&15,s16(p+2),s16(p+4));}
  stats.basisReferences++;const p=basis+index*10;return basisRotation(Array.from({length:5},(_,i)=>u16(p+i*2)));
 }
 const curveInfo=word=>{const start=word&65535,end=(word>>>16)&4095,rate=word>>>30,width=(word>>>28)&3;
  need(start===0&&end===numFrames&&rate===0,'Only complete rate0 integer sample curves supported');need(width<=2,'Unsupported curve data width');return {count:end,width};};
 const objects=Array.from({length:numObjects},(_,objectIndex)=>{
  let p=base+u16(base+20+objectIndex*2);const flags=u16(p),dummy=u8(p+2),index=u8(p+3);p+=4;
  need(index===objectIndex&&dummy===0,'Sequential object binding required');
  const obj={index,flags,translation:[null,null,null],rotation:null,scale:[null,null,null]};
  if(flags&1)return obj;
  need((flags&4)===0&&(flags&0x80)===0&&(flags&0x400)===0,'Base-model fallback channels not supported');
  if((flags&6)===0)for(let axis=0;axis<3;axis++){
   if(flags&(8<<axis)){obj.translation[axis]={constant:s32(p)};p+=4;stats.constantTranslation++;}
   else{const info=curveInfo(u32(p)),offset=base+u32(p+4);p+=8;const stride=info.width===0?4:2;obj.translation[axis]={samples:Array.from({length:info.count},(_,i)=>info.width===0?s32(offset+i*stride):s16(offset+i*stride))};stats.sampledTranslation++;}
  }
  if((flags&0xc0)===0){
   if(flags&0x100){obj.rotation={constant:rotation(u16(p))};range(p,4);p+=4;stats.constantRotation++;}
   else{const info=curveInfo(u32(p)),offset=base+u32(p+4);p+=8;obj.rotation={samples:Array.from({length:info.count},(_,i)=>rotation(u16(offset+i*2)))};stats.sampledRotation++;}
  }
  if((flags&0x600)===0)for(let axis=0;axis<3;axis++){
   if(flags&(0x800<<axis)){obj.scale[axis]={constant:s32(p),inverseConstant:s32(p+4)};p+=8;stats.constantScale++;}
   else{const info=curveInfo(u32(p)),offset=base+u32(p+4);p+=8;const stride=info.width===0?8:4;obj.scale[axis]={samples:Array.from({length:info.count},(_,i)=>info.width===0?s32(offset+i*stride):s16(offset+i*stride)),inverseSamples:Array.from({length:info.count},(_,i)=>info.width===0?s32(offset+i*stride+4):s16(offset+i*stride+2))};stats.sampledScale++;}
  }
  return obj;
 });
 return {format:'bounded-nsbca-exact-samples-v1',name,numFrames,numObjects,objects,stats,
  sampling:'complete rate0 integer frames only; no interpolation',channelDefaults:'identity/zero/unit for explicit identity flags; base-model fallback rejected',
  scaleInverseValuesPreserved:true,scaleInverseUsed:false,nativePlaybackEquivalent:false};
}
export function sampleMatrices(animation,frame){
 need(animation?.format==='bounded-nsbca-exact-samples-v1'&&Number.isInteger(frame)&&frame>=0&&frame<animation.numFrames,'Exact stored frame required');
 const value=(curve,otherwise)=>curve===null?otherwise:curve.samples?curve.samples[frame]:curve.constant;
 return animation.objects.map(o=>{
  const t=o.translation.map(c=>value(c,0)),s=o.scale.map(c=>value(c,1)),r=value(o.rotation,[1,0,0,0,1,0,0,0,1]),m=identity();
  for(let col=0;col<3;col++)for(let row=0;row<3;row++)m[col*4+row]=r[col*3+row]*s[col];for(let row=0;row<3;row++)m[12+row]=t[row];
  need(m.every(Number.isFinite),'Nonfinite sampled matrix');return m;
 });
}
