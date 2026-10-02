// Source identity for the actual local-ROM replay entry. No ROM bytes are
// retained or distributed. This binds a leaf, not its callers or seed epoch.
import {sourceArm9} from './f06-creator.mjs';
export const AT_SOURCE_BINDING=Object.freeze({
 gameCode:'YDQJ',revision:0,entry:0x02003c30,instructionBytes:40,literalBytes:12,
 sha256:'cbfee76031542ac6b2e5afd72b008ed813a78170951afcb76b2eed13b1c5c462',
});
// Standard SHA-256, deliberately limited to the one 52-byte reviewed message.
// Synchronous hashing keeps the replay constructor atomic and its API intact.
// Constants are the public SHA-256 round constants, not game instructions.
const K=Uint32Array.of(
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
);
const rotate=(x,n)=>(x>>>n)|(x<<(32-n));
export function atSourceDigest(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length!==52)throw Error('AT source requires exactly 40 instruction bytes and 12 literal bytes');
 const block=new Uint8Array(64);block.set(bytes);block[52]=0x80;
 const view=new DataView(block.buffer);view.setUint32(60,52*8);
 const w=new Uint32Array(64);for(let i=0;i<16;i++)w[i]=view.getUint32(i*4);
 for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotate(x,7)^rotate(x,18)^(x>>>3))+w[i-7]+(rotate(y,17)^rotate(y,19)^(y>>>10)))>>>0;}
 const state=Uint32Array.of(0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19);
 let [a,b,c,d,e,f,g,h]=state;
 for(let i=0;i<64;i++){
  const t1=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
  const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
  h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
 }
 return [a,b,c,d,e,f,g,h].map((x,i)=>((x+state[i])>>>0).toString(16).padStart(8,'0')).join('');
}
export function verifyATSourceRom(rom){
 // Decode from the supplied ROM each time; a cached success or caller-supplied
 // certificate must not bless later mutation of the same ArrayBuffer.
 if(!(rom instanceof ArrayBuffer)&&!(rom instanceof Uint8Array&&rom.buffer instanceof ArrayBuffer))throw Error('AT source requires an ordinary local ROM ArrayBuffer or Uint8Array');
 const source=sourceArm9(rom),bytes=Uint8Array.from({length:52},(_,i)=>source.u8(AT_SOURCE_BINDING.entry+i));
 if(atSourceDigest(bytes)!==AT_SOURCE_BINDING.sha256)throw Error('AT source mismatch: UpdateAT全命令・literalが検証済み日本語版ROMと一致しません');
 return AT_SOURCE_BINDING;
}
