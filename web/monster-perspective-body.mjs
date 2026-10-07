import{nativeOriginalProposalAttribution}from'./monster-native-proposal-support.mjs?v=native-scene-link-20261007-0354';
// Isolated continuous source-geometry diagnostic. Not imported by recognition.
// No template normalization, pixel rescaling, species gate, or AT evidence.
import {orientMonsterVertices} from './monster-render-state.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0), sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const multiply4=(a,b)=>Array.from({length:16},(_,i)=>{let s=0;for(let k=0;k<4;k++)s+=a[k*4+i%4]*b[(i>>2)*4+k];return s;});
const transform=(m,v)=>[0,1,2,3].map(r=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]);
const row=(m,r)=>[m[r],m[4+r],m[8+r]];
function solve3(a,b){const d=dot(a[0],cross(a[1],a[2]));if(!Number.isFinite(d)||Math.abs(d)<Number.EPSILON*64)return null;const c=[cross(a[1],a[2]),cross(a[2],a[0]),cross(a[0],a[1])];return [0,1,2].map(i=>c.reduce((s,r,k)=>s+r[i]*b[k],0)/d);}
function insideTriangleXZ(p,t){const a=[t[0][0],t[0][2]],b=[t[1][0],t[1][2]],c=[t[2][0],t[2][2]],q=[p[0],p[2]],f=(a,b,q)=>(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]),area=f(a,b,c);if(!area)return false;const u=f(b,c,q)/area,v=f(c,a,q)/area,w=1-u-v;return Math.min(u,v,w)>=-64*Number.EPSILON;}
function gcd(a,b){a=a<0n?-a:a;b=b<0n?-b:b;while(b){const c=a%b;a=b;b=c;}return a;}
/** All supported static floor triangles are retained; coplanar faces share one
 * solve, then membership is tested against each actual triangle, never its AABB.
 * The source floor eligibility predicate matches floorHeightsAtXZ. */
