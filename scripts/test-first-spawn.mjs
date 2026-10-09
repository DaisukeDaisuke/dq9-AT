#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FirstSpawnReplay,createFirstSpawnReplay,validateSpawnTrajectory} from '../web/first-spawn-replay.mjs?v=symbolic-clock-20261009-e604633f';
import {ATKernel} from '../web/at-core.mjs';
import {FieldATKernel} from '../web/field-at.mjs';
import {MapProject} from '../web/map-core.mjs';
import {MonsterMovementKernel} from '../web/monster-movement.mjs?v=symbolic-clock-20261009-e604633f';
import {preferredNodeTrigFromRom} from '../web/field-preferred-node.mjs';
import {decodeEncounterStream} from '../web/encounter-distribution.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=f=>{assert.throws(f);checks++;};
const graph={nodes:[{id:0,position:[0,0,0],neighbors:[]}]};
// Synthetic opcode stream verifies ROM weights without old encounter labels.
function stream(calls){const blocks=calls.map(([op,args])=>{const h=(3+Math.ceil(args.length/4)+3)&~3,b=Buffer.alloc(h+4*args.length);b.writeUInt16LE(op);b[2]=args.length;args.forEach((v,i)=>{b[3+(i>>2)]|=1<<((i%4)*2);b.writeUInt32LE(v>>>0,h+4*i);});return b;});const h=Buffer.alloc(16),size=16+blocks.reduce((n,b)=>n+b.length,0);h.writeUInt32LE(calls.length);h.writeUInt32LE(size,4);h.writeUInt32LE(2,12);return Buffer.concat([h,...blocks]);}
const encoded=stream([[105,[7402,0,0,0,0]],[104,[30]],[102,[8391802]],[103,[0x5053,1]],[103,[0x1003,1]]]);
const decoded=decodeEncounterStream(encoded);eq(decoded.tables[0].rows.map(r=>[r.speciesId,r.weight,r.start,r.end]),[[83,5,0,4],[3,1,5,5]]);eq(decoded.groups[0].tableIds,[30]);
for(const x of [null,[],new Uint8Array(15),encoded.subarray(0,-1),stream([[104,[30]]]),stream([[105,[7402,0,0,0,0]],[104,[30]],[102,[0]],[103,[65536,1]]])])reject(()=>decodeEncounterStream(x));
const trajectory={schema:'dq9-pre-spawn-trajectory-v1',phase:'pre-spawn-effective',mapId:7402,steps:[{index:0,sourceFrame:null,delta:33,timeValue:0,hero:{xyz:[0,0,0],angle:0,nodeIndex:0,graphEnabled:true}}]};
eq(validateSpawnTrajectory(trajectory,7402,graph),trajectory.steps);
for(const mutate of [t=>t.phase='post-hero',t=>t.mapId=7401,t=>t.steps=[],t=>t.steps=Array(1),t=>t.steps[0].index=1,t=>t.steps[0].delta=51,t=>t.steps[0].delta=-1,t=>t.steps[0].timeValue=null,t=>t.steps[0].hero.angle=32768,t=>delete t.steps[0].hero.xyz[1],t=>t.steps[0].hero.nodeIndex=1,t=>t.steps[0].hero.graphEnabled=null,t=>t.steps[0].nextActor={xyz:[1,2,3]},t=>t.steps[0].seed=1]){const t=structuredClone(trajectory);mutate(t);reject(()=>validateSpawnTrajectory(t,7402,graph));}
const atKernel=new ATKernel((await WebAssembly.instantiate(await readFile(new URL('../web/wasm/map_render.wasm',import.meta.url)),{})).instance),fieldKernel=new FieldATKernel(atKernel);
const slot={slot:112,registryKnown:true,pointer:1,monsterIdRaw:65535,headerFlags:35,actorFlags:1};
const sample=()=>structuredClone(trajectory.steps[0]);
function small(timer=0){const hero={slot:0,pointer:2,xyz:[0,0,0]},field={index:0,mapId:7402,flags:12};return new FirstSpawnReplay({kernel:{},fieldKernel,atKernel,context:{fields:[field],inventory:{group:0,slots:[slot]}},parties:[hero],hero,field,group:0,seed:1,timer,steps:Array.from({length:3},(_,index)=>({...sample(),index})),rows:[],distributions:{},graph});}
const a=small(),b=small();while(a.advance()){}while(b.advance()){}eq(a.events,b.events);eq([a.status,a.seed,a.consumed,a.timer,a.events.length],['trajectory-ended',1,0,99,3]);eq(a.advance(),false);
const before=JSON.stringify({slot,trajectory});const stopped=small(999);stopped.context.inventory.slots[0].registryKnown=false;stopped.advance();eq(stopped.status,'unresolved');eq(stopped.seed,1);eq(before,JSON.stringify({slot,trajectory}));
let optional=null;
if(process.argv[2]){
 const [bytes,r,t,m]=await Promise.all([readFile(process.argv[2]),readFile(process.argv[3],'utf8'),readFile(process.argv[4],'utf8'),readFile(new URL('../web/wasm/monster_movement.wasm',import.meta.url))]);
 const rom=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),project=new MapProject(rom,''),runtime=JSON.parse(r),path=JSON.parse(t),kernel=new MonsterMovementKernel((await WebAssembly.instantiate(m,{})).instance,preferredNodeTrigFromRom(rom,{includeAtan:true}));
 const make=(rt=runtime,tr=path,seed=2663044269)=>createFirstSpawnReplay({project,rom,kernel,fieldKernel,atKernel,runtime:rt,trajectory:tr,seed});
 const run=s=>{while(s.advance()){}return s;};
 const immutable=JSON.stringify({runtime,path});const first=run(make()),second=run(make());eq(first.events,second.events);eq(JSON.stringify({runtime,path}),immutable);
 eq([first.status,first.events.length,first.consumed,first.seed,first.timer],['created',90,63,4044910212,0]);eq(first.birth,{xyz:[-53169,-3356,-2253],species:83,slot:112,serial:1});
 for(const mutate of [r=>r.conditions.noExternalAT=false,r=>r.conditions.soleEligibleMember=null,r=>r.parties[1].pointer=20,r=>delete r.runtimeNodeFlags[0],r=>r.creatorContext.inventory.slots[0].pointer=0,r=>r.creatorContext.inventory.slots[0].actorFlags=0,r=>r.creatorContext.inventory.slots[0].monsterIdRaw=3,r=>{r.creatorContext.fields[0].tables=structuredClone(first.field.tables);r.creatorContext.fields[0].tables.rows[0].items[0].speciesWord=1;},r=>r.creatorContext.graph={},r=>r.mapId=7401]){const x=structuredClone(runtime);mutate(x);reject(()=>make(x));}
 const noBinding=structuredClone(runtime);delete noBinding.creatorContext.terrain.objects[0].resourceBindingVerified;const unresolved=run(make(noBinding));eq(unresolved.status,'unresolved');eq(unresolved.birth,null);eq(unresolved.consumed,63);eq(unresolved.timer,3016);eq(unresolved.seed,first.seed);
 const noTemplate=structuredClone(runtime);noTemplate.creatorContext.templates=[];const unknown=run(make(noTemplate));eq(unknown.status,'unresolved');eq(unknown.birth,null);
 const missingModel=structuredClone(runtime),model=missingModel.creatorContext.fields[0].resources.models;Object.assign(model,{declaredCount:0,basePointer:0,entries:[]});const rejected=run(make(missingModel));eq(rejected.status,'rejected');eq(rejected.birth,null);eq(rejected.timer,3016);eq(rejected.consumed,63);
 const thrown=make();thrown.kernel={...kernel,state2EntrySteering:kernel.state2EntrySteering.bind(kernel),terrainHeight(){throw Error('injected terrain failure');}};run(thrown);eq(thrown.status,'unresolved');eq(thrown.consumed,63);eq(thrown.seed,first.seed);eq(thrown.events.at(-1).invocationResolved,false);eq(thrown.birth,null);
 const shifted=structuredClone(path);for(const s of shifted.steps)s.hero.xyz[0]+=s.index*64;const moved=run(make(runtime,shifted));assert.notDeepEqual(moved.events,first.events);checks++;eq(moved.heroTrace[1][0]-first.heroTrace[1][0],64);
 const short=structuredClone(path);short.steps=short.steps.slice(0,30);const ended=run(make(runtime,short));eq(ended.status,'trajectory-ended');eq(ended.birth,null);
 const changed=run(make(runtime,path,123456789));assert.notEqual(changed.seed,first.seed);checks++;eq(changed.events.length,90);
 optional={passed:true,firstBirth:first.birth,steps:first.events.length,consumed:first.consumed,seed:first.seed,unknownTerrainStops:true,changedPath:{status:moved.status,steps:moved.events.length,birth:moved.birth},noLaterActorOutputsRead:true};
}
console.log(JSON.stringify({passed:true,checks,optional,scope:'first creator only; optional historical native expectations are comparison assertions'},null,2));
