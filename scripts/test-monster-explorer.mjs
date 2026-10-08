#!/usr/bin/env node
// UI-independent orchestration checks. Optional user-ROM smoke loads resources
// locally; no native fixture, recorded actor state or expected trajectory enters.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultExplorerConfig,validateExplorerConfig,createExplorerProfile,ExplorerSession,explorerTerrain,explorerMapTransform} from '../web/monster-explorer.mjs?v=motion-closure-20261008-89e290ef';
import {MapProject} from '../web/map-core.mjs';
import {MonsterMovementKernel} from '../web/monster-movement.mjs?v=motion-closure-20261008-89e290ef';
import {preferredNodeTrigFromRom} from '../web/field-preferred-node.mjs';
import {monsterCol2FromRom} from '../web/monster-terrain.mjs';
import {Narc} from '../web/vendor/narc-source.js';
import {ATKernel} from '../web/at-core.mjs';
import {FieldATKernel} from '../web/field-at.mjs';
const graph={nodes:[{index:0,id:23,position:[0,1,0],neighbors:[1],areaMask:0},{index:1,id:71,position:[10,1,0],neighbors:[0],areaMask:0}],edges:[[0,1]]};
const c=defaultExplorerConfig(graph);assert.equal(c.declaredHypothesis,false);assert.equal(c.sceneComplete,false);assert.equal(c.noOtherActors,false);assert.equal(c.animationType1,false);assert.equal(c.anchorMode,'unknown');
assert.deepEqual(validateExplorerConfig(c,graph),c);
assert.throws(()=>validateExplorerConfig({...c,observedNextXYZ:[1,2,3]},graph));
assert.throws(()=>validateExplorerConfig({...c,mapId:7403},graph));
assert.throws(()=>validateExplorerConfig({...c,targetNodeIndex:0},graph));
assert.throws(()=>validateExplorerConfig({...c,seed:-1},graph));
assert.throws(()=>validateExplorerConfig({...c,xyz:[1,NaN,3]},graph));
assert.throws(()=>validateExplorerConfig({...c,parties:c.parties.slice(0,3)},graph));
assert.throws(()=>validateExplorerConfig({...c,parties:[{mode:'unknown',xyz:[0,0,0],nativeState:[]},...c.parties.slice(1)]},graph));
assert.throws(()=>validateExplorerConfig({...c,anchorMode:'none',anchors:[[0,0,0]]},graph));
assert.throws(()=>validateExplorerConfig({...c,terrainMembers:['../raw.bin']},graph));
assert.throws(()=>validateExplorerConfig({...c,terrainMembers:['A.col2','A.col2']},graph));
assert.equal(explorerTerrain(c,new Map()),null);
assert.deepEqual(explorerTerrain({...c,sceneComplete:true},new Map()).objects,[]);
assert.throws(()=>explorerTerrain({...c,sceneComplete:true,terrainMembers:['A.col2']},new Map()));
const tables=[{tableId:7,flags:0}],steer={state2EntrySteering:()=>({resolved:true,targetAngle:6434,steeringDistance:40960})};
assert.throws(()=>createExplorerProfile({config:c,graph,tableRows:tables,resources:new Map(),kernel:steer}));
const declared={...c,declaredHypothesis:true};
const make=()=>createExplorerProfile({config:declared,graph,tableRows:tables,resources:new Map(),kernel:steer});
const profile=make();assert.equal(profile.actor.currentNodeIndex,1);assert.equal(profile.actor.targetNodeId,71);assert.deepEqual(profile.actor.targetXYZ,[40960,4096,0]);assert.equal(profile.actor.angle,0);assert.equal(profile.actor.targetAngle,6434);assert.equal(profile.actor.species,1);assert.equal(profile.context.inventory.slots[1].registryKnown,false);
assert.equal(profile.groundContext.anchorsComplete,false);assert.equal(profile.context.terrain,null);
const unknown=structuredClone(declared);unknown.parties[2].mode='unknown';const up=createExplorerProfile({config:unknown,graph,tableRows:tables,resources:new Map(),kernel:steer});assert.deepEqual(up.context.parties[2],{slot:2,registryKnown:false});
const next=actor=>({...structuredClone(actor),xyz:[actor.xyz[0]+5,actor.xyz[1],actor.xyz[2]],currentSeed:(actor.currentSeed+1)>>>0});
let order=[];
const kernel={step:a=>{order.push('ai');return{resolved:true,nextState:next(a),atConsumed:1};},walkingPass:a=>{order.push('ground');return{resolved:true,nextState:{...structuredClone(a),xyz:[a.xyz[0],a.xyz[1]-2,a.xyz[2]]},atConsumed:0};}};
const at={seedAt:(seed,n)=>(seed+Number(n))>>>0};
const keep=()=>{order.push('life');return{resolved:true,outcome:'retain'};};
const session=new ExplorerSession(make(),kernel,null,at,keep);assert(session.advance('cycle'));assert.deepEqual(order,['ai','life','ground']);assert.equal(session.aiCalls,1);assert.equal(session.ownedAT,1);assert.deepEqual(session.actor.xyz,[5,4094,0]);
session.external(4);assert.equal(session.externalAT,4);assert.equal(session.seedPrefix,6);assert.equal(session.actor.currentSeed,6);assert.deepEqual(session.actor.xyz,[5,4094,0]);assert.equal(session.profile.context.inventory.slots[0].nodeIndex,1);
order=[];const reset=new ExplorerSession(make(),kernel,null,at,()=>{order.push('life');return{resolved:true,outcome:'reset-deactivate',resetProjectionResolved:true,projectedResetFields:{xyz:[0,0,0]},lifetimeEvent:{lastXYZ:[5,4096,0]}};});assert.equal(reset.advance('cycle'),false);assert.deepEqual(order,['ai','life']);assert.deepEqual(reset.actor.xyz,[5,4096,0]);assert.deepEqual(reset.trace.at(-1),[5,4096,0]);assert.equal(reset.stopped,true);assert.equal(reset.advance('ai'),false);assert.equal(reset.external(5),false);
const failGround=new ExplorerSession(make(),{...kernel,walkingPass:()=>({resolved:false,reason:'unknown ground'})},null,at,keep);assert.equal(failGround.advance('cycle'),false);assert.deepEqual(failGround.actor.xyz,[5,4096,0]);assert.equal(failGround.ownedAT,1);assert.equal(failGround.aiCalls,1);assert.match(failGround.reason,/unknown ground/);
const partial=new ExplorerSession(make(),{step:()=>({resolved:false,minimumATConsumed:1,reason:'geometry unresolved'})},null,at,keep);assert.equal(partial.advance('ai'),false);assert.deepEqual(partial.actor.xyz,[0,4096,0]);assert.equal(partial.actor.currentSeed,1);assert.equal(partial.seedPrefix,2);assert.equal(partial.ownedAT,1);assert.equal(partial.aiCalls,0);
assert.equal(explorerMapTransform(null,800,520),null);assert.equal(explorerMapTransform({width:100,height:100,originPixel:[0,0],descriptor:{worldToMapScale:0}},800,520),null);assert.deepEqual(explorerMapTransform({width:100,height:100,originPixel:[10,20],descriptor:{worldToMapScale:2}},800,600),{scale:12,x:40,z:-120,fit:6,ox:100,oz:0});
const result={unit:'passed',claims:'orchestration and guard preservation, not native numerical validation'};
if(process.argv[2]){
 const bytes=await readFile(process.argv[2]),rom=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const project=new MapProject(rom,''),records=project.records.filter(r=>r.mapId===7402);assert.equal(records.length,1);const record=records[0],g=project.fieldGraphs.graphs.find(g=>g.key===record.fieldGraph.key);
 const [mm,am]=await Promise.all([readFile(new URL('../web/wasm/monster_movement.wasm',import.meta.url)),readFile(new URL('../web/wasm/map_render.wasm',import.meta.url))]);
 const movement=new MonsterMovementKernel((await WebAssembly.instantiate(mm,{})).instance,preferredNodeTrigFromRom(rom,{includeAtan:true}));const a=new ATKernel((await WebAssembly.instantiate(am,{})).instance),f=new FieldATKernel(a);
 const archivePath=`data/map/${record.fieldCode}.amdj`,archive=Narc.load(new Uint8Array(project.nitro.readFile(archivePath))),names=Array.from({length:archive.files.length},(_,i)=>archive.fnt.getFilenameOf(i)).filter(n=>n.endsWith('.col2'));
 const resource=monsterCol2FromRom(rom,{archivePath,memberName:names[0]}),resources=new Map([[names[0],resource]]);
 const base=defaultExplorerConfig(g);Object.assign(base,{sceneComplete:true,terrainMembers:[names[0]],declaredHypothesis:true,animationType1:true,noOtherActors:true,anchorMode:'none'});
 const terrain=explorerTerrain(base,resources),ground=movement.terrainHeight(base.xyz,terrain);assert(ground.resolved,ground.reason);base.xyz[1]=ground.height;base.parties[0].xyz=[base.xyz[0]+8*4096,base.xyz[1],base.xyz[2]];
 const build=()=>createExplorerProfile({config:base,graph:g,tableRows:record.encounterContexts.flatMap(x=>x.rows),resources,kernel:movement});
 const first=new ExplorerSession(build(),movement,f,a),initial=structuredClone(first.actor.xyz);for(let i=0;i<10;i++)if(!first.advance('cycle'))break;
 assert(first.aiCalls>0,first.reason);assert(first.trace.some(p=>p.some((v,i)=>v!==initial[i])),'real model must produce nonzero motion');
 const second=new ExplorerSession(build(),movement,f,a);for(let i=0;i<10;i++)if(!second.advance('cycle'))break;assert.deepEqual(second.events,first.events);
 // A changed heading changes the predictive trace, without changing recorded data.
 const originalAngle=base.angle;base.angle=(originalAngle+6434)%25736;const turned=new ExplorerSession(build(),movement,f,a);turned.advance('ai');assert.notDeepEqual(turned.actor.xyz,first.events.find(e=>e.stage==='AI').xyz);base.angle=originalAngle;
 const absent=build();absent.lifetimeContext.parties=Array.from({length:4},(_,slot)=>({slot,registryKnown:true,pointer:0}));const ended=new ExplorerSession(absent,movement,f,a);ended.advance('cycle');assert(ended.stopped);assert.match(ended.reason,/reset-deactivate/);assert.notDeepEqual(ended.actor.xyz,[0,0,0]);assert.equal(ended.events.some(e=>e.stage==='接地'),false);
 result.userRom={passed:true,logicalCyclesRequested:10,aiCalls:first.aiCalls,motionChanged:true,deterministic:true,changedHeadingChangesTrace:true,resetEndsBeforeWalking:true,stopped:first.stopped,reason:first.reason||null};
}
console.log(JSON.stringify(result,null,2));
