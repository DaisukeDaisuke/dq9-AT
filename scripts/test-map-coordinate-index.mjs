import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildMapCoordinateIndex,descriptorPixelFrame,projectDisplayAnchor,coordinateDisplayOptions,mapCoordinateIndexCSV} from '../web/map-coordinate-index.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},ok=x=>{assert(x);checks++};
const descriptor={path:'town.bmmp',archive:'local.gp2',originTile:[-12,-16],worldToMapScale:4,groupOrder:'source-order-prepended',layers:[{id:0,path:'town.obg'}],placements:[{layerId:0,tileX:0,tileY:0}],groups:[{kind:'map-id-list',mapIds:[100],callOffset:16},{kind:'coordinate-map-id-list',mapIds:[103],x:5.1,z:19.92,callOffset:24}]};
const data={rom:{gameCode:'YDQJ'},descriptors:[descriptor],assets:[{path:'town.obg',archive:'local.gp2',info:{width:200,height:248}}],records:[{mapId:100,fieldCode:'town',candidates:[{path:'town.bmmp',relation:'field-code'}]},{mapId:103,fieldCode:'house',internalLabel:'house',candidates:[]},{mapId:999,fieldCode:'missing',candidates:[]}]};
const before=JSON.stringify(data),index=buildMapCoordinateIndex(data),row=index.rows.find(r=>r.mapId===103);
eq(index.summary,{relationships:2,fixedRelationships:1,physicalRelationships:1,unknownRelationships:0,mapIds:2,unresolvedMapIds:1});
eq(row.frame.originPixel,[-96,-128]);eq(row.displayAnchor.rawX,20889);eq(row.imagePoint.x,116.3994140625);eq(row.imagePoint.y,207.6796875);eq(row.imagePoint.transformVerified,false);eq(row.actorPositionKnown,false);eq(row.runtimeContextVerified,false);eq(row.imageRecognitionCandidate,false);eq(index.rows[0].imagePoint,null);eq(index.unresolved[0].mapId,999);eq(buildMapCoordinateIndex({...data,records:[...data.records,{mapId:0,candidates:[]}]}).unresolved.map(r=>r.mapId),[999,0]);
eq(coordinateDisplayOptions(data,data.records[1]),[{path:'town.bmmp',relation:'固定表示先（別の地図）'}]);eq(data.records[1].candidates,[]);eq(JSON.stringify(data),before);
const regional={...structuredClone(descriptor),path:'region.bmmp',originTile:[-16,-14],worldToMapScale:1,groups:[{kind:'coordinate-map-id-list',mapIds:[103],x:-32,z:5,callOffset:16}]};
const multi=buildMapCoordinateIndex({...data,descriptors:[descriptor,regional]});eq(multi.rows.filter(r=>r.mapId===103).map(r=>r.descriptor),['town.bmmp','region.bmmp']);eq(multi.rows.filter(r=>r.mapId===103).map(r=>r.imagePoint.x),[116.3994140625,96]);
const overlap={...descriptor,groups:[descriptor.groups[1],{kind:'map-id-list',mapIds:[103],callOffset:32}]};eq(buildMapCoordinateIndex({...data,descriptors:[overlap]}).rows[0].kind,'physical-xz');
const legacy=buildMapCoordinateIndex({...data,descriptors:[{...descriptor,groupOrder:undefined}]});ok(legacy.rows.every(r=>r.kind==='unknown'&&r.imagePoint===null));
const bad=buildMapCoordinateIndex({...data,assets:[]});eq(bad.rows[1].imagePoint,null);eq(bad.rows[1].displayAnchor.rawX,20889);eq(bad.rows[1].frame.status,'unavailable');
const cropped={...descriptor,placements:[{layerId:0,tileX:-2,tileY:3},{layerId:0,tileX:20,tileY:4}]},frame=descriptorPixelFrame(cropped,data.assets);eq(frame.originPixel,[-112,-104]);eq([frame.width,frame.height],[376,256]);
eq(projectDisplayAnchor({x:-999,z:0},row.frame).insideImage,false);eq(projectDisplayAnchor({x:NaN,z:0},row.frame),null);
eq(descriptorPixelFrame({...descriptor,worldToMapScale:0},data.assets).status,'unavailable');
assert.throws(()=>buildMapCoordinateIndex({...data,descriptors:[descriptor,descriptor]}));checks++;
assert.throws(()=>buildMapCoordinateIndex({...data,descriptors:[{...descriptor,groups:[{mapIds:[0]}]}]}));checks++;
const invalid={...data,descriptors:[{...descriptor,groups:[{mapIds:[0]}]}]};eq(coordinateDisplayOptions(invalid,data.records[0]),data.records[0].candidates);eq(coordinateDisplayOptions(invalid,data.records[0]),data.records[0].candidates);eq(coordinateDisplayOptions(invalid,data.records[1]),[]);
const csv=mapCoordinateIndexCSV(index);ok(csv.includes('"pixelX"'));ok(csv.includes('"103","town.bmmp","fixed-display-anchor"'));ok(csv.includes('"116.3994140625"'));ok(!csv.includes('NaN'));
let romChecks=0;
if(process.argv[2]){
 const {MapProject,MapRenderer}=await import('../web/map-core.mjs'),bytes=await fs.readFile(process.argv[2]),p=new MapProject(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),actual=buildMapCoordinateIndex(p.metadata());
 eq(actual.summary.fixedRelationships,888);eq(actual.summary.physicalRelationships,379);eq(actual.summary.unknownRelationships,0);eq(actual.rows.filter(r=>r.mapId===114).length,5);
 const a=actual.rows.find(r=>r.mapId===103&&r.descriptor==='C01.bmmp');eq([a.displayAnchor.rawX,a.displayAnchor.rawZ],[20889,81592]);eq([a.imagePoint.x,a.imagePoint.y],[116.3994140625,207.6796875]);
 const {instance}=await WebAssembly.instantiate(await fs.readFile(new URL('../web/wasm/map_render.wasm',import.meta.url)),{}),renderer=new MapRenderer(instance);
 for(const d of p.descriptors.values()){const image=renderer.compose(p,d.path),f=descriptorPixelFrame(d,[...p.assets.values()]);eq([f.width,f.height,...f.originPixel],[image.width,image.height,...image.originPixel]);romChecks++;}
 for(const r of actual.rows){eq(r.actorPositionKnown,false);eq(r.runtimeContextVerified,false);eq(r.frame.transformVerified,false);if(r.kind==='physical-xz')eq(r.imagePoint,null);}
 romChecks+=10;console.log(JSON.stringify({rom:actual.summary,allDescriptorFramesMatchRenderer:283,fixedAnchor103:a.imagePoint,fixtureScope:'Live local ROM parser plus all compositor frame comparisons; not runtime display calibration'}));
}
console.log(JSON.stringify({passed:true,checks,romChecks,scope:'All display contexts, source-order group selection, crop/scale, fixed vs physical guards, unknowns, no recognition-candidate mutation'}));
