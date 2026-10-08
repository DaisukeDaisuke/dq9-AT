import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {proposeEnemyROIs} from '../web/monster-position-proposals.mjs';
import {recognizeROI} from '../web/monster-recognition-engine.mjs';
import * as page from '../web/monster-recognize-page.mjs?v=frame-heading-20261008-b8f5df4e';
let count=0;const check=(name,fn)=>{fn();count++;console.log(`ok ${count} - ${name}`);};
const image=()=>({width:256,height:192,rgba:new Uint8ClampedArray(Array.from({length:256*192},()=>[20,70,150,255]).flat())});
const fill=(im,x,y,w,h,c)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)im.rgba.set([...c,255],(yy*256+xx)*4);};
const stamp={sourceId:'synthetic-accounting',sourceEpoch:1,timelineSegment:0,frameSerial:1,romEpoch:1,sourceFrame:{width:256,height:192},videoTime:0,timestampBasis:'synthetic',enemyROI:null,featureMethod:'dinov2',inferenceBackend:'wasm',sceneContext:{kind:'field',gameplayROI:{x:0,y:0,w:256,h:192},excludeCenter:true}};
const options={profile:'shrine-blue-v1',excludeCommandHUD:true,maxProposals:8,oversizedWarmSplit:true};
const im=image();fill(im,5,40,180,125,[90,85,80]);fill(im,30,60,20,30,[200,50,30]);
const one=proposeEnemyROIs(im,stamp,options);
check('warm additions count as gate-passing candidates before the slot budget',()=>{assert.equal(one.proposals.length,1);assert.equal(one.coverage.candidateComponents,1);assert.equal(one.coverage.originalCandidateComponents,0);assert.equal(one.coverage.warmSplitCandidateComponents,1);assert.equal(one.coverage.retainedCandidates,1);assert.equal(one.coverage.budgetDropped,0);});
fill(im,65,60,20,30,[200,50,30]);fill(im,30,110,20,30,[200,50,30]);
const limited=proposeEnemyROIs(im,stamp,{...options,maxProposals:1});
check('warm candidates omitted by the slot budget are not reported as zero loss',()=>{assert.equal(limited.coverage.candidateComponents,3);assert.equal(limited.proposals.length,1);assert.equal(limited.coverage.budgetDropped,2);assert.equal(limited.coverage.retainedCandidates+limited.coverage.budgetDropped,limited.coverage.candidateComponents);});
const original=image();fill(original,25,15,12,18,[200,50,30]);fill(original,60,15,12,18,[200,50,30]);
const limitedOriginal=proposeEnemyROIs(original,stamp,{...options,maxProposals:1});
check('full original budget does not pretend unevaluated warm candidates were rejected',()=>{assert.equal(limitedOriginal.coverage.originalCandidateComponents,2);assert.equal(limitedOriginal.coverage.warmSplitCandidateComponents,0);assert.equal(limitedOriginal.coverage.budgetDropped,1);assert.equal(limitedOriginal.warmSplitExperiment.evaluated,false);});
// Frozen serialized proposal hashes come from the unchanged production implementation.
// Covers rectangles, order, priority, IDs and classification flags; telemetry is separate.
check('proposal bytes match pre-accounting production snapshots',()=>{const hash=r=>createHash('sha256').update(JSON.stringify(r.proposals)).digest('hex');assert.equal(hash(one),'590daaf33c032b705534f60d65fc958780f2b63dc604845a85945e691ec5fc1e');assert.equal(hash(limited),'590daaf33c032b705534f60d65fc958780f2b63dc604845a85945e691ec5fc1e');assert.equal(hash(limitedOriginal),'24febc91aeeb013aa9f58cf8480eb7671147af2818aa0e2c4d534d3b6000dfb3');});
const off=proposeEnemyROIs(im,stamp,{...options,oversizedWarmSplit:false});
check('original oversized rejections are separate from derived candidates, not added to a total',()=>{assert.equal(off.coverage.oversizedComponents,1);assert.equal(one.coverage.oversizedComponents,1);assert.equal(off.coverage.candidateComponents,0);assert.equal(one.coverage.candidateComponents,1);assert.equal(one.coverage.absenceCertified,false);assert.equal(one.unknown.calibrated,false);assert.equal(one.ATDrawsCertified,0);});
const empty=proposeEnemyROIs(image(),stamp,options);
check('empty foreground keeps active exclusion scope without inventing missed-enemy counts',()=>{assert.equal(empty.coverage.candidateComponents,0);assert.deepEqual(empty.coverage.exclusions.map(x=>x.reason),['central-field-exclusion','command-hud-exclusion']);assert.equal(empty.coverage.absenceCertified,false);});
// The real engine takes the center gate before query encoding. No ROM/model downloads.
let encodes=0;const dino={spec:{provider:'synthetic',precision:'synthetic'},stats:{queryMs:0,templateEmbeddingMs:0,templateCacheHits:0,templateCacheMisses:0},encode:async()=>{encodes++;return new Float32Array(384);}};
const deps={catalog:new Map([['synthetic',[]]]),nitro:{},geometry:{},getDino:async()=>dino};
const request=roi=>({romEpoch:1,modelIds:['synthetic'],variant:'_f',preset:'quick',featureMethod:'dinov2',inferenceBackend:'wasm',captureStamp:{...structuredClone(stamp),enemyROI:roi},sceneContext:structuredClone(stamp.sceneContext),crop:{width:roi.w,height:roi.h,rgba:new Uint8ClampedArray(roi.w*roi.h*4).fill(255)}});
const excluded=await recognizeROI(request({x:110,y:75,w:10,h:10}),deps);
check('real center gate explicitly reports zero query descriptors and performs no encoding',()=>{assert.equal(excluded.skipped,'central-field-exclusion');assert.equal(excluded.coverage.queryDescriptorsComputed,0);assert.equal(encodes,0);});
const reached=await recognizeROI(request({x:20,y:20,w:10,h:10}),deps);
check('query descriptor reach is distinct from successfully ranked models',()=>{assert.equal(reached.coverage.queryDescriptorsComputed,1);assert.equal(encodes,1);assert.equal(reached.rankings.length,0);assert.equal(reached.coverage.completedModels,0);assert.equal(reached.unknown.calibrated,false);});
check('production summary states same-frame CPU units and separate active masks',()=>{assert.equal(page.proposalCoverageText(limited),'CPU選別通過 3候補 → 保持 1候補（枠上限で2候補省略）。中央・HUD除外内は未観測です。');assert.equal(page.proposalCoverageText({}),'CPU候補の段階別件数は未計測です。');});
check('descriptor text never converts rankings or missing telemetry into successful reach',()=>{assert.equal(page.queryDescriptorText(excluded),'入力切り抜きの特徴計算 0件（未観測）');assert.equal(page.queryDescriptorText(reached),'入力切り抜きの特徴計算 1件');assert.equal(page.queryDescriptorText({rankings:[{}]}),'入力切り抜きの特徴計算 未計測');});
console.log(JSON.stringify({passed:count,synthetic:true,noAccuracyClaim:true}));
