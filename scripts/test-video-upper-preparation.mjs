import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVideoUpperPreparation,deriveVideoPlayerMapInput} from '../web/map-browser-preview/video-player-map-input.mjs';
import {VideoMapContinuity} from '../web/map-browser-preview/video-map-continuity.mjs';
const stamp=()=>({sourceId:'test',sourceEpoch:2,timelineSegment:1,frameSerial:7,mediaTime:12,videoTime:12,timestampBasis:'retained-VideoFrame.timestamp',fullRGBA_SHA256:'a'.repeat(64)});
function fixture(){
 const sourceImage={width:512,height:192,rgba:new Uint8ClampedArray(512*192*4)};for(let i=0;i<512*192;i++)sourceImage.rgba[i*4+3]=255;for(let y=80;y<83;y++)for(let x=120;x<123;x++)sourceImage.rgba.set([66,66,66,255],(y*512+x)*4);
 const phases=[],calls=[],image=path=>({width:256,height:192,rgba:new Uint8ClampedArray(256*192*4),originPixel:[0,0],descriptor:{path,worldToMapScale:2,groupOrder:'source-order-prepended',groups:[{kind:'map-id-list',mapIds:[1,2],callOffset:0}]}});
 const matcher={setReference(r){calls.push(['reference',r.mapId,r.descriptor]);},match(frame,options){calls.push(['match',frame.rgba[0],structuredClone(options.excluded)]);return{resolved:true,candidates:[{dx:0,dy:0,scale:.5,score:1}],search:{budgetExhausted:false}};}};
 return {sourceImage,layout:'ds-horizontal',frameEvidence:stamp(),mapImage:image('a.bmmp'),mapId:1,matcher,floors:{instances:[],unsupported:[]},measureMapInput:(phase,run)=>{phases.push(phase);return run();},phases,calls,image};
}
test('four descriptor/map consumers do one preparation and preserve all independently computed outputs',()=>{
 const f=fixture(),upperPreparation=createVideoUpperPreparation(f),results=[];
 for(const [mapId,path]of [[1,'a.bmmp'],[1,'b.bmmp'],[2,'a.bmmp'],[2,'b.bmmp']]){
  const input={...f,mapId,mapImage:f.image(path)},expected=deriveVideoPlayerMapInput({...input,measureMapInput:(_p,run)=>run()}),actual=deriveVideoPlayerMapInput({...input,upperPreparation});assert.deepEqual(actual,expected);results.push(actual);
 }
 assert.equal(f.phases.filter(p=>p==='upper-marker-preparation').length,1);assert.equal(f.phases.filter(p=>p==='upper-marker-preparation-reuse').length,3);assert.equal(f.phases.filter(p=>p==='minimap-registration').length,4);assert.equal(f.phases.filter(p=>p==='marker-world-floor-queries').length,4);
 for(let i=1;i<results.length;i++){assert.notStrictEqual(results[0].upper,results[i].upper);assert.notStrictEqual(results[0].upper.rgba,results[i].upper.rgba);assert.notStrictEqual(results[0].markers,results[i].markers);assert.notStrictEqual(results[0].markers.calibration.profiles,results[i].markers.calibration.profiles);}
 assert.doesNotMatch(JSON.stringify(results),/upperPreparation|preparation-reuse/);assert.doesNotThrow(()=>structuredClone(results));
});
test('result and matcher mutations cannot contaminate the private preparation or other descriptors',()=>{
 const f=fixture(),token=createVideoUpperPreparation(f),expected=deriveVideoPlayerMapInput({...f,measureMapInput:(_p,run)=>run()}),first=deriveVideoPlayerMapInput({...f,upperPreparation:token});first.upper.rgba.fill(255);first.upperROI.x=-100;first.markers.candidates.length=0;first.markers.calibration.profiles[0].rgb[0]=255;
 const match=f.matcher.match;f.matcher.match=(frame,options)=>{const result=match(frame,options);frame.rgba.fill(255);options.excluded.length=0;return result;};const second=deriveVideoPlayerMapInput({...f,upperPreparation:token});f.matcher.match=match;const third=deriveVideoPlayerMapInput({...f,upperPreparation:token});assert.deepEqual(second,expected);assert.deepEqual(third,expected);assert(f.calls.filter(c=>c[0]==='match').every(c=>c[1]===0));
});
test('forged/serialized handles and different pixel ownership do fresh work rather than trust prepared data',()=>{
 for(const mutate of [()=>({upperPreparation:{value:{markers:'forged'}}}),()=>({upperPreparation:JSON.parse(JSON.stringify(createVideoUpperPreparation(fixture())))}),f=>({sourceImage:{...f.sourceImage}}),f=>({sourceImage:{...f.sourceImage,rgba:f.sourceImage.rgba.slice()}}),f=>({frameEvidence:{...f.frameEvidence}})]){
  const f=fixture(),token=createVideoUpperPreparation(f);deriveVideoPlayerMapInput({...f,upperPreparation:token});const next={...f,upperPreparation:token,...mutate(f)};deriveVideoPlayerMapInput(next);assert.equal(f.phases.filter(p=>p==='upper-marker-preparation').length,2);assert(!f.phases.includes('upper-marker-preparation-reuse'));
 }
});
test('source/epoch/segment/PTS/hash/dimension/layout changes cannot reuse an old binding',()=>{
 for(const field of ['sourceId','sourceEpoch','timelineSegment','frameSerial','mediaTime','videoTime','timestampBasis','fullRGBA_SHA256']){
  const f=fixture(),token=createVideoUpperPreparation(f);deriveVideoPlayerMapInput({...f,upperPreparation:token});f.frameEvidence[field]=typeof f.frameEvidence[field]==='number'?f.frameEvidence[field]+1:f.frameEvidence[field]+'new';deriveVideoPlayerMapInput({...f,upperPreparation:token});assert.equal(f.phases.filter(p=>p==='upper-marker-preparation').length,2);
 }
 const f=fixture(),token=createVideoUpperPreparation(f);deriveVideoPlayerMapInput({...f,upperPreparation:token});assert.throws(()=>deriveVideoPlayerMapInput({...f,layout:'unsupported',upperPreparation:token}));f.sourceImage.width=256;assert.throws(()=>deriveVideoPlayerMapInput({...f,upperPreparation:token}));
});
test('preparation failure retries normally and registration failures keep original unknown outcomes',()=>{
 const f=fixture(),token=createVideoUpperPreparation(f),rgba=f.sourceImage.rgba;f.sourceImage.rgba=new Uint8Array(1);assert.throws(()=>deriveVideoPlayerMapInput({...f,upperPreparation:token}));f.sourceImage.rgba=rgba;
 f.matcher.match=()=>({resolved:false,candidates:[],search:{budgetExhausted:true}});const result=deriveVideoPlayerMapInput({...f,upperPreparation:token});assert.equal(result.registration.resolved,false);assert.equal(result.status,'first-slot-HUD-unconfirmed');assert.equal(result.worldPositionKnown,false);assert.equal(result.minimumProvenATCalls,0);
});
test('production continuity path shares only within one probe; every new probe prepares again',async()=>{
 const f=fixture(),continuity=new VideoMapContinuity(),records=[1,2].map(mapId=>({key:'map-'+mapId,mapId,minimapCandidates:[{path:'a.bmmp'},{path:'b.bmmp'}]})),input={...f,frameId:7,automaticRecognition:true},alignment={romSHA256:'rom',records,catalog:{minimap:{}},matcher:f.matcher,imageHits:0,imageMisses:0,referenceCache:{cache:new Map(),image:f.image},monsterWorkflowEligibility:()=>({skipBackground:false}),scene:()=>({floors:f.floors})};
 continuity.entry={key:continuity.key(input,'rom'),evidence:{maps:records.map(r=>({key:r.key}))},originFrame:f.frameEvidence};await continuity.probe({input,alignment});assert.equal(f.phases.filter(p=>p==='upper-marker-preparation').length,1);assert.equal(f.phases.filter(p=>p==='upper-marker-preparation-reuse').length,3);await continuity.probe({input,alignment});assert.equal(f.phases.filter(p=>p==='upper-marker-preparation').length,2);assert.equal(f.phases.filter(p=>p==='upper-marker-preparation-reuse').length,6);assert.equal(f.calls.filter(c=>c[0]==='match').length,8);await assert.rejects(continuity.probe({input,alignment,isCurrent:()=>false}),{name:'AbortError'});
});
