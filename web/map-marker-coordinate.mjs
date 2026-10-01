import {imageToMapCoordinateCandidate} from './player-coordinate.mjs';

const u16 = n => Number.isInteger(n) && n > 0 && n <= 65535;
const finite = n => typeof n === 'number' && Number.isFinite(n);
const dense = (a,max=4096) => Array.isArray(a) && a.length<=max && Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const scope = {runtimeContextVerified:false,unknownRuntimeContextPossible:true,partyIdentityKnown:false,heightYKnown:false,automaticATConsumption:false,minimumProvenATCalls:0};

/** Static ordinary BMMP group selection only. Native groups are prepended and
 * the first matching runtime group wins (0201f4b4, 02026540). Visibility and
 * special/current-map modes are not established by an image match. */
export function markerCoordinateBinding(descriptor,mapId) {
 const unknown=reason=>({kind:'unknown-marker-coordinate-binding',mapId:u16(mapId)?mapId:null,reason,...scope});
 if(!u16(mapId))return unknown('map-id-unresolved');
 if(!descriptor||descriptor.groupOrder!=='source-order-prepended'||!dense(descriptor.groups))return unknown('complete-ordered-bmmp-groups-unavailable');
 let priorOffset=-1;
 for(const g of descriptor.groups){
  if(!g||!['map-id-list','coordinate-map-id-list'].includes(g.kind)||!dense(g.mapIds,255)||!g.mapIds.every(u16)||!Number.isSafeInteger(g.callOffset)||g.callOffset<=priorOffset)return unknown('invalid-bmmp-group');
  priorOffset=g.callOffset;
  if(g.kind==='coordinate-map-id-list'&&(!finite(g.x)||!finite(g.z)||![g.x,g.z].every(v=>Math.fround(v*4096)>=-2147483648&&Math.fround(v*4096)<=2147483647)))return unknown('invalid-display-anchor');
 }
 const matches=descriptor.groups.filter(g=>g.mapIds.includes(mapId)),g=matches.at(-1);
 if(!g)return unknown('no-explicit-map-group');
 const common={mapId,descriptor:descriptor.path??null,groupCallOffset:g.callOffset,matchingGroupCount:matches.length,selection:'last-source-group-first-runtime-match',conditionalOn:'ordinary BMMP group selection and applicable party marker',...scope};
 if(g.kind==='map-id-list')return {kind:'physical-xz-under-ordinary-group',...common};
 const rawX=Math.trunc(Math.fround(g.x*4096)),rawZ=Math.trunc(Math.fround(g.z*4096));
 return {kind:'fixed-display-anchor',...common,displayAnchor:{rawX,rawZ,x:rawX/4096,z:rawZ/4096,encoding:'signed32 fixed point /4096; display coordinates only'},actorCoordinateKnown:false};
}

/** A map-image alias must carry its own binding. Missing context never silently
 * inherits another alias's physical-coordinate interpretation. */
export function mapMarkerCoordinateCandidate(input,binding) {
 const mapId=u16(input?.mapId)?input.mapId:null;
 const common={mapId,markerIdentity:input?.markerIdentity??null,binding:binding??null,...scope};
 if(!binding||binding.mapId!==mapId||!u16(mapId))return {kind:'unknown-marker-coordinate-candidate',...common,reason:'map-binding-unavailable',bounds:null};
 if(binding.kind==='fixed-display-anchor')return {kind:'fixed-map-display-anchor-candidate',...common,displayAnchor:structuredClone(binding.displayAnchor),actorCoordinateKnown:false,bounds:null,reason:'marker-is-display-anchor-not-interior-position'};
 if(binding.kind!=='physical-xz-under-ordinary-group')return {kind:'unknown-marker-coordinate-candidate',...common,reason:binding.reason??'marker-coordinate-mode-unresolved',bounds:null};
 return {...imageToMapCoordinateCandidate(input),...common,markerMeaning:'physical-xz-under-ordinary-group',actorCoordinateKnown:false};
}

/** One map must have one explicit interpretation. A malformed or duplicated
 * binding packet is not permission to choose the first physical alternative. */
export function uniqueMarkerCoordinateBinding(bindings,mapId) {
 if(!u16(mapId)||!dense(bindings,16)||bindings.some(b=>!b||!u16(b.mapId)))return null;
 const matches=bindings.filter(b=>b.mapId===mapId);
 return matches.length===1?matches[0]:null;
}
