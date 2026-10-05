/* GPL-2.0-or-later. Isolated mode2 -> CPU NORMAL adapter.
 * Partial light-context construction follows the existing DeSmuME-derived
 * core-normal-lighting.mjs. No captured time, RGB, matrix or shininess defaults.
 * ROM material writes are an explicit default/static-map draw subset, not live
 * material animation/cache replay. BB/BBY matrices are supplied only by the separately verified packet replay below.
 */
import {transformDirectionFx,shadeCoreNormal} from './core-normal-lighting.mjs';
import {buildLightingGeometry} from './build-lighting-geometry.mjs';
import {readNativeModelInfo,nativeSbcPositionScale} from '../native/native-model-info.mjs';
import {readNativeMaterials,deriveNativeMaterialResult} from '../native/native-material.mjs';
import {decodeNativeSbc,readNativeShapes,decodePackedGx,decodeLocalVertices} from '../native/native-sbc-gx.mjs';
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const matrix=x=>Array.isArray(x)&&x.length===16&&x.every(n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647);
const i32=x=>Number(BigInt.asIntN(32,BigInt(x))),shift=x=>i32(BigInt.asIntN(64,x)>>12n);
const dot=(a,b)=>shift(a.reduce((s,x,i)=>s+BigInt(x)*BigInt(b[i]),0n));
function evaluation(value){if(value?.ready!==true||value.mode!==2||!Array.isArray(value.lights)||value.lights.length!==2||!value.selected||!value.materialWrites)throw Error('Successful explicit mode2 evaluation required');return value;}
/** Transforms a proven packed LIGHT_VECTOR with the matrix active at its write.
 * Null lights are deliberately unresolved, never numeric zero/white substitutes.
 */
function lightContext(directionWord,colorWord,lightMatrixFx,id){
 if(!uint(directionWord)||!uint(colorWord)||directionWord>>>30!==id||colorWord>>>30!==id)throw Error('Explicit packed light-ID words required');
 const v=[0,10,20].map(s=>{const x=directionWord>>>s&1023;return (x&512?x-1024:x)*8;}),direction=transformDirectionFx(v,lightMatrixFx),half=[direction[0],direction[1],direction[2]-4096],squared=dot(half,half);
 if(squared<0)throw Error('Overflowing half-vector outside core lighting subset');
 const length=Math.trunc(Math.sqrt(squared)),halfNegative=half.map(x=>length?-Math.trunc(i32(x<<6)/length):-x);
 return {direction,halfNegative,color:[0,5,10].map(s=>colorWord>>>s&31)};
}
export function createMode2CpuLighting({mode2Evaluation,lightMatrixFx,retainedLights,shininessTable}={}){
 const e=evaluation(mode2Evaluation);if(!matrix(lightMatrixFx))throw Error('Explicit proven light-write FX32 matrix required');
 if(shininessTable!==undefined&&shininessTable!==null&&(!(shininessTable instanceof Uint8Array)||shininessTable.length!==128))throw Error('Applied shininess table must contain128 explicit bytes');
 const lights=[null,null,null,null],evidence=[];
 for(const row of e.lights){if(row.id!==0&&row.id!==1)throw Error('Mode2 evaluator may supply only lights0/1');if(lights[row.id])throw Error('Repeated mode2 light ID');lights[row.id]=lightContext(row.directionWord,row.colorWord,lightMatrixFx,row.id);evidence.push({id:row.id,source:'mode2-evaluator',directionWord:row.directionWord,colorWord:row.colorWord});}
 if(retainedLights!==undefined){if(!Array.isArray(retainedLights))throw Error('retainedLights must be explicit entries');for(const row of retainedLights){if((row.id!==2&&row.id!==3)||lights[row.id])throw Error('Retained light must uniquely identify2 or3');if(!matrix(row.lightMatrixFx))throw Error('Retained light requires matrix active at its own write');lights[row.id]=lightContext(row.directionWord,row.colorWord,row.lightMatrixFx,row.id);evidence.push({id:row.id,source:'explicit-retained-write',directionWord:row.directionWord,colorWord:row.colorWord});}}
 return {kind:'mode2-partial-core-lighting',lights,shininessTable:shininessTable?.slice()??null,lightMatrixFx:lightMatrixFx.slice(),evidence,unresolvedLightIds:[0,1,2,3].filter(i=>lights[i]===null),scope:'Only known light writes transformed. Missing lights/table are checked against each effective material before NORMAL.'};
}
export function shadeMode2Normal(normalFx9,normalMatrixFx,material,lighting){
 if(lighting?.kind!=='mode2-partial-core-lighting'||!matrix(normalMatrixFx))throw Error('Mode2 lighting context and proven normal matrix required');
 for(const k of['diffuseAmbient','specularEmission','polygonAttribute'])if(!uint(material?.[k]))throw Error('Explicit effective native material words required');
 const mask=material.polygonAttribute&15;for(let id=0;id<4;id++)if(mask&(1<<id)&&lighting.lights[id]===null)throw Error('Unresolved enabled light'+id+'; no default substituted');
 if(mask&&(material.specularEmission&0x8000)&&lighting.shininessTable===null)throw Error('Unresolved applied shininess table required by effective SPE_EMI');
 return shadeCoreNormal(normalFx9,normalMatrixFx,material,lighting);
}
export function readMode2StaticMaterialRules(sdk){
 const spans=[[0x02016d50,0x34,0xdfdf4230],[0x02053808,0x18,0x75a74f46],[0x020b8d78,0x40,0xc0131566],[0x020b8b58,0x7c,0x48470106]];
 for(const[a,n,want]of spans){let h=2166136261;for(const b of sdk.read(a,n))h=Math.imul(h^b,16777619)>>>0;if(h!==want)throw Error('Mode2 static material writer source differs at '+a.toString(16));}
 const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,4).getUint32(0,true);};
 const preserveMask=word(0x020b8bd4);if(word(0x0205381c)!==0x020b8d78||preserveMask!==0x8000ffff)throw Error('Unsupported native ambient write mask/dispatch');
 const b=sdk.read(0x020e934c,32),d=new DataView(b.buffer,b.byteOffset,b.byteLength),masks=Array.from({length:8},(_,i)=>d.getUint32(i*4,true));
 return {preserveMask,masks,evidence:{staticDrawCall:0x02016d60,ambientDispatcher:0x02053808,allMaterials:0x020b8d78,oneMaterial:0x020b8b58,preserveMaskLiteral:0x020b8bd4,mergeMasks:0x020e934c,spans}};
}
/** Applies only020b8b58's write to material.diffuseAmbient before SDK masks.
 * The entire low16 (including diffuse COLOR-set bit) and original bit31 survive.
 * Base globals are explicit. Only the mode2-known DIF_AMB write replaces one.
 */
