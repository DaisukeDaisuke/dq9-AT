import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {parseCalls,decodeNumber,readPoolString,u32} from './vendor/call-stream.mjs';
import {readArchiveRequestRules,nativeArchiveRequest} from './native-archive-request.mjs';
import {decodeBmblChunk,matchNativeChunkStreams} from './native-bmbl-chunks.mjs';
function amblRules(sdk){
 const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const text=a=>{const b=sdk.read(a,80),n=b.indexOf(0);if(n<0||b.subarray(0,n).some(x=>x>127))throw Error('Native archive literal invalid');return new TextDecoder().decode(b.subarray(0,n));};
 const base=readArchiveRequestRules(sdk);
 return {...base,dualMapId:-1000,directory:text(word(0x02013ec8)),formats:{ordinary:text(word(0x02013ed0)),grotto:text(word(0x02013ec4)),other:text(word(0x02013ecc))}};
}
export function planRomScene(project,record,{grottoVariant}={}){
 const request=nativeArchiveRequest({mapId:record.mapId,nativeFieldCode:record.nativeFieldCode,grottoVariant,phase:0},amblRules(project.sdk));
 const plan={recordKey:record.key,mapId:record.mapId,amblRequest:request,textures:[],chunks:[],streams:[],unresolved:[],scope:'Source-derived resource/load plan, not native live-map visibility or completed rendering'};
 if(!request.supported){plan.unresolved.push(request.reason);return plan;}
 const file=request.path.split('/').at(-1);
 if(!project.nfs.readDir('data/map').files.includes(file)){plan.unresolved.push('Requested AMBL absent: '+file);return plan;}
 const z=Narc.load(new Uint8Array(project.nfs.readFile(request.path)));
 for(let i=0;i<z.files.length;i++){
  const name=z.fnt.getFilenameOf(i);
  if(name.toLowerCase().endsWith('.nsbtx'))plan.textures.push({archive:file,member:name,archiveIndex:i});
  if(!name.toLowerCase().endsWith('.bmbl'))continue;
  try{const raw=z.files[i],b=raw[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(raw.buffer,raw.byteOffset,raw.length))):raw,pool=u32(b,4);
   for(const call of parseCalls(b)){const c={...call,args:call.args.map(a=>({...a,value:a.type===0?readPoolString(b,pool,a):decodeNumber(a)}))},chunk=decodeBmblChunk(c);if(chunk){plan.chunks.push({...chunk,archive:file,member:name});if(!chunk.supported)plan.unresolved.push(name+': '+chunk.reason);}}
  }catch(e){plan.unresolved.push(name+': '+e.message);}
 }
 for(const r of record.archiveRequests){
  if(!r.present){plan.unresolved.push('Requested AMDJ absent: '+r.name);continue;}
  const members=project.archive(r.name);
  plan.streams.push(...matchNativeChunkStreams(plan.chunks,[...members.keys()]).map(s=>({...s,archive:r.name})));
 }
 if(!plan.chunks.length)plan.unresolved.push('No BMBL chunks');
 if(!plan.streams.length)plan.unresolved.push('No source-matched BMDJ streams');
 return plan;
}
