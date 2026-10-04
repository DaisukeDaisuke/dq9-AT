import {parseCalls,decodeNumber,readPoolString,u32} from './vendor/call-stream.mjs';
import {decodeNativeModel,decodeNativePlacement,deriveNativeWorld,makeNativeTrig} from './native/native-map-records.mjs';
import {nativeAsciiNameCandidates} from './native/native-file-name.mjs';
import {readNativeCol2} from './native-col2.mjs';
import {intersectNativeSegmentTriangle,intersectNativePlaneSegment} from './native-floor-candidate.mjs';
import {fxCross,fxDot} from './native/native-camera-fx.mjs';
export function loadRomFloorInstances(project,plan){
 const instances=[],unsupported=[],trig=makeNativeTrig(project.sdk.read(0x020e955c,16384),25736);
 for(const stream of plan.streams){
  try{const members=project.archive(stream.archive),bytes=members.get(stream.member),pool=u32(bytes,4),calls=parseCalls(bytes).map(c=>({...c,args:c.args.map(a=>({...a,value:a.type===0?readPoolString(bytes,pool,a):decodeNumber(a)}))}));
   const models=new Map(calls.filter(c=>c.opcode===0x6c).map(decodeNativeModel).map(m=>[m.id,m]));
   const placements=calls.filter(c=>c.opcode===0x6f).map(c=>decodeNativePlacement(c,4096)),world=deriveNativeWorld(placements,{rootPosition:stream.nativePositionFx,trig}),byId=new Map(placements.map(p=>[p.id,p]));
   const tiltedAncestor=p=>{for(let q=p;q;q=q.parentId>=0?byId.get(q.parentId):null)if(q.nativeRotation[0]||q.nativeRotation[2])return true;return false;};
   for(let i=0;i<placements.length;i++){const p=placements[i],m=models.get(p.modelId);if(!m||m.name[3]!=='A')continue;
    const key={archive:stream.archive,stream:stream.member,chunkId:stream.chunkId,placementId:p.id,modelId:p.modelId};
    if(tiltedAncestor(p)||world[i].yaw||world[i].scale.some(x=>x!==4096)){unsupported.push({...key,reason:'Collision scale/rotation transform not connected'});continue;}
    const name=m.name.replace(/\.[^.]*$/,'.col2'),matches=nativeAsciiNameCandidates([...members.keys()].map(name=>({name})),name);
    if(matches.length!==1){unsupported.push({...key,reason:'COL2 resource absent/ambiguous in mounted archive',requested:name});continue;}
    const col=readNativeCol2(members.get(matches[0].name));instances.push({...key,member:matches[0].name,positionFx:world[i].position,col});
   }
  }catch(e){unsupported.push({stream,reason:e.message});}
 }
 return {instances,unsupported};
}
export function floorHeightsAtXZ(floors,xFx,zFx){
 if(!Number.isInteger(xFx)||!Number.isInteger(zFx))throw Error('Fixed-point XZ required');
 const hits=[];
 for(const instance of floors.instances){const c=instance.col,scale=2**c.shift,origin=instance.positionFx;
  const start=[xFx-origin[0],c.bounds.max[1]*scale+1,zFx-origin[2]],end=[start[0],c.bounds.min[1]*scale-1,start[2]];
  for(const record of c.records){if(record.rawFlags&1||record.normalFx[1]<=0x800)continue;
   const vertices=record.verticesQuantized.map(v=>v.map(x=>x*scale));
   try{if(!intersectNativeSegmentTriangle(start,end,...vertices))continue;
    const [a,b,d]=vertices,normal=fxCross(b.map((x,i)=>x-a[i]),d.map((x,i)=>x-a[i])),hit=intersectNativePlaneSegment(start,end,normal,fxDot(normal,a));
    if(hit.accepted)hits.push({yFx:hit.pointFx[1]+origin[1],source:{archive:instance.archive,stream:instance.stream,chunkId:instance.chunkId,placementId:instance.placementId,member:instance.member,recordIndex:record.index,sourceOffset:record.sourceOffset},surfaceAttribute:record.surfaceAttribute});
   }catch(e){throw Error(instance.member+' floor query: '+e.message);}
  }
 }
 return {heightsFx:[...new Set(hits.map(h=>h.yFx))].sort((a,b)=>b-a),hits,unsupported:floors.unsupported,scope:'All static vertical COL2 intersections in supported instances. Not native actor floor selection, movement, current Y, visibility or AT proof. Multiple heights remain selectable alternatives.'};
}
