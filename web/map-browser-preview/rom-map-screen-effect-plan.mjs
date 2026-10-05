// ROM-only request plan for the separate MSE screen-effect layer.
// This is an initial resource plan, not an inferred live animation phase.
import {Narc} from './vendor/narc-source.js';
import {Compression,BufferReader} from './vendor/nitro-fs.mjs';
import {parseCalls,readPoolString,u32} from './vendor/call-stream.mjs';

export function readRomMapScreenEffectPlan(project,scenePlan){
 const result={ready:false,recordKey:scenePlan.recordKey,mapId:scenePlan.mapId,request:null,assignments:[],datMembers:[],unresolved:[],renderReady:false,
  scope:'Source-derived initial AMBL DAT -> context+22 -> MSE request only. Screen-effect drawing uses a separate projection and live accumulated offsets/fade state; none is inferred from video time or static map position.'};
 try{
  const word=a=>{const b=project.sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.length).getUint32(0,true);};
  const expect=(a,w)=>{if(word(a)!==w)throw Error('Map screen-effect source differs at '+a.toString(16));};
  const text=a=>{const b=project.sdk.read(a,80),end=b.indexOf(0);if(end<0||b.subarray(0,end).some(x=>x>127))throw Error('Source ASCII literal unresolved');return new TextDecoder().decode(b.subarray(0,end));};
  for(const[a,w]of[
   [0x020136d4,0xe3a02000],[0x020136dc,0xe5c42016],
   [0x0201403c,0xe59f0110],[0x02014050,0xe1a01004],[0x02014070,0xe28a000c],[0x02014074,0xeb012cdd],
   [0x0205f414,0xe5820004],[0x0205f424,0xe59f1028],
   [0x0205f3c4,0xe1b01000],[0x0205f3c8,0x0a000003],[0x0205f3d0,0xe5900004],[0x0205f3d4,0xe280000a],[0x0205f3d8,0xebfe9299],
   [0x020146a0,0xe1da01d6],[0x020146a4,0xe3500000],[0x020146a8,0x0a000002],[0x020146ac,0xe28a0f45],[0x020146b0,0xe28a1016],[0x020146b4,0xeb019b64],
   [0x0207b454,0xe1a04000],[0x0207b458,0xe1a06001],[0x0207b464,0xe59f106c],[0x0207b46c,0xe1a02006],[0x0207b470,0xebfe21e3]
  ])expect(a,w);
  const suffix=text(word(0x02014154)),format=text(word(0x0207b4d8)),table=word(0x0205f454);
  if(suffix!=='.dat'||format!=='data/map/%s.mse'||word(table+9*8)!==0x6d||word(table+9*8+4)!==0x0205f3bc)throw Error('Native DAT/MSE dispatch/literals differ');
  if(!scenePlan.amblRequest?.supported)throw Error('Source AMBL request unresolved');
  const archivePath=scenePlan.amblRequest.path,archive=Narc.load(new Uint8Array(project.nfs.readFile(archivePath)));let name='';
  for(let archiveIndex=0;archiveIndex<archive.files.length;archiveIndex++){
   const member=archive.fnt.getFilenameOf(archiveIndex),dot=member.indexOf('.');
   if(dot<0||member.slice(dot)!==suffix)continue; // Source strchr + exact extension.
   const raw=archive.files[archiveIndex],bytes=raw[0]===0x10?new Uint8Array(Compression.decompress(new BufferReader(raw.buffer,raw.byteOffset,raw.length))):raw,pool=u32(bytes,4),calls=parseCalls(bytes);
   result.datMembers.push({archivePath,archiveIndex,member,callCount:calls.length});
   for(const call of calls){if(call.opcode!==0x6d)continue;
    if(call.argumentCount!==1||call.args[0]?.type!==0)throw Error('DAT effect-name command outside source string subset');
    const value=readPoolString(bytes,pool,call.args[0]);
    if(value!==null&&(!/^[A-Za-z0-9_]*$/.test(value)||value.length>15))throw Error('Effect-name resource subset or native context capacity unresolved');
    result.assignments.push({archivePath,archiveIndex,member,callIndex:call.index,callOffset:call.offset,value,action:value===null?'native-null-no-write':'overwrite-context-plus-22'});
    if(value!==null)name=value;
   }
  }
  result.source={contextInitialClear:0x020136dc,datLoader:0x02014074,datInterpreter:0x0205f3f0,dispatchTable:table,handler:0x0205f3bc,nameCopy:0x0205f3d8,requestGuard:0x020146a0,requestCall:0x020146b4,requestConstructor:0x0207b44c,format};
  if(name){const path=format.replace('%s',name),file=path.split('/').at(-1),present=project.nfs.readDir('data/map').files.includes(file);result.request={name,path,present};if(!present)result.unresolved.push('Source-requested MSE absent');}
  result.ready=result.unresolved.length===0;
  result.runtimeDependencies=result.request?[
   {field:'effect object +0x11/+0x12/+0x13/+0x14',reason:'Enable/fade flags and current environment-dependent transitions',source:[0x0207baaC,0x0207bfdc,0x0207c07c,0x0207be40]},
   {field:'each layer +0xd0/+0xd4',reason:'Accumulated screen offsets, updated after each executed draw and wrapped by layer dimensions',source:[0x0207bd34,0x0207bd50,0x0207bd68,0x0207bd7c]},
   {field:'current draw order and native depth state',reason:'0207ba90 installs its own orthographic projection and tiled layer positions; cannot append BMDJ world placements',source:[0x0207bb20,0x0207bb30,0x0207bb68,0x0207bbb0,0x0207bcc4,0x0207bd18]}
  ]:[];
 }catch(error){result.unresolved.push(error.message);}
 return result;
}
