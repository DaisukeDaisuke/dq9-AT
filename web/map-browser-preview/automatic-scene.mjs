import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {planRomScene} from './rom-scene-plan.mjs';
// Load scene inputs from ROM only. Unsupported state stays explicit, never white-filled.
export function loadAutomaticScene(project,record){
 const plan=planRomScene(project,record),resources=[],cache=new Map();
 for(const t of plan.textures){
  let z=cache.get(t.archive);if(!z){z=Narc.load(new Uint8Array(project.nfs.readFile('data/map/'+t.archive)));cache.set(t.archive,z);}
  if(z.fnt.getFilenameOf(t.archiveIndex)!==t.member)throw Error('AMBL member/order changed');
  const raw=z.files[t.archiveIndex],bytes=raw[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(raw.buffer,raw.byteOffset,raw.length))):raw;
  resources.push({name:t.archive+'/'+t.member,bytes});
 }
 const rawMasks=project.sdk.read(0x020e934c,32),md=new DataView(rawMasks.buffer,rawMasks.byteOffset,rawMasks.byteLength),masks=Array.from({length:8},(_,i)=>md.getUint32(i*4,true));
 const materialColor=(m,prior)=>{const mask=masks[m.flags>>>6&7];if(!(mask&0x8000))throw Error('Material color-set bit depends on unresolved runtime global');if(!(m.diffuseAmbient&0x8000))return prior;if((mask&0x7fff)!==0x7fff)throw Error('Material RGB depends on unresolved runtime global');return m.diffuseAmbient&0x7fff;};
 const scenes=[],unresolved=plan.unresolved.slice();
 for(const stream of plan.streams){
  if(stream.nativePositionFx.some(x=>x!==0)){unresolved.push({stream,reason:'Nonzero chunk transform propagation is not connected'});continue;}
  try{const scene=project.scene(stream.archive,stream.member,{textureResources:resources,materialColor});scenes.push({...scene,chunkId:stream.chunkId});}
  catch(e){unresolved.push({stream,reason:e.message});}
 }
 return {plan,scenes,unresolved,masks,scope:'ROM-derived scene and independent texture/palette bindings. Not a camera, lighting, full-map visibility, or pixel-parity acceptance.'};
}