export function sourceFloorPlanes(floors){
 need(Array.isArray(floors?.instances),'Explicit ROM COL2 instances required');const groups=new Map();let records=0;
 for(const instance of floors.instances){const scale=2**instance.col.shift;
  for(const record of instance.col.records){if(record.rawFlags&1||record.normalFx[1]<=0x800)continue;records++;
   const fx=record.verticesQuantized.map(v=>v.map((x,i)=>x*scale+instance.positionFx[i])),a=fx[0].map(BigInt),u=fx[1].map((x,i)=>BigInt(x)-a[i]),v=fx[2].map((x,i)=>BigInt(x)-a[i]);
   let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=n.reduce((s,x,i)=>s+x*a[i],0n),g=[...n,d].reduce(gcd,0n);if(!g)continue;if(n[1]<0n)g=-g;n=n.map(x=>x/g);d/=g;need([...n,d].every(x=>x>=BigInt(Number.MIN_SAFE_INTEGER)&&x<=BigInt(Number.MAX_SAFE_INTEGER)),'COL2 plane exceeds exact integer presentation subset');const key=[...n,d].join(',');
   if(!groups.has(key))groups.set(key,{key,normal:n.map(Number),constant:Number(d)/4096,triangles:[]});
   groups.get(key).triangles.push({vertices:fx.map(v=>v.map(x=>x/4096)),source:{archive:instance.archive,stream:instance.stream,chunkId:instance.chunkId,placementId:instance.placementId,member:instance.member,recordIndex:record.index,sourceOffset:record.sourceOffset},surfaceAttribute:record.surfaceAttribute});
  }
 }
 return {planes:[...groups.values()],eligibleRecords:records,unsupported:structuredClone(floors.unsupported??[]),complete:false,scope:'Supported static positive-floor faces only. Dynamic/rotated/scaled instances and actor floor selection remain unknown.'};
}
export function preparePerspectiveBody(model,{camera,actorScaleFx,actorYaw,width=256,height=192,alignment}){
 need([camera?.viewFx,camera?.projectionFx].every(m=>Array.isArray(m)&&m.length===16&&m.every(Number.isInteger)),'Exact frozen FX32 camera hypothesis required');
 need(Number.isInteger(actorScaleFx)&&actorScaleFx>0&&actorScaleFx<=32767&&Number.isFinite(actorYaw),'Explicit positive source scale and actor yaw required');
 need(Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width*height<=49152,'Native bounded viewport required');
 need(Number.isFinite(alignment?.dx)&&Number.isFinite(alignment?.dy),'Exact frozen alignment required');
 need(model?.vertices?.length>0&&model.vertices.length%11===0&&model.vertices.length<=40000*11&&model.indices?.length<=60000&&model.vertices.every(Number.isFinite),'Bounded finite decoded source model required');
 const view=camera.viewFx.map(x=>x/4096),projection=camera.projectionFx.map(x=>x/4096),s=actorScaleFx/4096,c=Math.cos(actorYaw),t=Math.sin(actorYaw),rotation=[c,0,-t,0,0,1,0,0,t,0,c,0,0,0,0,1],relative=multiply4(view,rotation);
 // Existing billboard expression evaluator supports pitch/yaw cameras only.
 need(Math.abs(relative[4])<1/4096&&Math.abs(relative[1]-Math.sin(Math.atan2(relative[6],relative[5]))*Math.sin(Math.atan2(relative[8],relative[0])))<1/1024,'Roll/shear billboard camera unsupported');
 const billboardView={yaw:Math.atan2(relative[8],relative[0]),pitch:Math.atan2(relative[6],relative[5])},v=orientMonsterVertices(model,billboardView),vertices=v.slice(),bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(let i=0;i<v.length;i+=11){const x=v[i]*s,y=v[i+1]*s,z=v[i+2]*s;vertices[i]=c*x+t*z;vertices[i+1]=y;vertices[i+2]=-t*x+c*z;for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],vertices[i+k]);bounds.max[k]=Math.max(bounds.max[k],vertices[i+k]);}}
 return {model,vertices,bounds,view,projection,worldToClip:multiply4(projection,view),width,height,alignment:{...alignment},actorScaleFx,actorYaw,billboardView};
}
function extrema(prepared,translation){const m=prepared.worldToClip,e=[null,null,null,null];for(let i=0;i<prepared.vertices.length;i+=11){const p=[0,1,2].map(k=>prepared.vertices[i+k]+translation[k]),q=transform(m,p);if(!(q[3]>0))return null;const x=q[0]/q[3],y=q[1]/q[3],vertex={position:p,clip:q};if(!e[0]||x<e[0].value)e[0]={...vertex,value:x};if(!e[1]||x>e[1].value)e[1]={...vertex,value:x};if(!e[2]||y<e[2].value)e[2]={...vertex,value:y};if(!e[3]||y>e[3].value)e[3]={...vertex,value:y};}return e;}
/** Conditional complete-geometric-envelope placement. ROI center is the center
 * of the complete projected source geometry; ROI bottom is never a foot.
 * Source root lies on a source COL2 face. These two assumptions are reported,
 * never elevated to physical presence or a rejection of other placements. */