export function deriveMode2StaticMaterials(modelBytes,sdk,{mode2Evaluation,materialGlobals,modelIndex=0}={}){
 const e=evaluation(mode2Evaluation);for(const k of['diffuseAmbient','specularEmission','polygonAttribute'])if(!uint(materialGlobals?.[k]))throw Error('Explicit native base material globals required');
 if(!Number.isInteger(e.selected.field40)||e.selected.field40<0||e.selected.field40>65535||!uint(e.materialWrites.diffuseAmbient))throw Error('Mode2 selected ambient/material write required');
 const rules=readMode2StaticMaterialRules(sdk),model=readNativeModelInfo(modelBytes).models[modelIndex];if(!model)throw Error('Native source model absent');const source=readNativeMaterials(modelBytes,model);if(!source.declaredCountMatches)throw Error('Native material count differs from writer loop');
 const globals={...materialGlobals,diffuseAmbient:e.materialWrites.diffuseAmbient},written=source.materials.map(m=>({...m,diffuseAmbient:((m.diffuseAmbient&rules.preserveMask)|(e.selected.field40<<16))>>>0})),materials=written.map(m=>deriveNativeMaterialResult(m,globals,rules.masks));
 return {model,sourceMaterials:source.materials,writtenMaterials:written,materials,globals,masks:rules.masks,ambient555:e.selected.field40,evidence:rules.evidence,scope:'Default static-map ambient write and type0 material merge only; runtime animations/other mutations/cache state excluded.'};
}
/** Isolated non-billboard geometry adapter. viewFx is the source-proven complete
 * position matrix; normalViewFx excludes position-only SCALE operations. The
 * caller also supplies the matrix active when environment light0/1 were written.
 * No camera, placement matrix, initial color, runtime time or light state defaults.
 */
