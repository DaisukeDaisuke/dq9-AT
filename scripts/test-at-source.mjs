// Public fixtures are synthetic. Optional ROM stays local and is never written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {AT_SOURCE_BINDING,atSourceDigest,verifyATSourceRom} from '../web/at-source.mjs';
import {sourceArm9} from '../web/f06-creator.mjs';
import {createFirstSpawnReplay} from '../web/first-spawn-replay.mjs?v=symbolic-clock-20261009-e604633f';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=(f,re)=>{assert.throws(f,re);checks++;};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(let n=0;n<256;n++){
 const bytes=Uint8Array.from({length:52},(_,i)=>(n+i*i*31)&255),before=bytes.slice();
 eq(atSourceDigest(bytes),hash(bytes));eq(bytes,before);
}
for(const bytes of [null,{},[],new Uint8Array(51),new Uint8Array(53),new Uint16Array(52)])reject(()=>atSourceDigest(bytes));
eq(Object.isFrozen(AT_SOURCE_BINDING),true);eq(AT_SOURCE_BINDING.instructionBytes+AT_SOURCE_BINDING.literalBytes,52);
// A valid, uncompressed JP header with synthetic unrelated ARM9 contents.
const synthetic=new Uint8Array(0x4200),v=new DataView(synthetic.buffer);
synthetic.set(new TextEncoder().encode('YDQJ'),12);v.setUint32(32,0x200,true);v.setUint32(40,0x02000000,true);v.setUint32(44,0x4000,true);v.setUint32(0x70,0x02000004,true);v.setUint32(0x200,0x02000040,true);
const mismatch=/AT source mismatch/;
reject(()=>verifyATSourceRom(synthetic),mismatch);
// Actual production factory must reject before runtime/project access, not just
// expose an unused helper. This is red against the unbound production factory.
reject(()=>createFirstSpawnReplay({rom:synthetic,seed:1}),mismatch);
for(const [at,value]of [[12,0],[30,1]]){const changed=synthetic.slice();changed[at]=value;reject(()=>verifyATSourceRom(changed),/JP revision0/);}
for(const length of [0,4,511,0x21f])reject(()=>verifyATSourceRom(synthetic.slice(0,length)));
if(typeof SharedArrayBuffer!=='undefined')reject(()=>verifyATSourceRom(new Uint8Array(new SharedArrayBuffer(0x4200))),/ordinary local ROM/);
let optional=null;
if(process.argv[2]){
 const rom=Uint8Array.from(fs.readFileSync(process.argv[2])),before=hash(rom),source=sourceArm9(rom);
 eq(before,'3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7');
 const bytes=Uint8Array.from({length:52},(_,i)=>source.u8(AT_SOURCE_BINDING.entry+i));eq(hash(bytes),AT_SOURCE_BINDING.sha256);eq(atSourceDigest(bytes),hash(bytes));eq(verifyATSourceRom(rom),AT_SOURCE_BINDING);
 const view=new DataView(rom.buffer),at=view.getUint32(32,true)+AT_SOURCE_BINDING.entry-view.getUint32(40,true);
 // The original's reviewed leaf is in its uncompressed prefix. Confirm this
 // before editing in-memory ROM bytes rather than silently mutating BLZ input.
 eq(Array.from(rom.subarray(at,at+52)),Array.from(bytes));
 const old=rom[at+20];rom[at+20]=0;reject(()=>verifyATSourceRom(rom),mismatch);reject(()=>createFirstSpawnReplay({rom,seed:1}),mismatch);rom[at+20]=old;
 // Every byte of every instruction AND literal is bound. No successful cache
 // may hide mutation of the same buffer; restoring it must work again.
 for(let i=0;i<52;i++){rom[at+i]^=1;reject(()=>verifyATSourceRom(rom),mismatch);reject(()=>createFirstSpawnReplay({rom,seed:1}),mismatch);rom[at+i]^=1;eq(verifyATSourceRom(rom),AT_SOURCE_BINDING);}
 eq(verifyATSourceRom(rom.buffer),AT_SOURCE_BINDING);
 const larger=new Uint8Array(rom.length+4);larger.set(rom,4);eq(verifyATSourceRom(larger.subarray(4)),AT_SOURCE_BINDING);
 eq(hash(rom),before);optional={originalAccepted:true,arithmeticMutationRejected:true,mutatedSourceBytesRejected:52,productionFactoryGuard:true,inPlaceMutationRechecked:true,originalUnchanged:true};
}
console.log(JSON.stringify({passed:true,checks,optional,scope:'Complete local UpdateAT source identity only; no caller reachability, seed-epoch join, current state or global lower-bound proof'},null,2));
