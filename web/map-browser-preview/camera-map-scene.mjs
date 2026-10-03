import{buildCameraGeometry}from'./camera-geometry.mjs';
import{buildMapYBillboardCallback}from'./map-billboard-callback.mjs';
import{bindStaticTextures}from'./texture-binding.mjs';
// Observed callback recipe only; other archives remain on the original static path.
// Broader coverage requires native callback/placement evidence, not filename guessing.
export function cameraMapScene(project,scene,textureBytes,viewFx,{profile}={}){
 if(profile!=='D04-map-y-mode0'||scene.archiveName!=='D04.amdj'||scene.streamName!=='D04M0000.bmdj')throw Error('Unverified camera-aware billboard recipe');
 const model=scene.sourceModels.find(x=>x.id===0),placement=scene.sourcePlacements.find(x=>x.modelId===0),world=scene.sourceWorld.find(x=>x.id===placement?.id);
 if(model?.name!=='D04M0000.imd'||!model.nativeBranch.startsWith('static-model')||!world||world.position.some(x=>x!==0)||world.scale.some(x=>x!==4096)||world.yaw!==0)throw Error('Observed identity root placement not established');
 const bytes=project.archive(scene.archiveName).get('D04M0000.nsbmd'),bindings=bindStaticTextures(bytes,textureBytes);let template=project.sdk.read(0x020f2d70,72).slice(),dirty=1;const callbacks=[];
 const geometry=buildCameraGeometry(bytes,project.sdk.read(0x020e936c,36),{viewFx,evaluateBillboard:(c,m)=>{const cb=buildMapYBillboardCallback({mode:0,modelViewFx:m,previousTemplate:template,dirtyFlag:dirty,contextFlags:0x1d});template=cb.nextTemplate;dirty=cb.dirtyFlagAfter;if(!cb.emitted)throw Error('Suppressed callback');const d=new DataView(cb.packet.buffer,cb.packet.byteOffset,cb.packet.byteLength),q=Array.from({length:12},(_,i)=>d.getInt32(12+4*i,true)),out=[q[0],q[1],q[2],0,q[3],q[4],q[5],0,q[6],q[7],q[8],0,q[9],q[10],q[11],4096];for(let col=0;col<3;col++)for(let row=0;row<4;row++)out[col*4+row]=Number(BigInt.asIntN(32,(BigInt(out[col*4+row])*BigInt(d.getInt32(60+col*4,true)))>>12n));callbacks.push({node:c.billboard.nodeIndex,offset:c.offset});return out;}});
 const transform=v=>[0,1,2].map(r=>viewFx[12+r]/4096+v.reduce((s,x,c)=>s+viewFx[c*4+r]*x/4096,0)),instances=scene.instances.filter(x=>x.id!==world.id).map(x=>({...x,draws:x.draws.map(d=>({...d,vertices:d.vertices.map(v=>({...v,position:transform(v.position)}))}))}));
 instances.push({id:world.id,modelName:'D04M0000.nsbmd',draws:geometry.draws.map(d=>({...d,textureBinding:bindings[d.materialIndex]}))});
 return{...scene,instances,unsupported:scene.unsupported.filter(x=>x.id!==world.id),callbacks,coordinateSpace:'camera',scope:scene.scope+' Explicit D04 mode0 map billboard recipe: source tree9nodes, native3modelview/packet samples only. Context flags/dirty policy and other maps remain unverified; no native pixel/fog parity.'};
}
