#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {MapProject} from '../web/map-core.mjs';
import {MonsterMovementKernel} from '../web/monster-movement.mjs';
import {preferredNodeTrigFromRom} from '../web/field-preferred-node.mjs';
import {ATKernel,parseSeed} from '../web/at-core.mjs';
import {FieldATKernel} from '../web/field-at.mjs';
import {createFirstSpawnReplay} from '../web/first-spawn-replay.mjs';
const [romPath,runtimePath,trajectoryPath,seedText,mode]=process.argv.slice(2);
if(!seedText)throw Error('Usage: replay-first-spawn.mjs ROM.nds runtime.json trajectory.json seed');
const [bytes,r,t,m,a]=await Promise.all([readFile(romPath),readFile(runtimePath,'utf8'),readFile(trajectoryPath,'utf8'),readFile(new URL('../web/wasm/monster_movement.wasm',import.meta.url)),readFile(new URL('../web/wasm/map_render.wasm',import.meta.url))]);
const rom=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),project=new MapProject(rom,''),kernel=new MonsterMovementKernel((await WebAssembly.instantiate(m,{})).instance,preferredNodeTrigFromRom(rom,{includeAtan:true})),atKernel=new ATKernel((await WebAssembly.instantiate(a,{})).instance);
if(mode!==undefined&&mode!=='--newborn')throw Error('Only optional --newborn mode is supported');
const session=createFirstSpawnReplay({project,rom,kernel,atKernel,fieldKernel:new FieldATKernel(atKernel),runtime:JSON.parse(r),trajectory:JSON.parse(t),seed:parseSeed(seedText),continueNewborn:mode==='--newborn'});
while(session.advance()){}
console.log(JSON.stringify({status:session.status,reason:session.reason,seed:session.seed,consumed:session.consumed,timer:session.timer,birth:session.birth,actor:session.actor,events:session.events,scope:mode==='--newborn'?'conditional first derived actor through supported motion; stops before second creation/current video state unresolved':'conditional first creator only; no later actor updates or current video state',nativeOutputsRead:false},null,2));