export function buildMode2LitGeometry(modelBytes,sdk,{mode2Evaluation,materialGlobals,viewFx,normalViewFx,lightMatrixFx,retainedLights,shininessTable,modelIndex=0,initialColor555}={}){
 if(!matrix(viewFx)||!matrix(normalViewFx))throw Error('Explicit proven position and normal root FX32 matrices required');
 if(initialColor555!==undefined&&initialColor555!==null&&(!Number.isInteger(initialColor555)||initialColor555<0||initialColor555>32767))throw Error('Explicit initial RGB555 or unresolved color required');
 const materialResult=deriveMode2StaticMaterials(modelBytes,sdk,{mode2Evaluation,materialGlobals,modelIndex}),sbc=decodeNativeSbc(modelBytes,materialResult.model);
 if(sbc.commands.some(c=>c.opcode===7||c.opcode===8))throw Error('Mode2 BB/BBY normal-matrix propagation is unproved');
 for(const c of sbc.commands)if(c.opcode===4){const material=materialResult.materials[c.materialIndex];if(!material)throw Error('Source SBC material absent');if(material.hideShapes)throw Error('Mode2 hidden-material SBC replay is not connected');}
 const lighting=createMode2CpuLighting({mode2Evaluation,lightMatrixFx,retainedLights,shininessTable}),normalEvents=[];
 const geometry=buildLightingGeometry(modelBytes,sdk.read(0x020e936c,36),{modelIndex,viewFx,normalViewFx,defaultColor555:initialColor555??null,
  materialColor:(i,prior)=>materialResult.materials[i].diffuseAmbient&0x8000?materialResult.materials[i].diffuseAmbient&32767:prior,
  shadeNormal:(normal,m,i)=>{const result=shadeMode2Normal(normal,m,materialResult.materials[i],lighting);normalEvents.push({materialIndex:i,normal:normal.slice(),normalMatrix:m.slice(),color555:result.color555});return result;}});
 if(geometry.draws.some(d=>d.vertices.some(v=>v.color555===null)))throw Error('Mode2 geometry still depends on unresolved incoming color');
 return {geometry,materialResult,lighting,normalEvents,scope:'Isolated default/static non-BB CPU geometry with event-ordered GX COLOR/NORMAL and source ambient write. Exact supplied state only; no live state discovery or native pixel acceptance.'};
}


import {readAutomaticBillboardRules} from '../automatic-billboard-scene.mjs';
import {buildDefaultBillboardPacket} from '../native-billboard.mjs';
import {buildMapYBillboardCallback} from '../map-billboard-callback.mjs';
import {readNativeNodes,planNativeNodeMatrices} from '../native/native-node-pose.mjs';
import {makeNativeTrig} from '../native/native-map-records.mjs';
const equal=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>x===b[i]);
const multiplyFx=(a,b)=>Array.from({length:16},(_,k)=>{let n=0n;for(let j=0;j<4;j++)n+=BigInt(a[j*4+k%4])*BigInt(b[(k>>2)*4+j]);return i32(n>>12n);});
const identityFx=()=>[4096,0,0,0,0,4096,0,0,0,0,4096,0,0,0,0,4096];
function matrixOperation(op,values){const m=identityFx();if(op===0x19||op===0x1a){for(let c=0;c<3;c++)for(let r=0;r<3;r++)m[c*4+r]=values[c*3+r];if(op===0x19)m.splice(12,3,...values.slice(9,12));}else if(op===0x1b){for(let i=0;i<3;i++)m[i*5]=values[i];}else if(op===0x1c)m.splice(12,3,...values);else throw Error('Unsupported normal matrix operation '+op);return m;}
// Packet command order: POP, MODE2, LOAD4x3, SCALE. MODE2 LOAD updates vector
// and position. SCALE updates ONLY position (core gfx3d.cpp MatrixScale).
// Preserve LOAD's complete affine matrix; NORMAL subsequently uses its upper3x3.
export function billboardPacketMatrices(packet){
 if(!(packet instanceof Uint8Array)||packet.length!==72)throw Error('Native72-byte billboard packet required');const d=new DataView(packet.buffer,packet.byteOffset,packet.byteLength);
 if(d.getUint32(0,true)!==0x1b171012||d.getInt32(4,true)!==1||d.getInt32(8,true)!==2)throw Error('Billboard packet matrix-mode/command sequence differs');
 const normal=identityFx();for(let c=0;c<4;c++)for(let r=0;r<3;r++)normal[c*4+r]=d.getInt32(12+(c*3+r)*4,true);
 const scaleFx=[0,1,2].map(i=>d.getInt32(60+i*4,true)),position=multiplyFx(normal,matrixOperation(0x1b,scaleFx));return {normal,position,scaleFx};
}
/** Replays the EXACT accepted position callback sequence using supplied ROM
 * rules/templates, then replays SBC's separate position/vector stacks. The
 * rebuilt position input/output must match each existing callback; normal is
 * taken from emitted LOAD before SCALE. No cached basis is freshly recomputed
 * per later BBY node, and no full BB consumes the separate BBY dirty flag.
 */
