import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {markerCoordinateBinding,mapMarkerCoordinateCandidate} from '../web/map-marker-coordinate.mjs';
import {factorPartyMapCandidates,materializePartyMapCandidate} from '../web/party-map-candidates.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},ok=a=>{assert(a);checks++};
const descriptor={path:'synthetic.bmmp',groupOrder:'source-order-prepended',groups:[{kind:'map-id-list',mapIds:[100],callOffset:16},{kind:'coordinate-map-id-list',mapIds:[103],x:5.1,z:19.92,callOffset:24}]};
const input={imageX:0,imageY:16,imageBounds:{left:-1/4096,right:1/4096,top:16-1/4096,bottom:16+1/4096},originPixel:[0,0],scale:1,mapId:100,markerIdentity:'unknown-party'};
const physical=markerCoordinateBinding(descriptor,100),fixed=markerCoordinateBinding(descriptor,103);
eq(physical.kind,'physical-xz-under-ordinary-group');eq(fixed.kind,'fixed-display-anchor');
const p=mapMarkerCoordinateCandidate(input,physical),h=mapMarkerCoordinateCandidate({...input,mapId:103},fixed);
eq(p.bounds.x.chunkIntervals.chunks.map(c=>c.chunkSigned16),[-1,0]);eq(p.bounds.z.chunkIntervals.chunks.map(c=>c.chunkSigned16),[0,1]);
eq(h.bounds,null);eq(h.actorCoordinateKnown,false);eq(h.kind,'fixed-map-display-anchor-candidate');ok(!('x' in h)&&!('z' in h));
for(const c of [p,h]){eq(c.minimumProvenATCalls,0);eq(c.automaticATConsumption,false);eq(c.heightYKnown,false);eq(c.unknownRuntimeContextPossible,true);}
eq(mapMarkerCoordinateCandidate(input,fixed).bounds,null);eq(mapMarkerCoordinateCandidate(input,null).bounds,null);
eq(markerCoordinateBinding(descriptor,999).kind,'unknown-marker-coordinate-binding');
for(const d of [null,{}, {...descriptor,groupOrder:null},{...descriptor,groups:[null]}, {...descriptor,groups:Array(1)}, {...descriptor,groups:Array(100000)}, {...descriptor,groups:[descriptor.groups[1],descriptor.groups[0]]}, {...descriptor,groups:[{...descriptor.groups[0],mapIds:Array(1)}]}, {...descriptor,groups:[{...descriptor.groups[0],kind:'unexpected'}]}, {...descriptor,groups:[{...descriptor.groups[0],mapIds:[65536]}]}, {...descriptor,groups:[{...descriptor.groups[0],mapIds:Array(256).fill(100)}]}, {...descriptor,groups:[{...descriptor.groups[1],x:NaN}]}, {...descriptor,groups:[{...descriptor.groups[1],z:524288}]}])eq(markerCoordinateBinding(d,100).kind,'unknown-marker-coordinate-binding');
for(const id of [null,undefined,0,-1,65536,1.5,'100'])eq(markerCoordinateBinding(descriptor,id).kind,'unknown-marker-coordinate-binding');
const overlap={...descriptor,groups:[descriptor.groups[0],{...descriptor.groups[1],mapIds:[100]}]};
eq(markerCoordinateBinding(overlap,100).kind,'fixed-display-anchor');eq(markerCoordinateBinding(overlap,100).matchingGroupCount,2);
eq(markerCoordinateBinding({...overlap,groups:[{...overlap.groups[1],callOffset:16},{...overlap.groups[0],callOffset:24}]},100).kind,'physical-xz-under-ordinary-group');
const stamp={frameSerial:1,streamId:'synthetic',generation:0,romEpoch:0,referenceEpoch:0,roi:{x:0,y:0,w:1,h:1},markerProfiles:[],profileTolerance:12};
const ranking={descriptor:descriptor.path,mapIds:[100,103,999],markerCoordinateBindings:[physical,fixed,markerCoordinateBinding(descriptor,999)],imageWidth:256,imageHeight:192,originPixel:[0,0],worldToMapScale:1,registration:{resolved:true,candidates:[{dx:0,dy:0,scale:1,score:.9}]}};
const factors=factorPartyMapCandidates({stamp,markerFrame:{width:256,height:192},registrationFrame:{width:256,height:192},markers:{frame:{width:256,height:192},candidates:[{id:'marker',x:0,y:16,profileId:'gray'}]},disambiguation:{stamp,rankings:[ranking],unknown:[{mapId:null,reason:'unsearched-font-hypotheses'}]}});
const row=materializePartyMapCandidate(factors,0,0);
eq(row.mapIds,[100,103,999]);eq(row.mapCoordinate,null);eq(row.mapCoordinateAlternatives.map(c=>c.kind),['approximate-map-coordinate-candidate','fixed-map-display-anchor-candidate','unknown-marker-coordinate-candidate']);
ok(row.mapCoordinateAlternatives[0].bounds.x);eq(row.mapCoordinateAlternatives[1].bounds,null);eq(row.mapCoordinateAlternatives[2].bounds,null);eq(factors.unknownMapHypotheses.length,1);eq(factors.mapIdentityCombinationCount,3);
for(const bindings of [[null],Array(1),{},[{...physical,mapId:103},fixed],[fixed,fixed]]){
 const bad=structuredClone(factors);bad.references[0].mapIds=[103];bad.references[0].markerCoordinateBindings=bindings;
 const result=materializePartyMapCandidate(bad,0,0);eq(result.mapCoordinate.kind,'unknown-marker-coordinate-candidate');eq(result.mapCoordinate.bounds,null);
}
// Import the real project parser only for the optional caller-supplied local ROM.
let romChecks=0;
if(process.argv[2]){
 const {MapProject}=await import('../web/map-core.mjs'),b=await fs.readFile(process.argv[2]),project=new MapProject(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const c01=project.descriptors.get('C01.bmmp'),a=markerCoordinateBinding(c01,100),bnd=markerCoordinateBinding(c01,103);
 eq(a.kind,'physical-xz-under-ordinary-group');eq(bnd.kind,'fixed-display-anchor');eq(bnd.groupCallOffset,164);eq([bnd.displayAnchor.rawX,bnd.displayAnchor.rawZ],[20889,81592]);
 for(const [name,id] of [['D04M02.bmmp',7402],['D09M01.bmmp',7901],['X04M07.bmmp',4407]])eq(markerCoordinateBinding(project.descriptors.get(name),id).kind,'physical-xz-under-ordinary-group');
 romChecks=7;
}
console.log(JSON.stringify({passed:true,checks,romChecks,scope:'Source-qualified ordinary map groups; fixed anchors never yield physical chunk bounds; no observed actor identity, height or AT inference'}));
