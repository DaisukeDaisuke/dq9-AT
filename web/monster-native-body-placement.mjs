/* Conditional placement from the actually emitted source GX polygons.
 * No video scale fit, template box, model-ID rule, or ROI-bottom foot anchor.
 * This adds a hypothesis; it does not invalidate the decoded-envelope path.
 */
import {projectNativeBodyPolygons} from './monster-native-body.mjs?v=recognition-20261008-7cf64cf4';
import {createNativeBodyBillboardState} from './monster-native-billboard.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};
function billboard(program,profile){
 if(!program.billboardSource)return null;
 need(profile?.kind==='conditional-ordinary-ROM-initial-templates','Explicit conditional native billboard profile required');
 return createNativeBodyBillboardState(program.billboardSource,{globalFlags:profile.globalFlags,contextFlags:profile.contextFlags,callbackOverride:profile.callbackOverride,templates:program.billboardSource.initialTemplates});
}
function project(envelope,positionFx){return projectNativeBodyPolygons(envelope.program,{...envelope.nativeInput,positionFx,billboardState:billboard(envelope.program,envelope.billboardProfile)});}
/** Native model-view replay includes source scale/yaw, stored pose, node mix,
 * and billboard operations. Hidden NNS materials and invisible SBC draws are
 * omitted by that replay. A native root-response affine model supplies the
 * continuous translation seed, not a replacement raster or exact emulation
 * of FX translation quantization.
 * Root response is obtained from native replay at the three unit basis roots.
 * Per-vertex responses retain non-normalized NODEMIX weights without treating
 * them as one. This is an affine seed, not exact FX interpolation. */