export function buildAutomaticNormalMatrices(project,automatic,viewFx){
 if(!matrix(viewFx)||!automatic?.plan||!Array.isArray(automatic.scenes)||!Array.isArray(automatic.callbacks))throw Error('Automatic camera-space scene and matching explicit view required');
 if(automatic.scenes.some(s=>s.coordinateSpace!=='camera'))throw Error('Normal adapter requires camera-space automaticBillboardScenes output');
 const rules=readAutomaticBillboardRules(project.sdk),pivot=project.sdk.read(0x020e936c,36),trig=makeNativeTrig(project.sdk.read(0x020e955c,16384),25736),targets=[];
 for(let si=0;si<automatic.scenes.length;si++){const s=automatic.scenes[si],members=project.archive(s.archiveName);for(const i of s.instances){const bytes=members.get(i.modelName);if(!bytes)throw Error('Normal source model missing');const model=readNativeModelInfo(bytes).models[0],sbc=decodeNativeSbc(bytes,model);if(sbc.unresolved.length||!sbc.terminated)throw Error('Unresolved normal source SBC');if(targets.some(t=>t.si===si&&t.instance.id===i.id))throw Error('Duplicate normal instance ID requires source selection');targets.push({si,scene:s,instance:i,bytes,model,sbc});}}
 let yTemplate=rules.template.slice(),fullTemplate=rules.full.template.slice(),dirty=rules.dirtyReset;const callbackMatrices=new Map(),callbacks=[];
 for(const row of automatic.callbacks){const found=targets.filter(t=>t.instance.id===row.instanceId&&t.instance.modelName===row.modelName);if(found.length!==1)throw Error('Ambiguous normal callback identity across streams');const t=found[0],command=t.sbc.commands.find(c=>c.offset===row.offset);
  if(!command||command.opcode!==row.opcode||![7,8].includes(command.opcode)||!matrix(row.input)||!matrix(row.output))throw Error('Normal callback/source SBC identity differs');
  let emitted,before=dirty;
  if(command.opcode===7){emitted=buildDefaultBillboardPacket({axis:'full',modelViewFx:row.input,previousTemplate:fullTemplate,globalFlags:rules.full.globalFlagProjection.value,contextFlags:rules.flagProjection,callbackOverride:rules.full.callbackOverride});fullTemplate=emitted.nextTemplate;}
  else{if(automatic.billboardSource?.cacheBasisOrderIndependent!==true)throw Error('BBY normal cache requires accepted order-independent first-instance basis');emitted=buildMapYBillboardCallback({mode:rules.mode,modelViewFx:row.input,previousTemplate:yTemplate,dirtyFlag:dirty,contextFlags:rules.flagProjection});if(!emitted.emitted)throw Error('Suppressed BBY normal packet outside connected profile');yTemplate=emitted.nextTemplate;dirty=emitted.dirtyFlagAfter;if(row.dirtyBefore!==before||row.dirtyAfter!==dirty)throw Error('Position/normal BBY cache sequence differs');}
  const matrices=billboardPacketMatrices(emitted.packet);if(!equal(matrices.position,row.output))throw Error('Replayed normal packet does not reproduce position callback');
  const key=t.si+':'+row.instanceId+':'+row.offset;if(callbackMatrices.has(key))throw Error('Repeated normal callback key');callbackMatrices.set(key,{...matrices,input:row.input});callbacks.push({sceneIndex:t.si,instanceId:row.instanceId,model:row.modelName,sbcOffset:row.offset,opcode:row.opcode,normalMatrix:matrices.normal,scaleFx:matrices.scaleFx,dirtyBefore:before,dirtyAfter:dirty});
 }
 const byScene=automatic.scenes.map(()=>new Map()),unresolved=[];
 for(const t of targets){const {instance,bytes,model,sbc}=t;try{
  const nodePlan=planNativeNodeMatrices(readNativeNodes(bytes,model,pivot),sbc);if(nodePlan.unresolved.length)throw Error('Unresolved default normal node plan');const nodeByOffset=new Map(nodePlan.results.map(r=>[r.offset,r]));
  const world=instance.world;if(!world||!Number.isInteger(world.yaw)||!Array.isArray(world.scale)||world.scale.length!==3||!Array.isArray(world.position)||world.position.length!==3)throw Error('Source world placement required');const {sin,cos}=trig(world.yaw),rotation=[cos,0,-sin,0,0,4096,0,0,sin,0,cos,0,0,0,0,4096],root=rotation.slice();for(let c=0;c<3;c++)for(let r=0;r<3;r++)root[c*4+r]=i32(BigInt(rotation[c*4+r])*BigInt(world.scale[c])>>12n);root.splice(12,3,...world.position);
  let position=multiplyFx(viewFx,root),normal=multiplyFx(viewFx,rotation),visible=true;const stack=new Map(),draws=[],drawByOffset=new Map(instance.draws.map(d=>[d.sbcOffset,d])),hasBillboard=sbc.commands.some(c=>c.opcode===7||c.opcode===8);
  const restore=slot=>{const m=stack.get(slot);if(!m)throw Error('Uninitialized normal SBC matrix stack slot');position=m.position.slice();normal=m.normal.slice();},save=slot=>stack.set(slot,{position:position.slice(),normal:normal.slice()});
  for(const c of sbc.commands){if(c.opcode===1)break;if(c.opcode===0||c.opcode===4)continue;if(c.opcode===2){visible=c.nodeVisibility.visible;continue;}if(c.opcode===3){restore(c.matrixRestore);continue;}
   if(c.opcode===6){const d=c.nodeDescription;if(d.flags!==0)throw Error('Normal NODEDESC flags outside default subset');if(d.restoreSlot!==null)restore(d.restoreSlot);for(const op of nodeByOffset.get(c.offset).gx){const m=matrixOperation(op.opcode,op.signedFx12);position=multiplyFx(position,m);if(op.opcode!==0x1b)normal=multiplyFx(normal,m);}if(d.storeSlot!==null)save(d.storeSlot);continue;}
   if(c.opcode===11){position=multiplyFx(position,matrixOperation(0x1b,nativeSbcPositionScale(model,c.option)));continue;}
   if(c.opcode===7||c.opcode===8){const b=c.billboard;if(b.restoreSlot!==null)restore(b.restoreSlot);const m=callbackMatrices.get(t.si+':'+instance.id+':'+c.offset);if(!m)throw Error('Accepted billboard packet missing for normal propagation');if(!equal(position,m.input))throw Error('Normal replay view/position differs before billboard');position=m.position.slice();normal=m.normal.slice();if(b.storeSlot!==null)save(b.storeSlot);continue;}
   if(c.opcode!==5)throw Error('Unsupported normal SBC opcode '+c.opcode);if(!visible)continue;const draw=drawByOffset.get(c.offset);if(!draw)throw Error('Missing accepted shape in normal replay');if(hasBillboard&&!equal(position,draw.matrix))throw Error('Billboard shape position matrix changed during normal replay');draws.push({...draw,normalMatrix:normal.slice(),normalMatrixSource:'native-default-SBC-and-pre-SCALE-billboard-packet'});
  }
  if(draws.length!==instance.draws.length)throw Error('Normal replay draw count differs');byScene[t.si].set(instance.id,{...instance,draws});
 }catch(e){unresolved.push({sceneIndex:t.si,instanceId:instance.id,model:instance.modelName,reason:e.message});}}
 const scenes=automatic.scenes.map((s,si)=>({...s,instances:s.instances.map(i=>byScene[si].get(i.id)??i)}));
 return {...automatic,scenes,normalMatrixUnresolved:unresolved,normalMatricesApplied:unresolved.length===0,normalBillboardCallbacks:callbacks,scope:automatic.scope+' Separate NORMAL matrix replay; packet LOAD before position-only SCALE. Lighting inputs remain independent.'};
}
/** Color-only replay on already positioned geometry. Requires the exact map's
 * explicit mode2 evaluation and proven normal plan; preserves positions/UVs and
 * source COLOR/NORMAL event order. Unknown lights/shininess still reject use.
 */
