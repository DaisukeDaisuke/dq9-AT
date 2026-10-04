// ROM-derived default/static map BB/BBY pass. No map-name recipes or captured flags.
import {buildCameraGeometry} from './camera-geometry.mjs';
import {buildDefaultBillboardPacket} from './native-billboard.mjs';
import {buildMapYBillboardCallback} from './map-billboard-callback.mjs';
import {bindAutomaticTextures} from './auto-texture-binding.mjs';
import {readNativeModelInfo} from './native/native-model-info.mjs';
import {decodeNativeSbc,readNativeShapes,decodePackedGx,decodeLocalVertices} from './native/native-sbc-gx.mjs';
import {nativeAsciiNameCandidates} from './native/native-file-name.mjs';
import {makeNativeTrig} from './native/native-map-records.mjs';
import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
const i32=n=>Number(BigInt.asIntN(32,n));
const multiply=(a,b)=>Array.from({length:16},(_,k)=>{const r=k%4,c=k>>2;let n=0n;for(let j=0;j<4;j++)n+=BigInt(a[j*4+r])*BigInt(b[c*4+j]);return i32(n>>12n);});
const transform=(m,v)=>[0,1,2].map(r=>m[12+r]/4096+v.reduce((s,x,c)=>s+m[c*4+r]*x/4096,0));
const fxMatrix=m=>Array.isArray(m)&&m.length===16&&m.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
function words(sdk){return a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};}
function immediate(word,a,rd){const w=word(a);if((w>>>12&15)!==rd||(w&0xffff0000)>>>0!==((0xe3a00000|(rd<<12))&0xffff0000)>>>0)throw Error('BBY source MOV differs at '+a.toString(16));const n=w&255,r=(w>>>8&15)*2;return ((n>>>r)|(n<<(32-r)))>>>0;}
export function readAutomaticBillboardRules(sdk){
 const word=words(sdk),expect=(a,w)=>{if(word(a)!==w)throw Error('BBY source instruction differs at '+a.toString(16));};
 // Static model loader registers BBY callback, option A; no name selection.
 expect(0x02014c90,0xe59f1260);expect(0x02014c94,0xe3a05001);expect(0x02014c9c,0xe3a03008);expect(0x02014ca4,0xeb027f12);
 const callbackAddress=word(0x02014ef8);if(callbackAddress!==0x020e4b60)throw Error('Unsupported map BBY callback');
 expect(callbackAddress,0xe59fc00c);expect(callbackAddress+4,0xe1a01000);expect(callbackAddress+8,0xe59f2008);expect(callbackAddress+16,0xe12fff1c);
 const mode=immediate(word,callbackAddress+12,0),coreAddress=word(callbackAddress+20),templateAddress=word(callbackAddress+24);
 if(coreAddress!==0x020e48f4||mode!==0)throw Error('Unsupported map billboard core/mode');
 // Map draw resets this same dirty cell once before traversing its chunks.
 expect(0x02016640,0xe59f14d4);expect(0x0201664c,0xe581000c);
 const dirtyAddress=word(0x020e4b44),dirtyResetAddress=word(0x02016b1c)+12;
 if(dirtyAddress!==dirtyResetAddress)throw Error('Map BBY dirty writer does not alias callback reader');
 const dirtyReset=immediate(word,0x02016648,0);
 // Render-object initializer clears flags; normal draw may OR bit 0 only.
 expect(0x020b464c,0xe3a02054);expect(0x020b4650,0xeb005e18);expect(0x020b5b58,0xe5850008);
 const renderObjectFlags=immediate(word,0x020b4648,0),initialContextFlags=immediate(word,0x020b5b50,0);
 const flagProjection=initialContextFlags|(renderObjectFlags&1?0x80:0)|(renderObjectFlags&2?0x100:0)|(renderObjectFlags&4?0x200:0)|(renderObjectFlags&8?0x400:0);
 const template=sdk.read(templateAddress,72).slice();
 // Ordinary static map draw flushes model/view state before every model. The
 // exact same global block is read by the SDK BB handler. Its low two flags
 // are known clear even though unrelated global bookkeeping bits are unknown.
 expect(0x02016d74,0xeb027959);expect(0x02016d80,0xeb01a21d);
 expect(0x020b5304,0xe3c11001);expect(0x020b5308,0xe3c11002);expect(0x020b530c,0xe58010fc);
 const fullGlobalAddress=word(0x020b6ea4);if(fullGlobalAddress!==word(0x020b5314))throw Error('Full BB global does not alias static map flush state');
 const clearMask=(word(0x020b5304)&255)|(word(0x020b5308)&255),globalFlagMask=clearMask,globalFlagValue=(~clearMask&globalFlagMask)>>>0;
 // Context is zero-initialized, then only the loader's opcode8 callback is
 // copied into its command-indexed slot. Opcode7's callback remains NULL.
 expect(0x020b5b44,0xe3a00000);expect(0x020b5c34,0xe580100c);
 const registeredOpcode=immediate(word,0x02014c9c,3),callbackOverride=registeredOpcode===7;
 if(callbackOverride)throw Error('Full BB has a registered map callback');
 expect(0x020b6e08,0xe59f00ac);expect(0x020b6e0c,0xe3a02048);
 const fullTemplateAddress=word(0x020b6ebc),fullTemplate=sdk.read(fullTemplateAddress,72).slice();
 if(word(0x020b6e94)!==fullTemplateAddress+48||word(0x020b6e98)!==fullTemplateAddress+60)throw Error('Full BB template update offsets differ');
 if(word(fullTemplateAddress)!==0x1b171012||word(fullTemplateAddress+4)!==1||word(fullTemplateAddress+8)!==2)throw Error('Full BB packet template differs');
 const full={handlerAddress:0x020b6bb8,templateAddress:fullTemplateAddress,template:fullTemplate,globalAddress:fullGlobalAddress,globalFlagProjection:{mask:globalFlagMask,value:globalFlagValue},callbackOverride,
  evidence:{staticMapFlushCall:0x02016d74,clearFlagInstructions:[0x020b5304,0x020b5308],callbackContextInit:0x020b5b44,callbackRegistrationOpcode:registeredOpcode,templateLiteral:0x020b6ebc}};
 const b=words(sdk)(templateAddress);if(b!==0x1b171012)throw Error('Map BBY packet template differs');
 return {callbackAddress,coreAddress,templateAddress,dirtyAddress,dirtyReset,mode,renderObjectFlags,initialContextFlags,flagProjection,template,full,
  evidence:{registration:0x02014c90,renderObjectInit:0x020b4638,contextInit:0x020b5b34,dirtyReset:0x02016648,dirtyStore:0x0201664c},
  scope:'Default static map draw. Only the callback-relevant context flag projection is needed; material/node bookkeeping bits are not claimed to match a live context.'};
}
function resourcesFromPlan(project,plan){
 const out=[],cache=new Map();for(const t of plan.textures){let z=cache.get(t.archive);if(!z){z=Narc.load(new Uint8Array(project.nfs.readFile('data/map/'+t.archive)));cache.set(t.archive,z);}
  if(z.fnt.getFilenameOf(t.archiveIndex)!==t.member)throw Error('AMBL source order differs');const b=z.files[t.archiveIndex];out.push({name:t.archive+'/'+t.member,bytes:b[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength))):b});}return out;
}
function worldMatrix(world,trig){
 const {sin,cos}=trig(world.yaw),[x,y,z]=world.scale,fx=(a,b)=>i32(BigInt(a)*BigInt(b)>>12n);
 return [fx(cos,x),0,fx(-sin,x),0,0,y,0,0,fx(sin,z),0,fx(cos,z),0,...world.position,4096];
}
function packetMatrix(packet){const d=new DataView(packet.buffer,packet.byteOffset,packet.byteLength),q=Array.from({length:12},(_,i)=>d.getInt32(12+i*4,true)),m=[q[0],q[1],q[2],0,q[3],q[4],q[5],0,q[6],q[7],q[8],0,q[9],q[10],q[11],4096];for(let c=0;c<3;c++)for(let r=0;r<4;r++)m[c*4+r]=i32(BigInt(m[c*4+r])*BigInt(d.getInt32(60+c*4,true))>>12n);return m;}
function sourceColors(bytes,model,sbc,geometry,bindings,masks){
 let color=null,draw=0;const shapes=readNativeShapes(bytes,model);let visible=true;
 for(const c of sbc.commands){if(c.opcode===2)visible=c.nodeVisibility.visible;
  if(c.opcode===4){const m=bindings[c.materialIndex].material,mask=masks[m.flags>>>6&7];if(!(mask&0x8000))throw Error('Material color-set bit depends on unresolved runtime global');if(m.diffuseAmbient&0x8000){if((mask&0x7fff)!==0x7fff)throw Error('Material RGB depends on unresolved runtime global');color=m.diffuseAmbient&0x7fff;}}
  if(c.opcode!==5||!visible)continue;const shape=shapes[c.shape.index],gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes),local=decodeLocalVertices(gx.commands),colors=new Map();
  gx.commands.forEach((q,i)=>{if(q.opcode===0x20)color=q.parameterWords[0]&32767;colors.set(i,color);});const d=geometry.draws[draw++];if(d.sbcOffset!==c.offset||d.vertices.length!==local.vertices.length)throw Error('Camera geometry/color command mismatch');d.vertices=d.vertices.map((v,i)=>({...v,color555:colors.get(local.vertices[i].command)}));
 }
}
// Input is loadAutomaticScene's ROM-derived result plus the UI's calculated FX32
// camera view. There are no caller-supplied context flags, templates, or cache values.
export function automaticBillboardScenes(project,automatic,viewFx){
 if(!fxMatrix(viewFx))throw Error('Calculated FX32 camera view required');
 if(!automatic?.plan||!Array.isArray(automatic.scenes))throw Error('ROM automatic scene/load plan required');
 const rules=readAutomaticBillboardRules(project.sdk),resources=resourcesFromPlan(project,automatic.plan),trig=makeNativeTrig(project.sdk.read(0x020e955c,16384),25736),pivot=project.sdk.read(0x020e936c,36),mb=project.sdk.read(0x020e934c,32),md=new DataView(mb.buffer,mb.byteOffset,mb.length),masks=Array.from({length:8},(_,i)=>md.getUint32(i*4,true));
 let template=rules.template.slice(),fullTemplate=rules.full.template.slice(),dirty=rules.dirtyReset,basis=null;const callbacks=[],recovered=[],pending=[],scenes=[];let basisConflict=false;
 for(const source of automatic.scenes){
  const members=project.archive(source.archiveName),byModel=new Map(source.sourceModels.map(m=>[m.id,m])),byPlacement=new Map(source.sourcePlacements.map(p=>[p.id,p])),byWorld=new Map(source.sourceWorld.map(w=>[w.id,w]));
  const scene={...source,instances:source.instances.map(x=>({...x,draws:x.draws.map(d=>({...d,vertices:d.vertices.map(v=>({...v,position:transform(viewFx,v.position)}))}))})),unsupported:source.unsupported.slice(),coordinateSpace:'camera'};scenes.push(scene);
  for(const p of source.sourcePlacements){const m=byModel.get(p.modelId);if(!m?.nativeBranch.startsWith('static-model'))continue;let name,bytes,model,sbc;
   try{const dot=m.name.lastIndexOf('.'),wanted=(dot<0?m.name:m.name.slice(0,dot))+'.nsbmd',matches=nativeAsciiNameCandidates([...members.keys()].map(name=>({name})),wanted);if(matches.length!==1)continue;name=matches[0].name;bytes=members.get(name);model=readNativeModelInfo(bytes).models[0];sbc=decodeNativeSbc(bytes,model);if(!sbc.commands.some(c=>c.opcode===7||c.opcode===8))continue;
    let a=p;while(a){if(a.nativeRotation[0]||a.nativeRotation[2])throw Error('Billboard pitch/roll ancestor placement is not integrated');a=a.parentId<0?null:byPlacement.get(a.parentId);}
    const world=byWorld.get(p.id);if(!world)throw Error('Missing source world placement');
    const bindings=bindAutomaticTextures(bytes,resources),localCallbacks=[];
    const geometry=buildCameraGeometry(bytes,pivot,{viewFx:multiply(viewFx,worldMatrix(world,trig)),evaluateBillboard:(command,matrix)=>{
     if(command.opcode===7){
      const result=buildDefaultBillboardPacket({axis:'full',modelViewFx:matrix,previousTemplate:fullTemplate,globalFlags:rules.full.globalFlagProjection.value,contextFlags:rules.flagProjection,callbackOverride:rules.full.callbackOverride});
      fullTemplate=result.nextTemplate;const output=packetMatrix(result.packet);
      localCallbacks.push({opcode:7,instanceId:p.id,modelName:name,node:command.billboard.nodeIndex,offset:command.offset,input:matrix.slice(),output,scaleFx:result.scaleFx,translationFx:result.translationFx,sourceHandler:rules.full.handlerAddress});return output;
     }
     if(command.opcode!==8)throw Error('Unsupported billboard opcode');
     // SBC order within one model is fixed. Only its first BBY must establish
     // the same cache basis whichever potentially visible instance draws first.
     // A preceding full BB uses a separate SDK template and does not count.
     if(!localCallbacks.some(c=>c.opcode===8)){
      const fresh=buildMapYBillboardCallback({mode:rules.mode,modelViewFx:matrix,previousTemplate:rules.template,dirtyFlag:rules.dirtyReset,contextFlags:rules.flagProjection});
      if(!fresh.emitted||!fresh.normalizedY)throw Error('BBY basis depends on previous-frame template');
      const nextBasis=[...fresh.packet.subarray(24,48)];if(basis&&!equal(basis,nextBasis))basisConflict=true;else if(!basis)basis=nextBasis;
     }
     const result=buildMapYBillboardCallback({mode:rules.mode,modelViewFx:matrix,previousTemplate:template,dirtyFlag:dirty,contextFlags:rules.flagProjection}),before=dirty;template=result.nextTemplate;dirty=result.dirtyFlagAfter;
     const output=packetMatrix(result.packet);localCallbacks.push({opcode:8,instanceId:p.id,modelName:name,node:command.billboard.nodeIndex,offset:command.offset,input:matrix.slice(),output,dirtyBefore:before,dirtyAfter:dirty,normalizedY:result.normalizedY});return output;
    }});
    sourceColors(bytes,model,sbc,geometry,bindings,masks);
    const instance={id:p.id,modelName:name,nativeFlags:p.nativeFlags,world,draws:geometry.draws.map(d=>({...d,textureBinding:bindings[d.materialIndex]}))};pending.push({scene,instance,callbacks:localCallbacks});
   }catch(e){if(sbc?.commands.some(c=>c.opcode===8)){scene.unsupported=scene.unsupported.filter(x=>x.id!==p.id);scene.unsupported.push({id:p.id,model:m.name,reason:e.message});}}
  }
 }
 for(const row of pending){const {scene,instance}=row;scene.unsupported=scene.unsupported.filter(x=>x.id!==instance.id);
  if(basisConflict&&row.callbacks.some(c=>c.opcode===8)){scene.unsupported.push({id:instance.id,model:instance.modelName,reason:'BBY cached basis differs across source instances; native visible draw order is required'});continue;}
  scene.instances=scene.instances.filter(x=>x.id!==instance.id);scene.instances.push(instance);callbacks.push(...row.callbacks);recovered.push({archive:scene.archiveName,stream:scene.streamName,id:instance.id,model:instance.modelName,draws:instance.draws.length});
 }
 return {...automatic,scenes,callbacks,recovered,billboardSource:{...rules,template:undefined,full:{...rules.full,template:undefined},cacheBasisOrderIndependent:!basisConflict,cacheBasis:basis},scope:'ROM-derived default-pose static map full-BB and map-specific BBY, with callback-relevant flags and map-pass cache reset read from native instructions. Camera-space output. Animated poses, runtime visibility/culling, special render flags and native pixel equality remain separate.'};
}