export function prepareNativeBodyEnvelope(program,{camera,actorScaleFx,yawFx,animation=null,frame=null,jointPlan=null,alignment,billboardProfile=null}){
 need(Number.isInteger(alignment?.dx)&&Number.isInteger(alignment?.dy),'Frozen native integer alignment required');
 const view=camera?.viewFx?.map(x=>x/4096),projection=camera?.projectionFx?.map(x=>x/4096);
 need(view?.length===16&&view[3]===0&&view[7]===0&&view[11]===0&&view[15]===1,'Native affine camera view required');
 const envelope={kind:'conditional-native-emitted-body-envelope',program,nativeInput:{camera,actorScaleFx,yawFx,animation,frame,...(jointPlan?{jointPlan}:{})},billboardProfile,alignment:{...alignment}},native=project(envelope,[0,0,0]),base=native.polygons.flatMap(p=>p.vertices),basis=[0,1,2].map(k=>project(envelope,[0,1,2].map(j=>j===k?4096:0)).polygons.flatMap(p=>p.vertices)),unique=new Map();
 need(basis.every(b=>b.length===base.length),'Source root changes emitted vertex topology');
 const transform=(m,v)=>[0,1,2,3].map(r=>v.reduce((s,x,c)=>s+x*m[c*4+r],0));
 for(let i=0;i<base.length;i++){const cameraFx=base[i].cameraFx,response=basis.map(b=>b[i].cameraFx.map((x,k)=>(x-cameraFx[k])/4096)),clipBase=transform(projection,cameraFx.map(x=>x/4096)),clipResponse=response.map(v=>transform(projection,v));unique.set(JSON.stringify([cameraFx,response]),{cameraFx,clipBase,clipResponse});}
 need(unique.size>0,'No source-emitted body vertices; no complete-envelope placement');
 return {...envelope,seedVertices:[...unique.values()].map(({clipBase,clipResponse})=>({clipBase,clipResponse})),sourceTranslationUnitFx:4096,width:256,height:192,geometrySource:{kind:'source-native-emitted-polygons',originalPolygons:native.polygons.length,uniqueEmittedVertices:unique.size,hiddenMaterialIndices:program.materials.filter(m=>m.effective.hideShapes).map(m=>m.index),unusedDecodedVerticesExcluded:true},scope:'Complete source-emitted polygon envelope, not texture-alpha silhouette or occlusion-complete visible body.'};
}
export function nativeProjectedBodyEnvelope(projected,alignment){
 const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
 for(const p of projected.polygons)for(const v of p.vertices){const q=v.clipFx;if(!(q[3]>0))return {ready:false,reason:'native-body-crosses-eye-plane'};const point=[(q[0]/q[3]+1)*128+alignment.dx,(1-q[1]/q[3])*96+alignment.dy];for(let k=0;k<2;k++){min[k]=Math.min(min[k],point[k]);max[k]=Math.max(max[k],point[k]);}}
 if(!min.every(Number.isFinite))return {ready:false,reason:'no-native-emitted-vertices'};
 return {ready:true,roi:{x:min[0],y:min[1],w:max[0]-min[0],h:max[1]-min[1]},center:[(min[0]+max[0])/2,(min[1]+max[1])/2]};
}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function solve3(a,b){const d=dot(a[0],cross(a[1],a[2]));if(!Number.isFinite(d)||Math.abs(d)<64*Number.EPSILON)return null;const c=[cross(a[1],a[2]),cross(a[2],a[0]),cross(a[0],a[1])];return[0,1,2].map(i=>c.reduce((s,r,k)=>s+r[i]*b[k],0)/d);}
function insideXZ(p,t){const f=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),area=f(...t);if(!area)return false;const u=f(t[1],t[2],p)/area,v=f(t[2],t[0],p)/area;return Math.min(u,v,1-u-v)>=-64*Number.EPSILON;}
function extrema(envelope,position){const e=[null,null,null,null];for(const v of envelope.seedVertices){const clip=v.clipBase.map((x,k)=>x+v.clipResponse.reduce((s,r,c)=>s+r[k]*position[c],0));if(!(clip[3]>0))return null;for(let k=0;k<2;k++){const value=clip[k]/clip[3],p={value,clip,response:v.clipResponse};if(!e[2*k]||value<e[2*k].value)e[2*k]=p;if(!e[2*k+1]||value>e[2*k+1].value)e[2*k+1]=p;}}return e;}
function solveEmittedEnvelope(envelope,region,floorPlan,{maxIterations=16,anchor=null}={}){
 const q=region.roi;need(q&&[q.x,q.y,q.w,q.h].every(Number.isFinite)&&q.w>0&&q.h>0,'Explicit residual bounds required');need(Array.isArray(floorPlan?.planes),'Explicit source floor planes required');need(Number.isSafeInteger(maxIterations)&&maxIterations>0&&maxIterations<=256,'Bounded source envelope solve required');
 const target=anchor?.target??[2*(q.x+q.w/2-envelope.alignment.dx)/256-1,1-2*(q.y+q.h/2-envelope.alignment.dy)/192],selected=anchor?.extrema??[[0,1],[2,3]],average={clipBase:[0,0,0,0],clipResponse:Array.from({length:3},()=>[0,0,0,0])};
 for(const v of envelope.seedVertices)for(let k=0;k<4;k++){average.clipBase[k]+=v.clipBase[k]/envelope.seedVertices.length;for(let c=0;c<3;c++)average.clipResponse[c][k]+=v.clipResponse[c][k]/envelope.seedVertices.length;}
 const placements=[],unresolved=[];let noIntersection=0;
 for(const plane of floorPlan.planes){const a=[0,1].map(k=>average.clipResponse.map(r=>r[k]-target[k]*r[3])),b=[0,1].map(k=>-(average.clipBase[k]-target[k]*average.clipBase[3]));let position=solve3([...a,plane.normal],[...b,plane.constant]);if(!position){unresolved.push({plane:plane.key,reason:'singular-native-center-ray-plane'});continue;}let converged=false,iterations=0,error=null;
  for(;iterations<maxIterations;iterations++){const e=extrema(envelope,position);if(!e){error='native-seed-crosses-eye-plane';break;}const residual=[0,1].map(k=>(anchor?selected[k].reduce((sum,i)=>sum+e[i].value,0)/selected[k].length:(e[2*k].value+e[2*k+1].value)/2)-target[k]);if(Math.max(...residual.map(Math.abs))<=256*Number.EPSILON){converged=true;break;}const jac=[0,1].map(k=>[0,1,2].map(c=>(anchor?selected[k].map(i=>e[i]):[e[2*k],e[2*k+1]]).reduce((sum,p)=>sum+(p.response[c][k]*p.clip[3]-p.clip[k]*p.response[c][3])/(p.clip[3]**2),0)/(anchor?selected[k].length:2))),delta=solve3([...jac,plane.normal],[-residual[0],-residual[1],plane.constant-dot(plane.normal,position)]);if(!delta||!delta.every(Number.isFinite)){error='singular-native-envelope-center';break;}position=position.map((x,k)=>x+delta[k]);}
  if(!converged){unresolved.push({plane:plane.key,reason:error??'native-center-solve-budget',iterations});continue;}const faces=plane.triangles.filter(t=>insideXZ(position,t.vertices));if(!faces.length){noIntersection++;continue;}const e=extrema(envelope,position),geometryROI={x:(e[0].value+1)*128+envelope.alignment.dx,y:(1-e[3].value)*96+envelope.alignment.dy,w:(e[1].value-e[0].value)*128,h:(e[3].value-e[2].value)*96};placements.push({position,planeKey:plane.key,faces:faces.map(t=>({source:t.source,surfaceAttribute:t.surfaceAttribute})),geometryROI,iterations,originOnFloorAssumed:true,completeGeometryCenterAssumed:true});
 }
 return {placements,unresolved,noIntersection,sourcePlaneCount:floorPlan.planes.length,unknownPlacementPossible:true,clippedOrOccludedBodyPossible:true,poseYawCoverageComplete:false,complete:false};
}
/** Each continuous solve is verified again with an actual native FX root.
 * The exact native envelope/center error and floor quantization error are
 * reported rather than silently declaring the continuous seed exact. */
