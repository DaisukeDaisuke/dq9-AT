import {NitroFS,Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {Narc} from './vendor/narc-source.js';
import {parseCalls,decodeNumber,readPoolString,u32} from './vendor/call-stream.mjs';
import {decodeNativeModel,decodeNativePlacement,deriveNativeWorld,makeNativeTrig} from './native/native-map-records.mjs';
import {readArm9SdkImage} from './rom-arm9.mjs';
import {buildStaticGeometry} from './static-geometry.mjs';
import {bindStaticTextures} from './texture-binding.mjs';
import {nativeAsciiNameCandidates} from './native/native-file-name.mjs';
export function openMapRom(rom){
 const sdk=readArm9SdkImage(rom),nfs=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength)),archives=nfs.readDir('data/map').files.filter(n=>n.endsWith('.amdj'));
 function archive(name){if(!archives.includes(name))throw Error('Exact ROM archive name required');const z=Narc.load(new Uint8Array(nfs.readFile('data/map/'+name))),members=new Map();
  z.files.forEach((b,i)=>{const key=z.fnt.getFilenameOf(i);if(members.has(key))throw Error('Duplicate member name');members.set(key,b[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(b.buffer,b.byteOffset,b.byteLength))):b);});return members;}
 function scene(archiveName,streamName,{textureBytes=null}={}){const members=archive(archiveName),bytes=members.get(streamName);if(!bytes||!streamName.endsWith('.bmdj'))throw Error('Exact placement stream required');const pool=u32(bytes,4),calls=parseCalls(bytes).map(c=>({...c,args:c.args.map(a=>({...a,value:a.type===0?readPoolString(bytes,pool,a):decodeNumber(a)}))}));
  const models=calls.filter(c=>c.opcode===0x6c).map(decodeNativeModel),placements=calls.filter(c=>c.opcode===0x6f).map(c=>decodeNativePlacement(c,4096));
  const trig=makeNativeTrig(sdk.read(0x020e955c,16384),25736),world=deriveNativeWorld(placements,{trig}),byModel=new Map(models.map(m=>[m.id,m])),geometry=new Map(),instances=[],unsupported=[];if(byModel.size!==models.length)throw Error('Duplicate source model IDs require native selection resolution');
  for(let i=0;i<placements.length;i++){const p=placements[i],m=byModel.get(p.modelId);if(!m){unsupported.push({id:p.id,reason:'Missing model reference'});continue;}if(!m.nativeBranch.startsWith('static-model')){unsupported.push({id:p.id,model:m.name,reason:m.nativeBranch});continue;}
   if(p.nativeRotation[0]||p.nativeRotation[2]){unsupported.push({id:p.id,model:m.name,reason:'Pitch/roll placement not integrated'});continue;}
   const dot=m.name.lastIndexOf('.'),requestedName=(dot<0?m.name:m.name.slice(0,dot))+'.nsbmd',matches=nativeAsciiNameCandidates([...members.keys()].map(name=>({name})),requestedName);if(matches.length!==1){unsupported.push({id:p.id,model:m.name,reason:'Native ASCII resource match absent or ambiguous'});continue;}const name=matches[0].name,data=members.get(name);
   try{if(!geometry.has(name))geometry.set(name,buildStaticGeometry(data,sdk.read(0x020e936c,36)));const bindings=textureBytes?bindStaticTextures(data,textureBytes):null;const w=world[i],{sin,cos}=trig(w.yaw);instances.push({id:p.id,modelName:name,nativeFlags:p.nativeFlags,world:w,draws:geometry.get(name).draws.map(d=>({...d,textureBinding:bindings?.[d.materialIndex]??null,vertices:d.vertices.map(v=>{const [x,y,z]=v.position.map((v,k)=>v*w.scale[k]/4096);return {...v,position:[(x*cos+z*sin+w.position[0])/4096,y+w.position[1]/4096,(z*cos-x*sin+w.position[2])/4096]};})}))});}catch(e){unsupported.push({id:p.id,model:m.name,reason:e.message});}
  }
  return {archiveName,streamName,instances,unsupported,placementCount:placements.length,scope:'Static source placement preview only. Runtime visibility/culling/animation/fog absent; texture binding only when explicitly supplied; not whole-map compatibility acceptance.'};
 }
 return {archives,archive,scene,sdk,nfs};
}
