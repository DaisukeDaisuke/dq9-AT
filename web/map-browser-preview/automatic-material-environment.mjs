// Initial ordinary map environment from the supplied ROM. No live-state defaults.
import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {parseCalls,decodeNumber,readPoolString,u32} from './vendor/call-stream.mjs';
import {lowerEnvironmentFog,inheritTimeFogRecords,staticMode1FogParameters} from './native/fog-records.mjs';
import {readNativeModelInfo} from './native/native-model-info.mjs';
import {readNativeShapes,decodePackedGx,decodeNativeSbc,decodeLocalVertices} from './native/native-sbc-gx.mjs';
import {nativeAsciiNameCandidates} from './native/native-file-name.mjs';
import {deriveNativeMaterialResult} from './native/native-material.mjs';
import {readSdkInitialMaterialGlobals} from './rom-sdk-initial-material.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function sourceReader(sdk){
 const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const string=a=>{const b=sdk.read(a,96),n=b.indexOf(0);if(n<0||b.subarray(0,n).some(x=>x>127))throw Error('Unsupported native environment request string');return new TextDecoder().decode(b.subarray(0,n));};
 const expect=(a,w)=>{if(word(a)!==w)throw Error('Environment source instruction differs at '+a.toString(16));};
 const mov=(a,rd)=>{const w=word(a);if((w&0xfffff000)>>>0!==(0xe3a00000|(rd<<12))>>>0)throw Error('Environment source MOV differs');const r=(w>>>8&15)*2,n=w&255;return((n>>>r)|(n<<(32-r)))>>>0;};
 return {word,string,expect,mov};
}
function zeroLightSource(reader){
 const {mov,expect}=reader,ids=[0x020531a8,0x020531b4,0x020531c0,0x020531cc].map(a=>mov(a,0));
 expect(0x020531ac,0xe1a01000);const colors=[ids[0],mov(0x020531b8,1),mov(0x020531c4,1),mov(0x020531d0,1)];
 const callAddresses=[0x020531b0,0x020531bc,0x020531c8,0x020531d4];
 callAddresses.forEach(a=>expect(a,(0xeb000000|((0x020b53b8-a-8)>>2)&0xffffff)>>>0));
 if(ids.some((id,i)=>id!==i)||colors.some(c=>c!==0))throw Error('Initial source light colors are not all zero');
 return {kind:'source-zero-light-colors',lightColorWords:colors.map((c,i)=>(c|(ids[i]<<30))>>>0),callAddresses,setter:0x020b53b8,condition:'Mode1 initial environment; later script/state light writes excluded'};
}
function readRules(sdk){
 const r=sourceReader(sdk),{word,string,expect,mov}=r,table=word(0x0207c7c0);
 if(word(table+24)!==0x67||word(table+28)!==0x0207c2f8||word(table+32)!==0x68||word(table+36)!==0x0207c32c||word(table+40)!==0x69||word(table+44)!==0x0207c470)throw Error('Environment command dispatch differs');
 expect(0x02052a64,0xe5842090);expect(0x0207c3d0,0xe7838002);expect(0x0207c430,0xe5c320e0);
 const initialSelector=mov(0x02052a60,2);if(initialSelector!==0)throw Error('Initial environment selector outside ordinary time-cycle subset');
 const archiveFormat=string(word(0x020149c8)),directory=string(word(0x020149cc)),memberFormat=string(word(0x02014ae0));
 if(archiveFormat!=='%s/ats_%c.ambl'||memberFormat!=='%s.bats')throw Error('Environment request format outside decoded subset');
 return {initialSelector,archiveFormat,directory,memberFormat,specialMapId:word(0x020531e0)&65535,dispatchTable:table,reader:r};
}
function environmentNameFromMaplist(project,record){
 const bytes=new Uint8Array(project.nfs.readFile('data/map/maplist9.bin')),pool=u32(bytes,4);
 const matches=parseCalls(bytes).filter(c=>c.opcode===0x67&&c.args[0]?.type===1&&(decodeNumber(c.args[0])&65535)===record.mapId);
 if(matches.length!==1)throw Error('Native map-ID environment definition is absent or repeated');
 const call=matches[0];if(call.index!==record.source.callIndex||call.offset!==record.source.callOffset)throw Error('ROM map record identity differs');
 if(call.args[11]?.type!==0)throw Error('Environment name argument is not a ROM string');
 const name=readPoolString(bytes,pool,call.args[11]);if(!name||!/^[A-Za-z0-9_]+$/.test(name))throw Error('Environment name is empty or outside supported ASCII request subset');
 return {name,callIndex:call.index,callOffset:call.offset,argument:11,consumer:0x0201c374};
}
function lowerStaticColorRecords(calls){
 const records=Array(7).fill(null),sources=[];
 for(const c of calls){if(c.opcode!==0x68)continue;const types=[1,2,2,2,1,1,1,2,2,1,1,1];
  if(c.argumentCount!==types.length||c.args.some((a,i)=>a.type!==types[i]))throw Error('Unsupported static environment color record shape');
  const a=c.args.map(decodeNumber),index=a[0];if(!Number.isInteger(index)||index<0||index>6)throw Error('Environment color slot outside0..6');
  if(records[index])throw Error('Repeated environment color slot requires ordering review');
  if(a.some(x=>!Number.isFinite(x)))throw Error('Nonfinite environment color value');
  records[index]={rgbMultiplier:a.slice(1,4),fields8c:a[4]&65535,fields9a:a[5]&65535,fieldsA8:a[6]&65535,brightness:a[7],contrast:a[8],fieldsB6:a[9]&65535,fieldsC4:a[10]&65535,fieldsD2:a[11]&65535};sources.push({index,callIndex:c.index,callOffset:c.offset,handler:0x0207c32c});
 }
 if(!records.slice(0,4).some(Boolean))throw Error('No specified time color record; native no-specified branch unresolved');
 const inherited=records.slice(),copies=[];
 for(let i=0;i<4;i++){if(records[i])continue;let found=null;for(let n=1;n<=3;n++){const k=(i-n+4)&3;if(records[k]){found=k;break;}}if(found===null)throw Error('No specified color predecessor');inherited[i]={...records[found],rgbMultiplier:records[found].rgbMultiplier.slice()};copies.push({destination:i,source:found});}
 return {records,inherited,sources,copies};
}
function inspectNormals(project,automatic){
 const resources=[],seen=new Set(),issues=[];
 for(const scene of automatic.scenes){const members=project.archive(scene.archiveName),used=new Set(scene.sourcePlacements.map(p=>p.modelId));
  for(const m of scene.sourceModels){if(!used.has(m.id)||!m.nativeBranch.startsWith('static-model'))continue;
   const dot=m.name.lastIndexOf('.'),requested=(dot<0?m.name:m.name.slice(0,dot))+'.nsbmd',matches=nativeAsciiNameCandidates([...members.keys()].map(name=>({name})),requested);
   if(matches.length!==1){issues.push({archive:scene.archiveName,model:m.name,reason:'Model resource absent/ambiguous'});continue;}const name=matches[0].name,key=scene.archiveName+'/'+name;if(seen.has(key))continue;seen.add(key);
   try{const bytes=members.get(name),model=readNativeModelInfo(bytes).models[0],shapes=readNativeShapes(bytes,model);let normalCommands=0;
    for(const shape of shapes){const gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes);if(gx.unresolved.length)throw Error('Unresolved GX stream');normalCommands+=gx.commands.filter(c=>c.opcode===0x21).length;}
    resources.push({archive:scene.archiveName,member:name,shapeCount:shapes.length,normalCommands});
   }catch(e){issues.push({archive:scene.archiveName,member:name,reason:e.message});}
  }
 }
 return {resources,issues,normalCommandCount:resources.reduce((n,r)=>n+r.normalCommands,0)};
}
// Resolves an initial ordinary profile, not the current running game's environment.
// Unknown time phase is eliminated only by proving all four inherited states equal.
export function readAutomaticMaterialEnvironment(project,record,automatic){
 const unresolved=[];let progress={};const base={profile:'ROM-initial-ordinary-environment',ready:false,materialGlobals:null,normalLighting:null,fogParameters:null};
 try{
  if(!automatic?.plan||!Array.isArray(automatic.scenes))throw Error('ROM automatic scene result required');
  const rules=readRules(project.sdk),source=environmentNameFromMaplist(project,record);
  if(record.mapId===rules.specialMapId)throw Error('Quest-flag environment slot override requires current progression state');
  const archivePath=rules.archiveFormat.replace('%s',rules.directory).replace('%c',source.name[0]),member=rules.memberFormat.replace('%s',source.name),z=Narc.load(new Uint8Array(project.nfs.readFile(archivePath)));
  const matches=nativeAsciiNameCandidates(z.files.map((_,index)=>({name:z.fnt.getFilenameOf(index),index})),member);if(matches.length!==1)throw Error('Native environment member absent/ambiguous');
  const resource=matches[0],raw=z.files[resource.index],bytes=raw[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(raw.buffer,raw.byteOffset,raw.length))):raw,calls=parseCalls(bytes);
  const modeCalls=calls.filter(c=>c.opcode===0x64||c.opcode===0x67);
  progress={source:{maplist:source,archive:archivePath,member:resource.name,archiveIndex:resource.index},mode:modeCalls.length===1?(modeCalls[0].opcode===0x67?1:2):null,initialSelector:rules.initialSelector};
  if(modeCalls.length!==1||modeCalls[0].opcode!==0x67)throw Error('Only source mode1 static color environment is connected');
  if(calls.some(c=>![0x65,0x67,0x68,0x69].includes(c.opcode)))throw Error('Additional environment callbacks require evaluation');
  const color=lowerStaticColorRecords(calls),ordinary=color.inherited.slice(0,4),timeIndependent=ordinary.every(r=>same(r,ordinary[0]));
  if(!timeIndependent)unresolved.push('Environment time slot/phase affects static material color');
  const identity=ordinary.every(r=>r.rgbMultiplier.every(x=>x===1)&&r.brightness===0&&r.contrast===0);
  if(!identity)unresolved.push('Nonidentity native display-list color transform is not connected');
  // For the accepted identity transform, the native float32 c/31*31 sequence
  // preserves all32 channel values, including conversion truncation.
  const denominatorBytes=project.sdk.read(0x020520ec,4),denominator=new DataView(denominatorBytes.buffer,denominatorBytes.byteOffset,4).getFloat32(0,true);
  if(denominator!==31||Array.from({length:32},(_,c)=>c).some(c=>Math.trunc(Math.fround(Math.fround(c/denominator)*denominator))!==c))throw Error('Identity color float conversion is not preserved');
  const normals=inspectNormals(project,automatic);unresolved.push(...normals.issues.map(x=>x.reason));
  const normalLighting=zeroLightSource(rules.reader);
  const fog=lowerEnvironmentFog(calls);if(!fog.ready)unresolved.push(...fog.issues.map(x=>x.error));let fogParameters=null,fogTimeIndependent=false;
  if(fog.ready){const inherited=inheritTimeFogRecords(fog.records),states=[0,1,2,3].map(i=>staticMode1FogParameters(inherited.records,i));fogTimeIndependent=states.every(x=>same(x,states[0]));if(fogTimeIndependent)fogParameters=states[0];else unresolved.push('Environment time slot/phase affects fog');}
  const globals=readSdkInitialMaterialGlobals(project.sdk);
  // 02052eb4 sets manager+46 from static record+C4, then020b53cc(value,0,0).
  // Other globals retain their SDK initialization in this explicit initial profile.
  const ambientArgument=rules.reader.mov(0x02052cc0,1);if(ambientArgument!==0)throw Error('Environment material setter argument differs');
  const materialGlobals=timeIndependent?{...globals,diffuseAmbient:(ordinary[0].fieldsC4|(ambientArgument<<16))>>>0}:null;
  return {...base,ready:unresolved.length===0,source:{maplist:source,archive:archivePath,member:resource.name,archiveIndex:resource.index},mode:1,initialSelector:rules.initialSelector,colorRecords:color,ordinaryTimeIndependent:timeIndependent,colorTransformIdentity:identity,normals,normalLighting,materialGlobals,fogParameters,fogTimeIndependent,unresolved,
   liveStateDependencies:['Environment manager+90 forced slot; +94/+98 time phase when inherited records differ','Quest/special overrides, later script setters and environment transitions','Animated material/DL modifications and scene-dependent rendering state'],
   scope:'Source-proven initial ordinary static-color profile. A ready identity result needs no tint recoloring. NORMAL reduces to emission under source-zero light colors; it is not live environment, animation, fog rasterization or native-pixel parity.'};
 }catch(e){return {...base,...progress,unresolved:[...unresolved,e.message],scope:'Unresolved source environment; no material, light, color or fog defaults substituted.'};}
}