export function placeCompleteBodyOnFloors(prepared,region,floorPlan,{maxIterations=16}={}){
 const q=region.roi,{width,height,alignment,worldToClip:m}=prepared;need(q&&[q.x,q.y,q.w,q.h].every(Number.isFinite)&&q.w>0&&q.h>0,'Explicit residual bounds required');
 const target=[2*(q.x+q.w/2-alignment.dx)/width-1,1-2*(q.y+q.h/2-alignment.dy)/height],anchor=prepared.bounds.min.map((x,k)=>(x+prepared.bounds.max[k])/2),placements=[],unresolved=[];let noIntersection=0;
 for(const plane of floorPlan.planes){const equations=[0,1].map(k=>row(m,k).map((x,i)=>x-target[k]*row(m,3)[i])),rhs=equations.map((r,k)=>-(dot(r,anchor)+m[12+k]-target[k]*m[15]));let position=solve3([...equations,plane.normal],[...rhs,plane.constant]);if(!position){unresolved.push({plane:plane.key,reason:'singular-center-ray-plane'});continue;}
  let converged=false,iterations=0,error=null;
  for(;iterations<maxIterations;iterations++){const e=extrema(prepared,position);if(!e){error='body-crosses-eye-plane';break;}const residual=[(e[0].value+e[1].value)/2-target[0],(e[2].value+e[3].value)/2-target[1]],norm=Math.max(...residual.map(Math.abs));if(norm<=256*Number.EPSILON){converged=true;break;}
   const jac=[0,1].map(k=>[0,1,2].map(c=>[e[k*2],e[k*2+1]].reduce((sum,p)=>sum+(m[c*4+k]*p.clip[3]-p.clip[k]*m[c*4+3])/(p.clip[3]**2),0)/2));const delta=solve3([...jac,plane.normal],[-residual[0],-residual[1],plane.constant-dot(plane.normal,position)]);if(!delta||delta.some(x=>!Number.isFinite(x))){error='singular-envelope-center';break;}position=position.map((x,k)=>x+delta[k]);
  }
  if(!converged){unresolved.push({plane:plane.key,reason:error??'center-solve-budget',iterations});continue;}
  const faces=plane.triangles.filter(t=>insideTriangleXZ(position,t.vertices));if(!faces.length){noIntersection++;continue;}const e=extrema(prepared,position),box={x:(e[0].value+1)*width/2+alignment.dx,y:(1-e[3].value)*height/2+alignment.dy,w:(e[1].value-e[0].value)*width/2,h:(e[3].value-e[2].value)*height/2};placements.push({position,planeKey:plane.key,faces:faces.map(t=>({source:t.source,surfaceAttribute:t.surfaceAttribute})),geometryROI:box,iterations,originOnFloorAssumed:true,completeGeometryCenterAssumed:true});
 }
 return {placements,unresolved,noIntersection,sourcePlaneCount:floorPlan.planes.length,unknownPlacementPossible:true,clippedOrOccludedBodyPossible:true,poseYawCoverageComplete:false,complete:false,scope:'Only complete geometric-envelope center and root-on-supported-floor hypotheses. No body extent, feet, presence, species or absence certification.'};
}
const edge=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
function clippedPolygon(vertices){let out=vertices;for(const signedDistance of [v=>v[3]+v[0],v=>v[3]-v[0],v=>v[3]+v[1],v=>v[3]-v[1],v=>v[3]+v[2],v=>v[3]-v[2]]){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],da=signedDistance(a),db=signedDistance(b);if(da>=0)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((x,k)=>x+(b[k]-x)*t));}}if(!out.length)break;}return out;}
/** Perspective-correct continuous CPU raster. Source geometry/materials,
 * source scale and actual frozen camera, but NOT DS-native raster parity.
 * No scene occlusion is silently inferred from fog/translucent depth. */
