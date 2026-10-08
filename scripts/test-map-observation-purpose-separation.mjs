import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {AutomaticVideoAlignment} from '../web/map-browser-preview/automatic-video-alignment.mjs';
import {VideoMapContinuity} from '../web/map-browser-preview/video-map-continuity.mjs';
import {VideoObservationTimeline} from '../web/map-browser-preview/video-observation-timeline.mjs';
function fixture(){
 const sourceImage={width:512,height:192,rgba:new Uint8ClampedArray(512*192*4)},pixel=(x,y,v)=>sourceImage.rgba.set([v,v,v,255],(y*512+x)*4);
 for(let i=0;i<512*192;i++)sourceImage.rgba[i*4+3]=255;for(let y=80;y<83;y++)for(let x=120;x<123;x++)pixel(x,y,66);
 for(let y=181;y<=188;y++){for(const x of [3,4,5,58,59,60])pixel(x,y,66);pixel(1,y,200);pixel(62,y,200);}
 const stamp={sourceId:'fixture',sourceEpoch:1,timelineSegment:1,frameSerial:1,mediaTime:1,fullRGBA_SHA256:'a'.repeat(64)},input={sourceImage,layout:'ds-horizontal',frameEvidence:stamp,frameId:1,automaticRecognition:true};
 const records=[101,202].map(mapId=>({key:'map-'+mapId,mapId,displayLabel:'same-name',minimapCandidates:[{path:'image-'+mapId}]}));
 const floors={instances:[{positionFx:[0,0,0],member:'fixture.col2',col:{shift:0,bounds:{min:[-65536,-4096,-65536],max:[65536,4096,65536]},records:[{index:0,sourceOffset:0,rawFlags:0,normalFx:[0,4096,0],verticesQuantized:[[-65536,0,-65536],[0,0,65536],[65536,0,-65536]]}]}}],unsupported:[]};
 const image=path=>({width:256,height:192,rgba:new Uint8ClampedArray(256*192*4),originPixel:[-128,-96],descriptor:{path,worldToMapScale:2,groupOrder:'source-order-prepended',groups:[{kind:'map-id-list',mapIds:[101,202],callOffset:0}]}});
 const state={winning:101,matches:[],light:[],heavy:[],headings:[],skip:true};let current;
 const matcher={setReference(r){current=r;},match(_frame,options){state.matches.push({mapId:current.mapId,options});const resolved=current.mapId===state.winning;return{resolved,best:{dx:0,dy:0,scale:.5,score:resolved?.99:.2},margin:resolved?.5:.01,candidates:[{dx:0,dy:0,scale:.5,score:resolved?.99:.2}],search:{budgetExhausted:false}};}};
 const alignment=Object.create(AutomaticVideoAlignment.prototype);
 Object.assign(alignment,{project:{},rom:null,romSHA256:'r',catalog:{minimap:{}},records,matcher,referenceCache:{cache:new Map(),cacheBytes:0,image},scenes:new Map(),sceneHits:0,sceneMisses:0,imageHits:0,imageMisses:0,
  monsterMapGate:()=>({status:state.skip?'no-encfld-group':'eligible',skipBackground:state.skip,mapCandidateRetained:true,absenceCertified:false,monsterPresenceKnown:false,minimumProvenATCalls:0}),
  mapInputScene(record,eligibility){if(!eligibility?.skipBackground)return this.scene(record);state.light.push(record.mapId);return{automatic:null,floors,observationOnly:true};},
  scene(record){state.heavy.push(record.mapId);return{automatic:{plan:{recordKey:record.key,mapId:record.mapId}},floors};},headingPlan(record){state.headings.push(record.mapId);return{candidates:[]};},
 });return{alignment,input,records,floors,state,names:{maps:records,romSHA256:'r'}};
}
test('fresh minimap, HUD and floor evidence survives the encounter-only gate; failure and uncertainty are retained',async()=>{
 const f=fixture(),result=await f.alignment.search({input:f.input,names:f.names});
 assert.deepEqual(f.state.light,[101,202]);assert.deepEqual(f.state.heavy,[]);assert.deepEqual(f.state.headings,[]);assert.equal(result.selected,null);assert.deepEqual(result.diagnostics.backgroundCandidates,[]);
 assert.deepEqual(result.located.map(c=>c.record.mapId),[101]);assert.deepEqual(result.located[0].position.floor.heightsFx,[0]);assert.equal(result.located[0].scene.automatic,null);
 assert.deepEqual(result.diagnostics.mapCandidates.map(c=>c.status),['single-equivalent-minimap-group','no-accepted-minimap-hypothesis']);
 for(const row of result.diagnostics.mapCandidates){assert.equal(row.backgroundStatus,'background-skipped-for-monster-workflow');assert.equal(row.monsterWorkflow.absenceCertified,false);assert.equal(row.mapIdentityCertified,false);}
 assert.equal(result.diagnostics.mapCandidates[1].candidates[0].evidence.registration.best.score,.2);assert.equal(result.located[0].position.playerIdentityProven,false);assert.equal(result.diagnostics.minimumProvenATCalls,0);
 assert(f.state.matches.every(m=>m.options.scales.length===1&&m.options.scales[0]===.5));
});
test('same-frame continuity revalidates skipped-map pixels and reuses results without starting background work',async()=>{
 const f=fixture(),first=await f.alignment.search({input:f.input,names:f.names}),continuity=new VideoMapContinuity();continuity.remember(f.input,f.names,first);assert(continuity.entry);
 const before=f.state.matches.length,probe=await continuity.probe({input:f.input,alignment:f.alignment});assert(f.state.matches.length>before);assert.deepEqual(probe.evidence.continuity.survivingRecordKeys,['map-101']);assert.equal(probe.evidence.continuity.candidateSetPreserved,true);assert.equal(probe.evidence.continuity.revalidatedMaps[0].backgroundStatus,'background-skipped-for-monster-workflow');
 const after=f.state.matches.length,reused=await f.alignment.search({input:f.input,names:probe.evidence,prevalidatedMaps:probe.prevalidatedMaps});assert.equal(f.state.matches.length,after);assert.deepEqual(reused.located.map(r=>r.record.mapId),[101]);assert.deepEqual(f.state.heavy,[]);
 f.state.winning=null;assert.equal(await continuity.probe({input:f.input,alignment:f.alignment}),null);assert.equal(continuity.stats.misses,1);
 await assert.rejects(()=>continuity.probe({input:f.input,alignment:f.alignment,isCurrent:()=>false}),{name:'AbortError'});
});
test('old entry-map and new encounter-map candidates reach the existing timeline shape without certifying entry or AT',async()=>{
 const f=fixture(),timeline=new VideoObservationTimeline();
 for(const [index,mapId]of [101,202].entries()){f.state.winning=mapId;const input={...f.input,frameId:index+1,frameEvidence:{...f.input.frameEvidence,frameSerial:index+1,mediaTime:index+1,fullRGBA_SHA256:String(index+1).repeat(64)}},r=await f.alignment.search({input,names:f.names});timeline.begin(input.frameEvidence,{frameSerial:index+1});timeline.maps(index+1,r.diagnostics.locatedCandidates.map(c=>({recordKey:c.recordKey,mapId:c.mapId,descriptorPath:c.descriptor,world:c.world,floorHeightsFx:c.floor.heightsFx})),{mapNameCandidates:f.records.map(c=>({recordKey:c.key,mapId:c.mapId})),mapSearchDiagnostics:r.diagnostics.mapCandidates,monsterWorkflow:r.diagnostics.monsterWorkflow});}
 const events=timeline.snapshot().entryCandidates;assert.equal(events.length,1);assert.equal(events[0].cause,'map-candidate-set-changed');assert.deepEqual(events[0].previousCandidates.map(c=>c.mapId),[101]);assert.deepEqual(events[0].currentCandidates.map(c=>c.mapId),[202]);assert.equal(events[0].entryCertified,false);assert.equal(events[0].entryPTS,null);assert.equal(events[0].minimumProvenATCalls,0);
});
test('explicit and admitted background paths remain unchanged; light floor failures cannot bypass admission or fabricate floors',async()=>{
 const f=fixture();f.state.skip=false;await f.alignment.search({input:f.input,names:f.names});assert.deepEqual(f.state.heavy,[101,202]);assert.deepEqual(f.state.light,[]);assert.deepEqual(f.state.headings,[101]);
 const fallback=Object.create(AutomaticVideoAlignment.prototype);fallback.project={};fallback.scene=()=>{throw Error('must not prepare heavy scene');};const record={key:'unknown',mapId:303};const value=fallback.mapInputScene(record,{skipBackground:true});assert.equal(value.automatic,null);assert.deepEqual(value.floors.instances,[]);assert.equal(value.floors.unsupported.length,1);assert.equal(fallback.mapInputScene(record,{skipBackground:true}),value);assert.equal(fallback.mapInputScenes.size,1);
 for(let i=0;i<8;i++)fallback.mapInputScene({key:'unknown-'+i,mapId:i},{skipBackground:true});assert.equal(fallback.mapInputScenes.size,4);
});
test('map-only UI state cannot request manual rendering with an absent scene',()=>{
 for(const file of ['preview.mjs','gpu-file-preview.mjs']){const source=readFileSync(new URL('../web/map-browser-preview/'+file,import.meta.url),'utf8');assert(source.includes("if(!automatic||!point||!$('floor').options.length"));}
});

