// ROM-local display-coordinate relationships. This is neither a traversal graph
// nor an interior actor -> exterior position transform.
import {markerCoordinateBinding} from './map-marker-coordinate.mjs';
const finite=Number.isFinite;
const fail=reason=>({status:'unavailable',reason,transformVerified:false});

/** Same crop and tile arithmetic as MapRenderer.compose; no image payload needed. */
export function descriptorPixelFrame(descriptor,assets){
 if(!descriptor||!Array.isArray(descriptor.placements)||!descriptor.placements.length||!Array.isArray(descriptor.layers))return fail('ordinary-image-layout-unavailable');
 if(!Array.isArray(descriptor.originTile)||descriptor.originTile.length!==2||!descriptor.originTile.every(Number.isInteger)||!finite(descriptor.worldToMapScale)||descriptor.worldToMapScale<=0)return fail('descriptor-transform-unavailable');
 const parts=[];
 for(const p of descriptor.placements){
  if(!p||![p.tileX,p.tileY].every(Number.isInteger))return fail('invalid-placement');
  const layers=descriptor.layers.filter(l=>l.id===p.layerId);if(layers.length!==1)return fail('ambiguous-or-missing-layer');
  const matches=assets.filter(a=>a.path===layers[0].path&&a.archive===descriptor.archive);if(matches.length!==1)return fail('ambiguous-or-missing-image');
  const info=matches[0].info;if(!info||![info.width,info.height].every(n=>Number.isInteger(n)&&n>0))return fail('image-dimensions-unavailable');
  parts.push({x:p.tileX*8,y:p.tileY*8,width:info.width,height:info.height});
 }
 const minX=Math.min(...parts.map(p=>p.x)),minY=Math.min(...parts.map(p=>p.y)),width=Math.max(...parts.map(p=>p.x+p.width))-minX,height=Math.max(...parts.map(p=>p.y+p.height))-minY;
 const originPixel=[descriptor.originTile[0]*8+minX,descriptor.originTile[1]*8+minY];
 if(![width,height,...originPixel].every(Number.isSafeInteger)||width<=0||height<=0||width*height>16000000)return fail('image-layout-outside-bounds');
 return {status:'provisional-descriptor-transform',width,height,originPixel,scale:descriptor.worldToMapScale,coordinateSpace:'composed-map-image-pixel-edges',formula:'pixelX = displayX * scale - originPixel[0]; pixelY = displayZ * scale - originPixel[1]',transformVerified:false,calibration:'not-independently-calibrated',gameHeightYKnown:false};
}

export function projectDisplayAnchor(anchor,frame){
 if(!anchor||frame?.status!=='provisional-descriptor-transform'||![anchor.x,anchor.z].every(finite))return null;
 const x=anchor.x*frame.scale-frame.originPixel[0],y=anchor.z*frame.scale-frame.originPixel[1];
 if(![x,y].every(finite))return null;
 return {x,y,insideImage:x>=0&&y>=0&&x<frame.width&&y<frame.height,coordinateSpace:frame.coordinateSpace,transformVerified:false,calibration:frame.calibration};
}

/** Input is fresh MapProject.metadata(). Preserve every display context, even
 * when it is deliberately absent from the image-recognition candidate list. */