export function applyMode2ToAutomaticScenes(project,automatic,{mode2Evaluation,materialGlobals,lightMatrixFx,retainedLights,shininessTable}={}){
 const e=evaluation(mode2Evaluation);if(automatic?.normalMatricesApplied!==true||automatic.normalMatrixUnresolved?.length)throw Error('Complete normal-matrix plan required');
 if(automatic.plan.recordKey!==`map:${e.source?.callIndex}:${e.source?.callOffset}`)throw Error('Mode2 environment/scene map identity differs');
 const lighting=createMode2CpuLighting({mode2Evaluation:e,lightMatrixFx,retainedLights,shininessTable}),events=[];
 const scenes=automatic.scenes.map(scene=>{const members=project.archive(scene.archiveName);return {...scene,instances:scene.instances.map(instance=>{
  const bytes=members.get(instance.modelName),materials=deriveMode2StaticMaterials(bytes,project.sdk,{mode2Evaluation:e,materialGlobals}),sbc=decodeNativeSbc(bytes,materials.model),shapes=readNativeShapes(bytes,materials.model),byOffset=new Map(instance.draws.map(d=>[d.sbcOffset,d]));let visible=true,material=null,materialIndex=null,color=null,response=null;const draws=[];
  for(const c of sbc.commands){if(c.opcode===1)break;if(c.opcode===2)visible=c.nodeVisibility.visible;if(c.opcode===4){materialIndex=c.materialIndex;material=materials.materials[c.materialIndex];if(!material||material.hideShapes)throw Error('Mode2 material visibility/cache replay unresolved');if(material.diffuseAmbient&0x8000){color=material.diffuseAmbient&32767;response=null;}}
   if(c.opcode!==5||!visible)continue;const draw=byOffset.get(c.offset);if(!draw||!material||draw.normalMatrixSource!=='native-default-SBC-and-pre-SCALE-billboard-packet')throw Error('Missing proven normal draw/material');const shape=shapes[c.shape.index],gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes),local=decodeLocalVertices(gx.commands);if(gx.unresolved.length||local.unresolved.length||local.vertices.length!==draw.vertices.length)throw Error('Mode2 source GX/vertex correspondence unresolved');
   let primitive=false,normalCommands=0;const colors=new Map(),responses=new Map();gx.commands.forEach((q,i)=>{if(q.opcode===0x40)primitive=true;if(q.opcode===0x41)primitive=false;if(q.opcode===0x20){color=q.parameterWords[0]&32767;response=null;}if(q.opcode===0x21){if(!primitive)throw Error('NORMAL before BEGIN depends on prior applied material');const word=q.parameterWords[0],normal=[0,10,20].map(s=>{const n=word>>>s&1023;return n&512?n-1024:n;});const shaded=shadeMode2Normal(normal,draw.normalMatrix,material,lighting);color=shaded.color555;response={normalFx:shaded.normalFx,material,materialIndex};normalCommands++;}colors.set(i,color);responses.set(i,response);});
   const vertices=draw.vertices.map((v,i)=>{const color555=colors.get(local.vertices[i].command);if(color555===null||color555===undefined)throw Error('Unresolved mode2 incoming vertex color');return {...v,color555,mode2Response:responses.get(local.vertices[i].command)??null};});if(normalCommands)events.push({archive:scene.archiveName,instanceId:instance.id,shapeIndex:draw.shapeIndex,normalCommands});
   draws.push({...draw,vertices,normalLightingApplied:normalCommands>0,normalLightingSource:'explicit-mode2-with-native-normal-plan',textureBinding:draw.textureBinding?{...draw.textureBinding,material:materials.writtenMaterials[draw.materialIndex]}:draw.textureBinding});
  }
  if(draws.length!==instance.draws.length)throw Error('Mode2 replay changed accepted draw count');return {...instance,draws};})};});
 return {...automatic,scenes,mode2Applied:true,mode2Evaluation:e,mode2NormalEvents:events,mode2MaterialGlobals:{...materialGlobals,...e.materialWrites},scope:automatic.scope+' Event-ordered mode2 NORMAL with source static ambient write; no live-state discovery/native raster acceptance.'};
}
