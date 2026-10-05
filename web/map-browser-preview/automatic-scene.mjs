import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {planRomScene} from './rom-scene-plan.mjs';
// This YDQJ loader computes (placement+chunk) into a temporary stack vector,
// never reads it again, then rebuilds the tree from unchanged placement records
// with a zero parent. Code fingerprints guard this specific source path; they
// are not data defaults or a general statement about other chunk formats.
export function readNativeChunkPlacementRule(sdk){
 const regions=[[0x020146cc,0x8c,0x8c14b9eb],[0x02017574,0x2c0,0xf533dad8],[0x02012ed4,0x4c,0x900d1136],[0x0200f238,0x24,0xd2378e32],[0x020c485c,0x34,0x0644f255]];
 for(const [address,length,expected] of regions){let h=2166136261;for(const byte of sdk.read(address,length))h=Math.imul(h^byte,16777619)>>>0;if(h!==expected)throw Error('Native chunk placement path differs at '+address.toString(16));}
 const word=address=>{const b=sdk.read(address,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const zeroByte=word(0x0200f248)&255,rootPositionFx=Array(3).fill((zeroByte*0x01010101)|0),rootYawFx=word(0x02012ef0)&255,scaleAddress=word(0x02012f1c),rootScaleFx=[0,4,8].map(o=>word(scaleAddress+o)|0);
 if(rootPositionFx.some(x=>x!==0)||rootYawFx!==0||rootScaleFx.some(x=>x!==4096))throw Error('Native root initialization outside connected placement equations');
 return {kind:'native-temporary-chunk-sum-discarded',rootPositionFx,rootYawFx,rootScaleFx,
  evidence:{chunkCopy:0x02014710,temporaryAdd:0x02017704,temporaryDestination:0x02017700,treeRebuild:0x02017828,rootInitialization:0x02012ed4},
  scope:'Ordinary static BMDJ instance initialization only. BMBL translation metadata retained but not added to world placement.'};
}
// Load scene inputs from ROM only. Unsupported state stays explicit, never white-filled.
export function loadAutomaticScene(project,record){
 const plan=planRomScene(project,record),chunkPlacementRule=readNativeChunkPlacementRule(project.sdk),resources=[],cache=new Map();
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
  try{const scene=project.scene(stream.archive,stream.member,{textureResources:resources,materialColor});scenes.push({...scene,chunkId:stream.chunkId,chunkPlacement:{sourcePositionFx:stream.nativePositionFx.slice(),rule:chunkPlacementRule.kind,rootPositionFx:chunkPlacementRule.rootPositionFx.slice(),sourceCallIndex:stream.sourceCallIndex,sourceCallOffset:stream.sourceCallOffset}});}
  catch(e){unresolved.push({stream,reason:e.message});}
 }
 return {plan,scenes,unresolved,masks,chunkPlacementRule,scope:'ROM-derived scene and independent texture/palette bindings. Not a camera, lighting, full-map visibility, or pixel-parity acceptance.'};
}