export function buildMapCoordinateIndex(metadata){
 if(!metadata||!Array.isArray(metadata.records)||!Array.isArray(metadata.descriptors)||!Array.isArray(metadata.assets)||metadata.records.length>65536||metadata.descriptors.length>4096||metadata.assets.length>65536)throw Error('Bounded map metadata required');
 const rows=[],byId=new Map();
 for(const r of metadata.records){if(!r||!Number.isInteger(r.mapId)||r.mapId<0||r.mapId>65535)throw Error('Invalid map record');if(!byId.has(r.mapId))byId.set(r.mapId,[]);byId.get(r.mapId).push(r);}
 const paths=new Set();
 for(const d of metadata.descriptors){
  if(!d||typeof d.path!=='string'||paths.has(d.path)||!Array.isArray(d.groups)||d.groups.length>4096)throw Error('Invalid or duplicate descriptor');paths.add(d.path);
  const ids=new Set();for(const g of d.groups){if(!g||!Array.isArray(g.mapIds)||g.mapIds.length>255)throw Error('Invalid map group');for(const id of g.mapIds){if(!Number.isInteger(id)||id<1||id>65535)throw Error('Invalid map group ID');ids.add(id);}}
  const frame=descriptorPixelFrame(d,metadata.assets);
  for(const mapId of ids){
   if(rows.length>=65536)throw Error('Coordinate relationship budget exceeded');
   const records=byId.get(mapId)||[],binding=markerCoordinateBinding(d,mapId),kind=binding.kind==='fixed-display-anchor'?'fixed-display-anchor':binding.kind==='physical-xz-under-ordinary-group'?'physical-xz':'unknown';
   rows.push({mapId,descriptor:d.path,archive:d.archive??null,kind,mapRecords:records.map(r=>({fieldCode:r.fieldCode??null,name:r.name??null,internalLabel:r.internalLabel??null,source:r.source??null})),imageRecognitionCandidate:records.some(r=>(r.candidates||[]).some(c=>c.path===d.path)),source:{groupCallOffset:binding.groupCallOffset??null,selection:binding.selection??null,matchingGroupCount:binding.matchingGroupCount??null},binding,frame,displayAnchor:kind==='fixed-display-anchor'?structuredClone(binding.displayAnchor):null,imagePoint:kind==='fixed-display-anchor'?projectDisplayAnchor(binding.displayAnchor,frame):null,actorPositionKnown:false,runtimeContextVerified:false});
  }
 }
 const represented=new Set(rows.map(r=>r.mapId)),unresolved=[...byId].filter(([id])=>!represented.has(id)).map(([mapId,rs])=>({mapId,fieldCodes:rs.map(r=>r.fieldCode??null),reason:'no-explicit-bmmp-coordinate-group'}));
 return {format:'dq9-map-coordinate-index',version:1,rom:{gameCode:metadata.rom?.gameCode??null},scope:'Static BMMP display-coordinate contexts; multiple displays retained; not current-map identification, actor position or traversal proof',summary:{relationships:rows.length,fixedRelationships:rows.filter(r=>r.kind==='fixed-display-anchor').length,physicalRelationships:rows.filter(r=>r.kind==='physical-xz').length,unknownRelationships:rows.filter(r=>r.kind==='unknown').length,mapIds:represented.size,unresolvedMapIds:unresolved.length},rows,unresolved};
}
const cache=new WeakMap();
export function coordinateIndexFor(metadata){
 if(!cache.has(metadata)){try{cache.set(metadata,{index:buildMapCoordinateIndex(metadata)});}catch(error){cache.set(metadata,{error});}}
 const result=cache.get(metadata);if(result.error)throw result.error;return result.index;
}
export function coordinateDisplayOptions(metadata,record){
 const result=(record.candidates||[]).map(c=>({...c})),seen=new Set(result.map(c=>c.path));
 let index;try{index=coordinateIndexFor(metadata);}catch{return result;} // Optional panel failure must not break the original browser.
 for(const row of index.rows)if(row.mapId===record.mapId&&!seen.has(row.descriptor)){result.push({path:row.descriptor,relation:row.kind==='fixed-display-anchor'?'固定表示先（別の地図）':'座標グループ'});seen.add(row.descriptor);}
 return result;
}
export function mapCoordinateIndexCSV(index){
 const columns=['mapId','descriptor','kind','fieldCodes','internalLabels','displayX','displayZ','rawX','rawZ','pixelX','pixelY','insideImage','scale','originPixelX','originPixelY','groupCallOffset','transformVerified'];
 const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 const values=index.rows.map(r=>[r.mapId,r.descriptor,r.kind,r.mapRecords.map(m=>m.fieldCode).join('|'),r.mapRecords.map(m=>m.internalLabel).join('|'),r.displayAnchor?.x,r.displayAnchor?.z,r.displayAnchor?.rawX,r.displayAnchor?.rawZ,r.imagePoint?.x,r.imagePoint?.y,r.imagePoint?.insideImage,r.frame.scale,r.frame.originPixel?.[0],r.frame.originPixel?.[1],r.source.groupCallOffset,false]);
 return '\ufeff'+[columns,...values].map(row=>row.map(quote).join(',')).join('\r\n');
}