export function placeNativeBodyEnvelopeOnFloors(envelope,region,floorPlan,options){
 need(envelope?.kind==='conditional-native-emitted-body-envelope','Prepared native source envelope required');
 const solved=solveEmittedEnvelope(envelope,region,floorPlan,options),placements=[],unresolved=solved.unresolved.slice(),target=[region.roi.x+region.roi.w/2,region.roi.y+region.roi.h/2];
 for(const seed of solved.placements){const positionFx=seed.position.map(x=>Math.round(x*4096));try{const native=project(envelope,positionFx),actual=nativeProjectedBodyEnvelope(native,envelope.alignment);if(!actual.ready){unresolved.push({plane:seed.planeKey,reason:actual.reason});continue;}const plane=floorPlan.planes.find(p=>p.key===seed.planeKey);placements.push({...seed,positionFx,geometryROI:actual.roi,continuousSeedGeometryROI:seed.geometryROI,placementKind:'conditional-native-emitted-envelope',completeGeometryCenterAssumed:true,sourceEmittedEnvelopeCenterAssumed:true,nativeCenterResidualPixels:actual.center.map((x,k)=>x-target[k]),quantizedRootFloorResidualFx:plane.normal.reduce((n,x,k)=>n+x*positionFx[k],0)-plane.constant*4096,nativeCenterSolvedExactly:false,geometrySource:structuredClone(envelope.geometrySource)});}catch(error){unresolved.push({plane:seed.planeKey,reason:error.message});}}
 return {...solved,placements,unresolved,complete:false,minimumProvenATCalls:0,identityCertified:false,scope:'Additional source-native-emitted-envelope seed on source floor. Exact FX reprojection reported; root, complete envelope, visibility and floor selection remain conditional.'};
}

/** The observation is the intersection of the translated native viewport and
 * the output viewport. Only exact rectangle boundaries propose clipping;
 * holes in a known/unknown mask never become pretend image boundaries.
 * An edge of the geometric envelope is a conditional image anchor, not feet.
 */
