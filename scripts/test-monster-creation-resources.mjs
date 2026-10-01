#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import {decodeCreatorMapSpecies,decodeCreatorModelRecords,decodeCreatorAIRecords,mineCreatorResources,bindCreatorResources} from '../web/monster-creation-resources.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=f=>{assert.throws(f);checks++;};
function stream(calls,version){
 const size=16+calls.reduce((n,c)=>n+((3+Math.ceil(c.args.length/4)+3)&~3)+4*c.args.length,0),b=new Uint8Array(size),v=new DataView(b.buffer);v.setUint32(0,calls.length,true);v.setUint32(4,size,true);v.setUint32(12,version,true);let p=16;
 for(const c of calls){v.setUint16(p,c.op,true);b[p+2]=c.args.length;const h=(3+Math.ceil(c.args.length/4)+3)&~3;for(let i=0;i<c.args.length;i++){const a=c.args[i],type=typeof a==='object'?a.type:1,raw=typeof a==='object'?a.raw:a;b[p+3+(i>>2)]|=type<<((i%4)*2);v.setUint32(p+h+4*i,raw,true);}p+=h+4*c.args.length;}return b;
}
function models(rows){const b=new Uint8Array(5+20*rows.length),v=new DataView(b.buffer);v.setUint32(0,(1<<12)|rows.length,true);rows.forEach((r,i)=>{const o=4+20*i;v.setInt16(o+8,r[0],true);v.setInt16(o+12,r[1],true);v.setInt16(o+14,r[2],true);});return b;}
const enc=stream([{op:102,args:[7402,0,(31<<16)|108,(83<<16)|3]}],0),mod=models([[3,819,2457],[31,-1,32767],[83,-32768,0],[108,1587,6881]]),ai=stream([{op:100,args:[4]},...[3,31,83,108].map((id,i)=>({op:101,args:[id,i===0?-99:12,i===0?-99:5,i===0?7:3932369,1,10,20]}))],2);
eq(decodeCreatorMapSpecies(enc,7402),[31,108,83,3]);eq(decodeCreatorModelRecords(mod).map(r=>[r.speciesKey,r.widthShort,r.heightShort]),[[3,819,2457],[31,-1,32767],[83,-32768,0],[108,1587,6881]]);eq(decodeCreatorAIRecords(ai)[0],{species:3,byte2:157,signedByte3:-99,flags:0,sourceOffset:24});
const nitro={readFile:p=>({'data/prm/encmons.bin':enc,'data/prm/mons_data2.nat':mod,'data/prm/fld_mons_data.bin':ai})[p]},mined=mineCreatorResources(nitro,7402),field=0x02010000,resources={models:{containerPointer:field+0x2f4,basePointer:0x02020000,declaredCount:4},ai:{containerPointer:field+0x300,head:0x02030000,records:Array.from({length:4},(_,i)=>({pointer:0x02030000+20*i,next:i===3?0:0x02030000+20*(i+1)}))}},before=structuredClone(resources),bound=bindCreatorResources(resources,field,mined);
eq(resources,before);eq(bound.models.entries.map(r=>r.speciesKey),[3,31,83,108]);eq(bound.ai.records.map(r=>r.species),[108,83,31,3]);eq(bound.ai.records.at(-1).flags,0);eq(bindCreatorResources(bound,field,mined),bound);
const absent=structuredClone(resources);Object.assign(absent.models,{basePointer:0,declaredCount:0});eq(bindCreatorResources(absent,field,mined).models.entries,[]);absent.ai={containerPointer:field+0x300,head:0,records:[]};eq(bindCreatorResources(absent,field,mined).ai.records,[]);
for(const bytes of [new Uint8Array(0),new Uint8Array(15),null,Array(16)])reject(()=>decodeCreatorMapSpecies(bytes,7402));
for(const mutate of [b=>new DataView(b.buffer).setUint32(0,10001,true),b=>new DataView(b.buffer).setUint32(4,b.length+1,true),b=>new DataView(b.buffer).setUint32(8,1,true),b=>b[12]=2,b=>b[16]=103,b=>b[18]=255,b=>b[19]=3]){const b=enc.slice();mutate(b);reject(()=>decodeCreatorMapSpecies(b,7402));}
reject(()=>decodeCreatorMapSpecies(enc,7403));reject(()=>decodeCreatorMapSpecies(enc,null));reject(()=>decodeCreatorMapSpecies(stream([{op:102,args:[7402,1,3]}],0),7402));reject(()=>decodeCreatorMapSpecies(stream([{op:102,args:[7402,0,3]},{op:102,args:[7402,0,31]}],0),7402));
eq(decodeCreatorMapSpecies(stream([{op:102,args:[7402,0,...Array(8).fill((3<<16)|31)]}],0),7402).length,12);
for(const mutate of [b=>b[3]=128,b=>b[0]++,b=>new DataView(b.buffer).setInt32(4,100,true),b=>b[b.length-1]=65,b=>new DataView(b.buffer).setInt16(4+20+8,3,true)]){const b=mod.slice();mutate(b);reject(()=>decodeCreatorModelRecords(b));}
for(const bytes of [mod.slice(0,-1),new Uint8Array(3),null])reject(()=>decodeCreatorModelRecords(bytes));
for(const calls of [[{op:101,args:[3,1,2,3,1,1,1]}],[{op:100,args:[2]},{op:101,args:[3,1,2,3,1,1,1]}],[{op:100,args:[1]},{op:105,args:[3,1,2,3,1,1,1]}],[{op:100,args:[1]},{op:101,args:[3,1,2,3,{type:2,raw:0x7f800000},1,1]}],[{op:100,args:[2]},{op:101,args:[3,1,2,3,1,1,1]},{op:101,args:[3,1,2,3,1,1,1]}]])reject(()=>decodeCreatorAIRecords(stream(calls,2)));
for(const mutate of [r=>delete r.models,r=>r.models.declaredCount=3,r=>r.models.basePointer=0,r=>r.models.basePointer=0xfffffff0,r=>r.models.containerPointer++,r=>r.models.entries=[null,null,null,null],r=>r.models.entries=Array(4),r=>r.ai.records[0]=null,r=>delete r.ai.records[1],r=>r.ai.head=null,r=>r.ai.records[3].next=r.ai.head,r=>r.ai.records[0].next=123,r=>r.ai.records[1].pointer=r.ai.records[0].pointer,r=>r.ai.records[0].species=3,r=>r.ai.records[0].flags=0,r=>r.ai.records[0].byte2=256,r=>r.ai.records[0].signedByte3=128]){const r=structuredClone(resources);mutate(r);reject(()=>bindCreatorResources(r,field,mined));}
for(const key of ['speciesKey','pointer','widthShort','heightShort']){const r=structuredClone(bound);r.models.entries[0][key]++;reject(()=>bindCreatorResources(r,field,mined));}
let optional=null;
if(process.argv[2]){
 const raw=await readFile(process.argv[2]),n=NitroFS.fromRom(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),m=mineCreatorResources(n,7402);
 eq(m.species,[31,108,83,3]);eq(m.models.map(r=>[r.speciesKey,r.widthShort,r.heightShort]),[[3,819,2457],[31,1638,6553],[83,2048,9830],[108,1587,6881]]);eq(m.ai.map(r=>[r.species,r.byte2,r.signedByte3,r.flags]),[[108,12,99,3932681],[83,12,5,3932369],[31,12,5,3937361],[3,157,-99,3942041]]);
 if(process.argv[3]){const runtime=JSON.parse(await readFile(process.argv[3],'utf8')),f=runtime.creatorContext.fields[0],result=bindCreatorResources(f.resources,f.pointer,m);for(let i=0;i<4;i++){const a=result.models.entries[i],b=f.resources.models.entries[i];eq([a.pointer,a.speciesKey,a.widthShort,a.heightShort],[b.pointer,b.speciesKey,b.widthShort,b.heightShort]);const c=result.ai.records[i],d=f.resources.ai.records[i];eq([c.pointer,c.next,c.species,c.byte2,c.signedByte3,c.flags],[d.pointer,d.next,d.species,d.byte2,d.signedByte3,d.flags]);}}
 optional={mapId:7402,models:m.models.length,ai:m.ai.length,sourceOnlyValues:true};
}
console.log(JSON.stringify({passed:true,checks,optional,scope:'ordinary ROM-bound model/AI values; runtime allocation and complete link topology required'},null,2));
