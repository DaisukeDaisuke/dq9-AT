import assert from 'node:assert/strict';
import {test} from 'node:test';
import {VideoMapContinuity} from '../web/map-browser-preview/video-map-continuity.mjs';
import {resolveVideoMinimapCandidates} from '../web/map-browser-preview/video-minimap-candidates.mjs';
function fixture(){
 const events=[],sourceImage={width:512,height:192,rgba:new Uint8ClampedArray(512*192*4)},pixel=(x,y,v)=>sourceImage.rgba.set([v,v,v,255],(y*512+x)*4);
 for(let i=0;i<512*192;i++)sourceImage.rgba[i*4+3]=255;for(let y=80;y<83;y++)for(let x=120;x<123;x++)pixel(x,y,66);
 for(let y=181;y<=188;y++){for(const x of [3,4,5,58,59,60])pixel(x,y,66);pixel(1,y,200);pixel(62,y,200);}
 const frameEvidence={sourceId:'synthetic',sourceEpoch:2,timelineSegment:1,frameSerial:7,mediaTime:12,fullRGBA_SHA256:'a'.repeat(64)},input={sourceImage,layout:'ds-horizontal',frameEvidence,frameId:7,automaticRecognition:true},records=[1,2].map(mapId=>({key:'map-'+mapId,mapId,minimapCandidates:[{path:'a.bmmp'},{path:'b.bmmp'}]})),floors={instances:[],unsupported:[]},image=path=>({width:256,height:192,rgba:new Uint8ClampedArray(256*192*4),originPixel:[0,0],descriptor:{path,worldToMapScale:2,groupOrder:'source-order-prepended',groups:[{kind:'coordinate-map-id-list',mapIds:[1,2],callOffset:0,x:60.5,z:40.5}]}}),calls=[];
 const matcher={setReference(r){events.push('descriptor:'+r.mapId+':'+r.descriptor);},match(_frame,options){calls.push(structuredClone(options));return {resolved:true,candidates:[{dx:0,dy:0,scale:.5,score:1}],search:{budgetExhausted:false}};}},alignment={romSHA256:'rom',records,catalog:{minimap:{}},matcher,imageHits:0,imageMisses:0,referenceCache:{cache:new Map(),image},monsterWorkflowEligibility:()=>({skipBackground:false}),scene:()=>({floors})},continuity=new VideoMapContinuity();continuity.entry={key:continuity.key(input,'rom'),evidence:{maps:records.map(r=>({key:r.key}))},originFrame:frameEvidence};return{events,input,records,floors,image,matcher,calls,alignment,continuity};
}
test('a real queued capture task runs between descriptors; all candidates and independent match budgets survive',async()=>{
 const f=fixture(),capture=new Promise(resolve=>setTimeout(()=>{f.events.push('capture-task');resolve();},0)),pending=f.continuity.probe({input:f.input,alignment:f.alignment});
 assert.deepEqual(f.events,['descriptor:1:a.bmmp']);await Promise.resolve();assert.deepEqual(f.events,['descriptor:1:a.bmmp']);await capture;const value=await pending;
 assert.deepEqual(f.events,['descriptor:1:a.bmmp','capture-task','descriptor:1:b.bmmp','descriptor:2:a.bmmp','descriptor:2:b.bmmp']);assert.equal(value.prevalidatedMaps.selections.size,2);assert.deepEqual(value.evidence.continuity.survivingRecordKeys,['map-1','map-2']);assert.equal(f.calls.length,4);assert(f.calls.every(c=>c.maxMilliseconds===1500&&JSON.stringify(c.scales)==='[0.5]'));assert.equal(value.evidence.mapIdentityCertified,undefined);assert.equal(value.evidence.continuity.mapIdentityCertified,false);
 for(const record of f.records){const expected=await resolveVideoMinimapCandidates({record,catalog:f.alignment.catalog,renderer:{compose:(_c,path)=>f.image(path)},matcher:f.matcher,floors:f.floors,...f.input});assert.deepEqual(value.prevalidatedMaps.selections.get(record.key),expected);}
 assert.doesNotThrow(()=>structuredClone(value));
});
test('cancellation in a capture task suppresses the next descriptor and any stale reuse result',async()=>{
 const f=fixture();let active=true;const cancel=new Promise(resolve=>setTimeout(()=>{active=false;f.events.push('cancel-task');resolve();},0));const pending=f.continuity.probe({input:f.input,alignment:f.alignment,isCurrent:()=>active});await cancel;await assert.rejects(pending,{name:'AbortError'});assert.deepEqual(f.events,['descriptor:1:a.bmmp','cancel-task']);assert.equal(f.calls.length,1);assert.equal(f.continuity.stats.hits,0);assert.equal(f.continuity.stats.misses,0);
});
test('source epoch replacement while yielding cannot publish old descriptor continuation',async()=>{
 const f=fixture();let epoch=2;const expectedEpoch=epoch;setTimeout(()=>{epoch++;f.continuity.reset();},0);await assert.rejects(f.continuity.probe({input:f.input,alignment:f.alignment,isCurrent:()=>epoch===expectedEpoch}),{name:'AbortError'});assert.equal(f.calls.length,1);assert.equal(f.continuity.entry,null);assert.equal(f.continuity.stats.hits,0);
});
test('cancellation during the last boundary still prevents a completed result',async()=>{
 const f=fixture();f.records.splice(1);f.records[0].minimapCandidates.splice(1);let current=true;setTimeout(()=>current=false,0);await assert.rejects(f.continuity.probe({input:f.input,alignment:f.alignment,isCurrent:()=>current}),{name:'AbortError'});assert.equal(f.calls.length,1);assert.equal(f.continuity.stats.hits,0);
});
test('standalone candidate API keeps its default microtask-only callback path',async()=>{
 const f=fixture(),pending=resolveVideoMinimapCandidates({record:f.records[0],catalog:f.alignment.catalog,renderer:{compose:(_c,path)=>f.image(path)},matcher:f.matcher,floors:f.floors,...f.input});assert.equal(f.calls.length,1);await Promise.resolve();assert.equal(f.calls.length,2);await pending;
});