export function nativeBoundaryPlacementAnchor(envelope,region){
 const {dx,dy}=envelope.alignment,q=region.roi;
 need(Number.isInteger(dx)&&Number.isInteger(dy)&&q&&[q.x,q.y,q.w,q.h].every(Number.isFinite)&&q.w>0&&q.h>0,'Exact alignment and explicit residual bounds required');
 const viewport={left:Math.max(0,dx),right:Math.min(256,256+dx),top:Math.max(0,dy),bottom:Math.min(192,192+dy)};
 if(viewport.left>=viewport.right||viewport.top>=viewport.bottom)return{ready:false,reason:'empty-aligned-observation-viewport'};
 if(q.x<viewport.left||q.y<viewport.top||q.x+q.w>viewport.right||q.y+q.h>viewport.bottom)return{ready:false,reason:'residual-outside-aligned-observation-viewport'};
 const edges={left:q.x===viewport.left,right:q.x+q.w===viewport.right,top:q.y===viewport.top,bottom:q.y+q.h===viewport.bottom};
 if(!Object.values(edges).some(Boolean))return{ready:false,reason:'residual-does-not-touch-observation-boundary'};
 if(edges.left&&edges.right||edges.top&&edges.bottom)return{ready:false,reason:'opposite-boundaries-leave-native-envelope-anchor-underdetermined',viewport,clippedEdges:Object.keys(edges).filter(k=>edges[k])};
 const screenTarget=[edges.left?q.x+q.w:edges.right?q.x:q.x+q.w/2,edges.top?q.y+q.h:edges.bottom?q.y:q.y+q.h/2];
 return{ready:true,kind:'conditional-source-native-viewport-boundary-anchor',viewport,clippedEdges:Object.keys(edges).filter(k=>edges[k]),screenTarget,target:[2*(screenTarget[0]-dx)/256-1,1-2*(screenTarget[1]-dy)/192],extrema:[edges.left?[1]:edges.right?[0]:[0,1],edges.top?[2]:edges.bottom?[3]:[2,3]],completeGeometryCenterAssumed:false,observedClippingCertified:false};
}
/** Additional root-on-COL2 alternatives for residuals meeting a true viewport
 * boundary. Keep complete-center placement separately and reproject every root
 * with the original native renderer. Pose, scale, floor, scoring and unknown
 * destination/order/depth admission are never changed by this proposal step. */
export function placeNativeBodyBoundaryEnvelopeOnFloors(envelope,region,floorPlan,options){
 need(envelope?.kind==='conditional-native-emitted-body-envelope','Prepared native source envelope required');
 const anchor=nativeBoundaryPlacementAnchor(envelope,region);
 if(!anchor.ready)return{placements:[],unresolved:anchor.reason==='residual-does-not-touch-observation-boundary'?[]:[{reason:anchor.reason}],sourcePlaneCount:floorPlan.planes.length,complete:false,unknownPlacementPossible:true};
 const solved=solveEmittedEnvelope(envelope,region,floorPlan,{...options,anchor}),placements=[],unresolved=solved.unresolved.slice();
 for(const seed of solved.placements){const positionFx=seed.position.map(x=>Math.round(x*4096));try{
  const actual=nativeProjectedBodyEnvelope(project(envelope,positionFx),envelope.alignment);
  if(!actual.ready){unresolved.push({plane:seed.planeKey,reason:actual.reason});continue;}
  const q=actual.roi,v=anchor.viewport,crosses={left:q.x<=v.left,right:q.x+q.w>=v.right,top:q.y<=v.top,bottom:q.y+q.h>=v.bottom};
  if(!anchor.clippedEdges.every(k=>crosses[k])){unresolved.push({plane:seed.planeKey,reason:'native-envelope-does-not-cross-requested-viewport-boundary',clippedEdges:anchor.clippedEdges,geometryROI:q});continue;}
  const plane=floorPlan.planes.find(p=>p.key===seed.planeKey),actualAnchor=[anchor.clippedEdges.includes('left')?q.x+q.w:anchor.clippedEdges.includes('right')?q.x:actual.center[0],anchor.clippedEdges.includes('top')?q.y+q.h:anchor.clippedEdges.includes('bottom')?q.y:actual.center[1]];
  placements.push({...seed,positionFx,geometryROI:q,continuousSeedGeometryROI:seed.geometryROI,placementKind:'conditional-native-boundary-envelope',completeGeometryCenterAssumed:false,sourceEmittedEnvelopeCenterAssumed:false,sourceBoundaryEnvelopeAssumed:true,boundaryAnchor:structuredClone(anchor),nativeBoundaryResidualPixels:actualAnchor.map((x,k)=>x-anchor.screenTarget[k]),quantizedRootFloorResidualFx:plane.normal.reduce((n,x,k)=>n+x*positionFx[k],0)-plane.constant*4096,nativeCenterSolvedExactly:false,geometrySource:structuredClone(envelope.geometrySource)});
 }catch(error){unresolved.push({plane:seed.planeKey,reason:error.message});}}
 return{...solved,placements,unresolved,complete:false,minimumProvenATCalls:0,identityCertified:false,scope:'Additional source-native envelope edge/center placement at an exact translated viewport boundary. Full geometry, native root and renderer gates retained; silhouette, observed clipping, current pose and floor selection remain unknown.'};
}