test('unsupported floors and fixed display anchors remain separate from physical positions',async()=>{
 const missing=fixture();missing.floors.instances=[];missing.floors.unsupported=[{reason:'source floor unavailable'}];const r=await missing.alignment.search({input:missing.input,names:missing.names});assert.equal(r.located.length,0);assert.equal(r.diagnostics.mapCandidates[0].candidates[0].evidence.registration.resolved,true);assert.equal(r.diagnostics.mapCandidates[0].candidates[0].evidence.status,'floor-unresolved-or-multiple');assert.deepEqual(r.diagnostics.mapCandidates[0].candidates[0].evidence.primaryCandidate.floor.heightsFx,[]);
 const anchor=fixture(),image=anchor.alignment.referenceCache.image;anchor.alignment.referenceCache.image=path=>{const value=image(path);value.descriptor.groups=[{kind:'coordinate-map-id-list',mapIds:[101,202],x:-3.5,z:-7.5,callOffset:0}];return value;};const a=await anchor.alignment.search({input:anchor.input,names:anchor.names});assert.equal(a.located.length,0);assert.equal(a.unlocated.length,1);assert.equal(a.unlocated[0].evidence.world,null);assert.equal(a.unlocated[0].evidence.actorPositionKnown,false);assert.deepEqual(anchor.state.heavy,[]);
});
