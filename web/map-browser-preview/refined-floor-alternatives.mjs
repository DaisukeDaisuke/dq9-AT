/* Continue the already enumerated geometric COL2 floor branch. Exact records
 * survive directly; triangle changes require source-shared 3D edges crossed in
 * order along the bounded XZ displacement. No nearest/highest/player-floor rule.
 */
import {floorHeightsAtXZ} from './rom-floor-candidates.mjs';
const sourceFields=['archive','stream','chunkId','placementId','member','recordIndex','sourceOffset'];
function sourceKey(hit){const s=hit?.source;if(!s||sourceFields.some(k=>s[k]===undefined||s[k]===null))return null;return JSON.stringify(sourceFields.map(k=>s[k]));}
const zero=[0n,1n],one=[1n,1n],cmp=(a,b)=>a[0]*b[1]<b[0]*a[1]?-1:a[0]*b[1]>b[0]*a[1]?1:0,max=(a,b)=>cmp(a,b)>0?a:b,min=(a,b)=>cmp(a,b)<0?a:b;
const cross=(a,b,c)=>(BigInt(b[0])-BigInt(a[0]))*(BigInt(c[2])-BigInt(a[2]))-(BigInt(b[2])-BigInt(a[2]))*(BigInt(c[0])-BigInt(a[0]));
function segmentInterval(vertices,start,end){
 const area=cross(vertices[0],vertices[1],vertices[2]);if(area===0n)return null;const sign=area>0n?1n:-1n;let low=zero,high=one;
 for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3],at0=cross(a,b,start)*sign,at1=cross(a,b,end)*sign,delta=at1-at0;if(delta===0n){if(at0<0n)return null;continue;}if(delta>0n)low=max(low,[-at0,delta]);else high=min(high,[at0,-delta]);if(cmp(low,high)>0)return null;}
 return{low,high};
}
function sourceSurfaceGraph(floors,startWorld,endWorld){
 if(!floors?.instances||![startWorld?.xFx,startWorld?.zFx,endWorld?.xFx,endWorld?.zFx].every(Number.isInteger))return null;
 const start=[startWorld.xFx,0,startWorld.zFx],end=[endWorld.xFx,0,endWorld.zFx],nodes=new Map(),edges=new Map();
 for(const instance of floors.instances){const scale=2**instance.col.shift;for(const record of instance.col.records){if(record.rawFlags&1||record.normalFx[1]<=0x800)continue;
  const vertices=record.verticesQuantized.map(v=>v.map((x,i)=>x*scale+instance.positionFx[i]));
  if([0,2].some(k=>Math.max(...vertices.map(v=>v[k]))<Math.min(start[k],end[k])||Math.min(...vertices.map(v=>v[k]))>Math.max(start[k],end[k])))continue;
  const interval=segmentInterval(vertices,start,end);if(!interval)continue;
  const source={archive:instance.archive,stream:instance.stream,chunkId:instance.chunkId,placementId:instance.placementId,member:instance.member,recordIndex:record.index,sourceOffset:record.sourceOffset},key=sourceKey({source});if(!key)continue;
  const edgeKeys=vertices.map((a,i)=>[JSON.stringify(a),JSON.stringify(vertices[(i+1)%3])].sort().join('|'));nodes.set(key,{key,source,interval,edgeKeys});for(const edge of edgeKeys){if(!edges.has(edge))edges.set(edge,[]);edges.get(edge).push(key);}
 }}
 return{nodes,edges};
}
function connectedRecords(graph,initialKey,targets){
 if(!graph)return[];const first=graph.nodes.get(initialKey);if(!first||cmp(first.interval.low,zero)>0||cmp(first.interval.high,zero)<0)return[];
 const reached=new Map([[initialKey,{time:zero,path:[first.source]}]]),queue=[initialKey];
 for(let i=0;i<queue.length;i++){const key=queue[i],node=graph.nodes.get(key),current=reached.get(key);for(const edge of node.edgeKeys)for(const nextKey of graph.edges.get(edge)){if(nextKey===key)continue;const next=graph.nodes.get(nextKey),time=max(current.time,max(node.interval.low,next.interval.low)),last=min(node.interval.high,next.interval.high);if(cmp(time,last)>0)continue;const old=reached.get(nextKey);if(old&&cmp(old.time,time)<=0)continue;reached.set(nextKey,{time,path:[...current.path,next.source]});queue.push(nextKey);}}
 return targets.filter(hit=>{const node=graph.nodes.get(sourceKey(hit)),found=reached.get(sourceKey(hit));return node&&found&&cmp(found.time,one)<=0&&cmp(node.interval.high,one)>=0;}).map(hit=>({hit,path:reached.get(sourceKey(hit)).path}));
}
export function continueRefinedFloorAlternatives({position,yFx,floors,refinedFloor,refinedWorld}){
 const originalFloor=position?.floor?.hits?position.floor:floorHeightsAtXZ(floors,position.world.xFx,position.world.zFx),initialHits=originalFloor.hits.filter(h=>h.yFx===yFx),targets=refinedFloor.hits.filter(h=>Number.isInteger(h.yFx)&&sourceKey(h)!==null),routes=[],missingInitialHits=[];let graph;
 for(const initial of initialHits){const key=sourceKey(initial);if(key===null){missingInitialHits.push(initial);continue;}const exact=targets.filter(h=>sourceKey(h)===key);if(exact.length){for(const hit of exact)routes.push({initial,hit,kind:'same-COL2-record',path:[initial.source]});continue;}
  graph??=sourceSurfaceGraph(floors,position.world,refinedWorld);const connected=connectedRecords(graph,key,targets);if(!connected.length)missingInitialHits.push(initial);for(const {hit,path}of connected)routes.push({initial,hit,kind:'source-shared-edge-XZ-segment',path});
 }
 const byHeight=new Map();for(const route of routes){const hit=route.hit;if(!byHeight.has(hit.yFx))byHeight.set(hit.yFx,[]);byHeight.get(hit.yFx).push(route);}
 const alternatives=[...byHeight].map(([height,items])=>({yFx:height,hits:[...new Map(items.map(r=>[sourceKey(r.hit),r.hit])).values()],sourceInitialYFx:yFx,sourceInitialHits:[...new Map(items.map(r=>[sourceKey(r.initial),r.initial])).values()],sourceContinuations:items.map(({initial,hit,kind,path})=>({initialSource:initial.source,refinedSource:hit.source,kind,path}))})),continuedKeys=new Set(routes.map(r=>sourceKey(r.hit)));
 return{ready:alternatives.length>0,reason:alternatives.length?null:(initialHits.some(h=>sourceKey(h)!==null)?'Initial COL2 floor branch has no supported source-surface continuation at refined XZ':'Initial COL2 floor branch provenance unavailable'),initialYFx:yFx,initialHits,alternatives,missingInitialHits,unrelatedRefinedHits:refinedFloor.hits.filter(h=>!continuedKeys.has(sourceKey(h))),branchComplete:initialHits.length>0&&missingInitialHits.length===0,currentFloorCertified:false,minimumProvenATCalls:0,scope:'Initial COL2 source records or exact shared-edge source surfaces along the bounded XZ displacement. All resulting heights are separate hypotheses; unrelated floors are not substituted and lost source records remain unresolved.'};
}
export function collectRefinedFloorResults(results){
 if(results.length===1)return results[0];
 let selected=results[0];const rank=r=>[r.ready?1:0,r.accepted?1:0,-(Number.isFinite(r.comparison?.alignment?.residual)?r.comparison.alignment.residual:Infinity)];
 for(const candidate of results.slice(1)){const a=rank(candidate),b=rank(selected);if(a[0]>b[0]||(a[0]===b[0]&&(a[1]>b[1]||(a[1]===b[1]&&a[2]>b[2]))))selected=candidate;}
 return{...selected,floorAlternatives:results,floorAlternativeSummary:{count:results.length,acceptedCount:results.filter(r=>r.ready&&r.accepted).length,selectionPurpose:'preview-only',currentFloorCertified:false}};
}
