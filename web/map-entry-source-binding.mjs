// Read-only original-ROM instruction binding. Extracted code stays in memory.
import {decodeActorArm9} from './actor-rom-mining.mjs';
const check=(p,m)=>{if(!p)throw Error(m);};
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export function decodeMapEntryOverlay(rom){
 const v=new DataView(rom.buffer,rom.byteOffset,rom.byteLength),table=v.getUint32(0x50,true),size=v.getUint32(0x54,true),fat=v.getUint32(0x48,true);
 check(table+size<=rom.length&&size%32===0,'Overlay table bounds');
 const matches=[];for(let p=table;p<table+size;p+=32)if(v.getUint32(p,true)===17)matches.push(p);check(matches.length===1,'Unique overlay17 required');
 const p=matches[0],base=v.getUint32(p+4,true),declaredBytes=v.getUint32(p+8,true),fileId=v.getUint32(p+24,true),flags=v.getUint32(p+28,true);
 const start=v.getUint32(fat+fileId*8,true),end=v.getUint32(fat+fileId*8+4,true);check(base===0x0218c1c0&&start<end&&end<=rom.length,'Overlay17 extent');
 const raw=rom.subarray(start,end);let bytes=raw;
 if(flags&0x01000000){const r=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),packed=r.getUint32(raw.length-8,true),header=packed>>>24,span=packed&0xffffff,extra=r.getUint32(raw.length-4,true),prefix=raw.length-span;
  check(header>=8&&header<=span&&span<=raw.length&&raw.length+extra===declaredBytes,'Overlay BLZ extent');bytes=new Uint8Array(declaredBytes);bytes.set(raw.subarray(0,prefix));let src=raw.length-header,dst=bytes.length;
  while(dst>prefix){check(--src>=prefix,'Overlay BLZ flags');const f=raw[src];for(let bit=7;bit>=0&&dst>prefix;bit--){if(f&(1<<bit)){check(src-2>=prefix,'Overlay BLZ reference');const a=raw[--src],b=raw[--src],count=(a>>>4)+3,distance=((a&15)<<8|b)+3;check(dst-count>=prefix,'Overlay BLZ output');for(let i=0;i<count;i++){--dst;check(dst+distance<bytes.length,'Overlay BLZ source');bytes[dst]=bytes[dst+distance];}}else{check(--src>=prefix,'Overlay BLZ literal');bytes[--dst]=raw[src];}}}
  check(src===prefix,'Overlay BLZ remaining bytes');
 }
 check(bytes.length===declaredBytes,'Overlay decoded size');return {base,bytes,fileId,romOffset:start};
}
export async function bindMapEntryInstructions(rom){
 const arm=decodeActorArm9(rom),overlay=decodeMapEntryOverlay(rom),calls=[];
 const ranges=[['controller-draw',arm,0x020409cc,0x02003c30],['ordinary-actor-draw',arm,0x0203ccec,0x02003c30],['treasure-kind1-draw',arm,0x02031eb0,0x02003c30],['pickup-slot-draw',arm,0x0208fbd4,0x02003c30],['loader-NPC-constructor',overlay,0x021a3920,0x0203d560]];
 for(const [role,image,pc,target] of ranges){const off=pc-image.base;check(off>=0&&off+4<=image.bytes.length,'Bound call outside image');const word=new DataView(image.bytes.buffer,image.bytes.byteOffset,image.bytes.byteLength).getUint32(off,true),actual=(pc+8+((word<<8)>>6))>>>0;check((word>>>24)===0xeb&&actual===target,'Original call target mismatch: '+role);calls.push({role,pc,target,bytesSha256:await sha(image.bytes.subarray(off,off+4))});}
 const loaderView=new DataView(overlay.bytes.buffer,overlay.bytes.byteOffset,overlay.bytes.byteLength),loaderCalls=[];
 for(let pc=0x021a3a1c;pc<0x021a4100;pc+=4){const word=loaderView.getUint32(pc-overlay.base,true);if((word&0x0f000000)===0x0b000000)loaderCalls.push({pc,target:(pc+8+((word<<8)>>6))>>>0});}
 return {schema:'dq9-map-entry-code-binding-v1',armSha256:await sha(arm.bytes),overlay17Sha256:await sha(overlay.bytes),overlayBase:overlay.base,calls,loaderCalls,
  scope:'Exact direct draw/constructor targets; loader phase/heap completeness are separate conditional contracts'};
}
