// Synthetic contract fixture. No ROM, video, measured species or private files.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const source=process.argv[2]?pathToFileURL(path.join(path.resolve(process.argv[2]),'web/map-browser-preview/')):new URL('../web/map-browser-preview/',import.meta.url);
const {retainCameraATBackgroundSupport,resolveCameraATBackgroundSupport}=await import(new URL('camera-at-background-support.mjs',source));
const {replaceResidualTimelineClassification}=await import(new URL('residual-classification-state.mjs',source));
const frame={sourceId:'synthetic-video',sourceEpoch:2,timelineSegment:3,mediaTime:1.25,frameSerial:4,fullRGBA_SHA256:'a'.repeat(64),romSHA256:'b'.repeat(64)};
const matrix=Array.from({length:16},(_,i)=>i%5===0?4096:0),branch={branchId:'background-row-0',recordKey:'synthetic-map',mapId:7,romSHA256:frame.romSHA256,fullRGBA_SHA256:frame.fullRGBA_SHA256,viewFx:matrix,projectionFx:matrix,alignment:{dx:0,dy:-1},alignedBackgroundRGBA_SHA256:'c'.repeat(64),alignedBackgroundRGBA:new Uint8Array(256*192*4),nativeBodyDestinationReuse:{privatePayload:'not-retained'}};
const support={kind:'same-frame-background-branch-support-v1',ready:true,frame,passingBranchCount:1,branches:[branch]},expected=[{branchId:branch.branchId,recordKey:branch.recordKey,mapId:7}];
const retained=retainCameraATBackgroundSupport(support);assert.deepEqual(retained.branches[0].camera,{viewFx:matrix,projectionFx:matrix});assert(!Object.hasOwn(retained.branches[0],'alignedBackgroundRGBA'));assert(!Object.hasOwn(retained.branches[0],'nativeBodyDestinationReuse'));assert.deepEqual(resolveCameraATBackgroundSupport(retained,frame,expected),retained);
retained.branches[0].camera.viewFx[0]=0;assert.equal(matrix[0],4096);retained.frame.sourceEpoch=99;assert.equal(frame.sourceEpoch,2);
let rejected=0;for(const mutate of[s=>s.frame.sourceId+='x',s=>s.frame.sourceEpoch++,s=>s.frame.timelineSegment++,s=>s.frame.mediaTime++,s=>s.frame.fullRGBA_SHA256='d'.repeat(64),s=>s.branches[0].romSHA256='d'.repeat(64),s=>s.branches[0].fullRGBA_SHA256='d'.repeat(64),s=>s.branches[0].recordKey+='x',s=>s.branches[0].mapId++,s=>s.branches[0].branchId+='x',s=>s.branches.push(structuredClone(s.branches[0])),s=>s.passingBranchCount++,s=>s.ready=false]){const changed=structuredClone(support);mutate(changed);assert.throws(()=>resolveCameraATBackgroundSupport(changed,frame,expected));rejected++;}
assert.equal(retainCameraATBackgroundSupport(undefined),null);assert.throws(()=>resolveCameraATBackgroundSupport(null,frame,expected));
const rows=new Map([[4,{}]]),timeline={update(id,patch){if(!rows.has(id))return false;Object.assign(rows.get(id),structuredClone(patch));return true;}};
assert.equal(replaceResidualTimelineClassification(timeline,4,{source:{background:{backgroundBranchSupport:support}},sightings:[{id:'synthetic-sighting'}],classificationJob:{complete:true}}),true);
assert.deepEqual(resolveCameraATBackgroundSupport(rows.get(4).cameraATBackgroundSupport,frame,expected),retainCameraATBackgroundSupport(support));assert.equal(rows.get(4).classificationComplete,true);
replaceResidualTimelineClassification(timeline,4,null,[1,2]);assert.equal(rows.get(4).cameraATBackgroundSupport,null);assert.deepEqual(rows.get(4).sightings,[]);assert.deepEqual(rows.get(4).unclassifiedRegionIds,[1,2]);assert.equal(rows.get(4).classificationComplete,false);assert.equal(replaceResidualTimelineClassification(timeline,null),false);assert.equal(replaceResidualTimelineClassification(timeline,8),false);
console.log(`PASS: compact independent source support, ${rejected} source/branch rejections, historical retention and clear`);