export function renderPerspectiveBody(prepared,placement,{shadePixel=null}={}){
 const {model,vertices:v,worldToClip:m,width:W,height:H,alignment}=prepared,N=W*H,rgba=new Uint8ClampedArray(N*4),depth=new Float64Array(N).fill(Infinity),fragmentDepth=new Float64Array(N).fill(Infinity),indices=model.indices,clip=[];let clippedTriangles=0,triangles=0;
 for(let i=0;i<v.length;i+=11){const p=[0,1,2].map(k=>v[i+k]+placement.position[k]),q=transform(m,p);clip.push([...q,...v.slice(i+3,i+8)]);}
 const calls=model.drawCalls.slice().map(call=>({call,z:call.indexCount?Array.from(indices.subarray(call.firstIndex,call.firstIndex+call.indexCount)).reduce((s,id)=>{const i=id*11;return s+transform(prepared.view,[0,1,2].map(k=>v[i+k]+placement.position[k]))[2];},0)/call.indexCount:0})).sort((a,b)=>Number(model.materials[a.call.materialId].translucent)-Number(model.materials[b.call.materialId].translucent)||(model.materials[a.call.materialId].translucent?a.z-b.z:0));
 for(const {call} of calls){const mat=model.materials[call.materialId];if(mat.wireframe)need(model.edgeMasks?.length===indices.length/3,'Source polygon wireframe boundaries required');for(let i=call.firstIndex;i<call.firstIndex+call.indexCount;i+=3){const raw=[clip[indices[i]],clip[indices[i+1]],clip[indices[i+2]]],poly=clippedPolygon(raw);const clipped=poly.length!==3||raw.some(p=>p.slice(0,3).some(x=>Math.abs(x)>p[3]));if(clipped)clippedTriangles++;if(!poly.length)continue;if(mat.wireframe&&clipped)throw Error('Clipped wireframe boundary unsupported');for(let k=1;k+1<poly.length;k++){const ps=[poly[0],poly[k],poly[k+1]].map(v=>[(v[0]/v[3]+1)*W/2+alignment.dx,(1-v[1]/v[3])*H/2+alignment.dy,v[2]/v[3],1/v[3],...v.slice(4).map(x=>x/v[3])]),[a,b,c]=ps,area=edge(a,b,c[0],c[1]);if(!area||(mat.cullBack&&area>=0)||(mat.cullFront&&area<0))continue;triangles++;
  const lx=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),hx=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),ly=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),hy=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  for(let y=ly;y<=hy;y++)for(let x=lx;x<=hx;x++){const wa=edge(b,c,x+.5,y+.5)/area,wb=edge(c,a,x+.5,y+.5)/area,wc=1-wa-wb;if(wa<0||wb<0||wc<0)continue;if(mat.wireframe){const mask=model.edgeMasks[i/3],distance=Math.min(mask&1?wa*Math.abs(area)/Math.hypot(c[0]-b[0],c[1]-b[1]):Infinity,mask&2?wb*Math.abs(area)/Math.hypot(a[0]-c[0],a[1]-c[1]):Infinity,mask&4?wc*Math.abs(area)/Math.hypot(b[0]-a[0],b[1]-a[1]):Infinity);if(distance>1)continue;}const q=y*W+x,z=(wa*a[2]+wb*b[2]+wc*c[2]+1)/2;if(z>=depth[q])continue;const inverseW=wa*a[3]+wb*b[3]+wc*c[3],f=k=>(wa*a[k]+wb*b[k]+wc*c[k])/inverseW,coord=(u,n,axis)=>{const repeat=mat.textureParams&(1<<(16+axis)),mirror=mat.textureParams&(1<<(18+axis));if(repeat){if(mirror){u=((u%2)+2)%2;if(u>1)u=2-u;}else u=((u%1)+1)%1;}return Math.max(0,Math.min(n-1,Math.floor(u*n)));},texel=(coord(f(5),mat.height,1)*mat.width+coord(f(4),mat.width,0))*4,alpha=mat.rgba[texel+3]/255;if(!alpha)continue;let color=[0,1,2].map(k=>Math.max(0,Math.min(255,mat.rgba[texel+k]*f(6+k))));if(shadePixel)color=shadePixel({rgb:color,alpha,depth01:z,materialId:call.materialId});const old=rgba[q*4+3]/255,out=alpha+old*(1-alpha);for(let k=0;k<3;k++)rgba[q*4+k]=Math.round((color[k]*alpha+rgba[q*4+k]*old*(1-alpha))/out);rgba[q*4+3]=Math.round(out*255);fragmentDepth[q]=z;if(!mat.translucent||mat.depthWriteTranslucent)depth[q]=z;
  }
 }}}
 return {width:W,height:H,rgba,fragmentDepth,triangles,clippedTriangles,raster:'continuous-perspective-CPU-not-native',sceneOcclusionApplied:false};
}
export function comparePerspectiveBody(render,evidence){
 const {width:W,height:H,rgba}=render,{videoRGBA,backgroundRGBA,validMask,region}=evidence,N=W*H;need(videoRGBA?.length===N*4&&backgroundRGBA?.length===N*4&&validMask?.length===N,'Frozen native video/background/validity required');let gain=0,bodySSE=0,backgroundSSE=0,knownBodyPixels=0,unavailableBodyPixels=0,bodyPixels=0;const runs=[];let start=-1,last=-2;
 for(let i=0;i<N;i++){const a=rgba[i*4+3]/255;if(!a)continue;bodyPixels++;if(i!==last+1){if(start>=0)runs.push([start,last-start+1]);start=i;}last=i;if(!validMask[i]){unavailableBodyPixels++;continue;}knownBodyPixels++;for(let c=0;c<3;c++){const v=videoRGBA[i*4+c],b=backgroundRGBA[i*4+c],pred=b*(1-a)+rgba[i*4+c]*a;backgroundSSE+=(v-b)**2;bodySSE+=(v-pred)**2;}}
 if(start>=0)runs.push([start,last-start+1]);gain=backgroundSSE-bodySSE;const fit={kind:'conditional-source-perspective-body-comparison',regionId:region.id,pixelErrorReduction:gain,backgroundSSE,bodySSE,bodyPixels,knownBodyPixels,unavailableBodyPixels,bodyMaskRuns:runs,backgroundOnlyPreferred:gain<=0,raster:render.raster,clippedTriangles:render.clippedTriangles,bodyCertified:false,speciesCertified:false,unknownNonEnemyPossible:true,occludedOrIncompleteBodyPossible:true,noEventPossible:true,minimumProvenATCalls:0};if(evidence.originalProposalSupport!==undefined)fit.originalProposalSupport=nativeOriginalProposalAttribution(render,evidence,fit);return fit;
}