// Event-ordered color replay. NORMAL replaces color at that command; a later
// COLOR replaces it again. A vertex's retained normal is not a lighting trigger.
export function replayZeroLightShapeColors(gx,material,initialColor){
 let color=initialColor,inPrimitive=false,normalCommands=0;const atCommand=new Map();
 for(let i=0;i<gx.commands.length;i++){const c=gx.commands[i];
  if(c.opcode===0x40)inPrimitive=true;
  if(c.opcode===0x41)inPrimitive=false;
  if(c.opcode===0x20)color=c.parameterWords[0]&32767;
  if(c.opcode===0x21){if(!inPrimitive)throw Error('NORMAL before BEGIN requires prior applied material state');color=material.specularEmission>>>16&32767;normalCommands++;}
  atCommand.set(i,color);
 }
 return {atCommand,finalColor:color,normalCommands};
}
export function applyAutomaticMaterialEnvironment(project,record,automatic){
 const environment=readAutomaticMaterialEnvironment(project,record,automatic);
 if(!environment.ready)return {...automatic,environment,environmentApplied:false};
 const maskBytes=project.sdk.read(0x020e934c,32),md=new DataView(maskBytes.buffer,maskBytes.byteOffset,maskBytes.byteLength),masks=Array.from({length:8},(_,i)=>md.getUint32(i*4,true)),normalDraws=[];
 try{
  const scenes=automatic.scenes.map(scene=>{const members=project.archive(scene.archiveName);return {...scene,instances:scene.instances.map(instance=>{
   const bytes=members.get(instance.modelName);if(!bytes)throw Error('Scene model identity absent from source archive');const model=readNativeModelInfo(bytes).models[0],sbc=decodeNativeSbc(bytes,model),shapes=readNativeShapes(bytes,model);
   if(sbc.unresolved.length||!sbc.terminated)throw Error('Unresolved SBC color replay');
   const byOffset=new Map(instance.draws.map(d=>[d.sbcOffset,d])),bindings=new Map(instance.draws.map(d=>[d.materialIndex,d.textureBinding])),draws=[];let color=null,material=null,visible=true;
   for(const c of sbc.commands){if(c.opcode===1)break;if(c.opcode===2)visible=c.nodeVisibility.visible;
    if(c.opcode===4){const binding=bindings.get(c.materialIndex);material=binding?deriveNativeMaterialResult(binding.material,environment.materialGlobals,masks):null;if(material?.diffuseAmbient&0x8000)color=material.diffuseAmbient&32767;}
    if(c.opcode!==5||!visible)continue;const draw=byOffset.get(c.offset);if(!draw)throw Error('Missing source draw in environment replay');if(!material)throw Error('Missing bound material for environment replay');
    const shape=shapes[c.shape.index],gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes);if(gx.unresolved.length)throw Error('Unresolved GX in environment replay');
    const local=decodeLocalVertices(gx.commands);if(local.unresolved.length||local.vertices.length!==draw.vertices.length)throw Error('Source vertex/color correspondence unresolved');
    const applied=replayZeroLightShapeColors(gx,material,color);color=applied.finalColor;
    const vertices=draw.vertices.map((v,i)=>({...v,color555:applied.atCommand.get(local.vertices[i].command)}));
    const normalLightingApplied=applied.normalCommands>0;
    if(normalLightingApplied)normalDraws.push({archive:scene.archiveName,instanceId:instance.id,model:instance.modelName,shapeIndex:shape.index,normalCommands:applied.normalCommands,emission555:material.specularEmission>>>16&32767});
    draws.push({...draw,vertices,normalLightingApplied,normalLightingSource:normalLightingApplied?environment.normalLighting:null});
   }
   if(draws.length!==instance.draws.length)throw Error('Environment replay draw count differs');return {...instance,draws};
  })};});
  return {...automatic,scenes,environment,environmentApplied:true,environmentNormalDraws:normalDraws,scope:automatic.scope+' ROM initial ordinary environment applied; no live/animated light or native pixel acceptance.'};
 }catch(e){return {...automatic,environment:{...environment,ready:false,unresolved:[...environment.unresolved,e.message]},environmentApplied:false};}
}
