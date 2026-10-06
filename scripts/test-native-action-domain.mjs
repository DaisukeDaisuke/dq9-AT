import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {openMapRom} from '../web/map-browser-preview/static-scene.mjs';
import {parseMonsterAssetCatalog,readMonsterAssets} from '../web/monster-assets.mjs';
import {readNSBCA} from '../web/monster-animation.mjs';
import {readNativeConditionalActionRules,prepareNativeConditionalActionSource} from '../web/monster-native-action-domain.mjs';
import {advanceFieldAnimationPhase} from '../web/monster-field-animation-state.mjs';
const rom=new Uint8Array(fs.readFileSync(process.argv[2])),project=openMapRom(rom),catalog=parseMonsterAssetCatalog(fs.readFileSync(new URL('../web/data/monsters.csv',import.meta.url),'utf8'));
assert.equal(crypto.createHash('sha256').update(rom).digest('hex'),'3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7');
const rules=readNativeConditionalActionRules(project.sdk);assert.equal(rules.currentActionKnown,false);assert.deepEqual(rules.requests.map(r=>r.clip),['attack0a.nsbca','death.nsbca']);assert.equal(rules.requests[0].priorTransitions.length,11);assert.deepEqual(rules.requests[1].priorTransitions,[8]);
assert.throws(()=>readNativeConditionalActionRules({read:(a,n)=>new Uint8Array(n)}),/source mismatch/);
let total=0,ordinary=0,unsupported=[];for(const modelId of ['z000a','z061c','z063a','z060a','z005a','z037a','z012a','z014b','z000c','z015a']){
 const asset=readMonsterAssets(project.nfs,catalog,[{modelId,variant:'_f'}]).models[0],list=[{clip:'bind',frame:null}],animations=new Map();
 for(const clip of ['stand.nsbca','run.nsbca','appear.nsbca'])try{const a=readNSBCA(asset.animations.find(a=>a.name===clip).bytes);animations.set(clip,a);for(let frame=0;frame<a.numFrames;frame++)list.push({clip,frame});}catch(error){unsupported.push({modelId,clip,reason:error.message});}
 const source={key:modelId,asset,list,animations,unsupported:[]},before=JSON.stringify(list),extra=prepareNativeConditionalActionSource(source,rules);assert.equal(JSON.stringify(list),before);ordinary+=list.length;total+=extra.list.length;
 assert(extra.list.every(p=>p.actionCondition.currentActionKnown===false&&p.actionCondition.componentLookupResolved===false));assert(extra.unsupported.some(p=>p.clip==='death.nsbca'));assert(extra.list.every(p=>Number.isInteger(p.frame)&&p.frame>=0&&p.frame<extra.animations.get(p.clip).numFrames));
}
assert.equal(ordinary,363);assert.equal(total,193);assert.equal(unsupported.length,2);
const phase=advanceFieldAnimationPhase({kind:'source-field-animation-rules-v1'},{phaseFx:9*4096,clockPhaseFx:4096,clipRateFx:4096,actorRateFx:4096,numFrames:11,reverse:false,clampAtEnd:false,advanceAllowed:true});assert.equal(phase.phaseFx,0);assert.equal(phase.liveClockKnown,false);
console.log(JSON.stringify({passed:true,ordinaryPoses:ordinary,conditionalActionPoses:total,originalUnsupported:unsupported,sourceGuardRejects:true,missingPriorDeathBranchRetained:true,currentActionKnown:false}));
