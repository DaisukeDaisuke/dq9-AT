import {decodeActorArm9} from './actor-rom-mining.mjs';
import {decodeMapEntryOverlay} from './map-entry-source-binding.mjs';
import {fieldPathName,PATH_ARCHIVE} from './field-graph.mjs';
import {prepareConditionalDestinationLoad,deriveUnconditionalScenarioNPCList} from './map-transition.mjs';
import {readBoundedNarcMembers} from './map-exits.mjs';
import {parseCalls} from './vendor/call-stream.mjs';
const owned=new WeakSet(),copy=structuredClone;
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const ranges=[
 ['pickup-current-code-dispatch','arm9',0x0208fa7c,68,'b34f434b85a084edee944286b1182850a5d8a3cf720d0570924d1608444ca0d4'],
 ['pickup-code-eligibility','arm9',0x0208f134,76,'5a852831c9dcebeb81d8c6226aaed9ade72fe9f22bc41dc4b00017df9234b5fa'],
 ['reset-selected-field','arm9',0x0202821c,140,'bf01f0edb9a0bc9e08debcdf027006f06a106d3fbda3fff60e0986d53a3ed496'],
 ['fresh-uncached-pool-selection','arm9',0x020282ac,332,'ee8b1cd16a0ed009584ed1ecc95288f751b062b0e361baf09e74a2f8d4202510'],
 ['scheduler-inactive-gate','arm9',0x02074568,24,'5832707fd219ef583497464eb224ffce36cf79c9bbb1cd9e7e86a2fb45a55fe5'],
 ['procedural-map-gate','arm9',0x0201b328,40,'dcbe0eba4f45212af37593bdbb70ed69e09ec97c17878c3371193959f0bda2a5'],
 ['ordinary-graph-request','overlay17',0x021b4f00,164,'aaf38d1f2deda31e3edb71211b8abc93b354695e89f6b6a3c58c71710df04765'],
 ['graph-result-active-write','overlay17',0x021b507c,244,'1b7984679f3659548400dc7cddb82b0a4af4244186056fbd1185074c04ad28ff']
];
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export async function createSourceDestinationRuntimeReader({project,catalog,rom,romSHA256}){
 if(!(rom instanceof Uint8Array)||await sha(rom)!==romSHA256||!project?.nfs||!Array.isArray(catalog?.maps))throw Error('Owned ROM/project/catalog required');
 const images={arm9:decodeActorArm9(rom),overlay17:decodeMapEntryOverlay(rom)},source=[];
 for(const[name,image,address,bytes,expected]of ranges){const r=images[image],b=r.bytes.subarray(address-r.base,address-r.base+bytes);if(b.length!==bytes||await sha(b)!==expected)throw Error('Unsupported destination runtime source: '+name);source.push({name,image,address,bytes,sha256:expected});}
 const a=images.arm9,word=address=>new DataView(a.bytes.buffer,a.bytes.byteOffset,a.bytes.byteLength).getUint32(address-a.base,true),low=word(0x0201b34c),high=low+(word(0x0201b334)&255);
 const specialAddress=word(0x0208f17c),start=specialAddress-a.base;let end=start;while(end<a.bytes.length&&end-start<64&&a.bytes[end])end++;if(end>=a.bytes.length||end-start>=64)throw Error('Pickup special code string invalid');const specialCode=new TextDecoder().decode(a.bytes.subarray(start,end)),fieldInitial=String.fromCharCode(word(0x0208f140)&255),maximumFieldCodeLength=word(0x0208f150)&255,specialCompareLength=word(0x0208f164)&255;
 const archiveBytes=new Uint8Array(project.nfs.readFile(PATH_ARCHIVE)),packs=globalThis.NdsFontGp2.parseGp2(archiveBytes),archiveSHA256=await sha(archiveBytes);
 const treasureBytes=new Uint8Array(project.nfs.readFile('data/scenario/treasure.nsarc')),treasureArchive=readBoundedNarcMembers(treasureBytes).archive,treasureHash=await sha(treasureBytes),treasureNames=treasureArchive.files.map((_,i)=>treasureArchive.fnt.getFilenameOf(i).toLowerCase().replace(/\.[^.]+$/,''));
 const d04Bytes=new Uint8Array(project.nfs.readFile('data/scenario/D04.npc')),d04Archive=readBoundedNarcMembers(d04Bytes).archive,d04Hash=await sha(d04Bytes),d04Members=d04Archive.files.map((b,i)=>({name:d04Archive.fnt.getFilenameOf(i),calls:parseCalls(b)}));
 return({fromMapId,recordKey,primitive}={})=>{
  const records=catalog.maps.filter(r=>r.key===recordKey);if(records.length!==1)throw Error('Unique ROM map record required');const r=records[0],path=fieldPathName(r.fieldCode),matching=packs.filter(p=>p.path===path);
  const procedural=r.mapId>=low&&r.mapId<=high,absent=matching.length===0,inactive=absent&&!procedural;
  let load=null,loadError=null;try{load=prepareConditionalDestinationLoad(project,{fromMapId,toMapId:r.mapId,primitive});}catch(error){loadError=error.message;}
  const treasureAbsent=!treasureNames.includes(r.fieldCode.toLowerCase());let npcPlacement=null;if(r.fieldCode==='D04'||r.fieldCode.startsWith('D04M'))npcPlacement={archive:'data/scenario/D04.npc',sha256:d04Hash,...deriveUnconditionalScenarioNPCList(d04Members,{mapId:r.mapId,placeName:'D04place.bin',npcName:'D04npc.bin'})};
  const pickupEligible=(r.fieldCode.startsWith(fieldInitial)&&r.fieldCode.length<=maximumFieldCodeLength)||r.fieldCode.slice(0,specialCompareLength)===specialCode.slice(0,specialCompareLength);
  const conditions=['Destination is not already present in the four-field cache; a free field is selected','Reached 0202821c reset before the ordinary destination graph request','Successful ordinary pool allocation/registration; no alternate procedural graph initialization','Loaded map record and resource names are these exact ROM alternatives','Absent archive lookup does not return a stale successful graph resource','No other writer sets the selected field active byte before the inspected scheduler invocations'];
  const value=freeze({schema:'conditional-source-destination-runtime-v1',romSHA256,record:{recordKey:r.key,mapId:r.mapId,fieldCode:r.fieldCode},source,graphResource:{archive:PATH_ARCHIVE,sha256:archiveSHA256,requestedPath:path,matchingPackCount:matching.length,absenceProven:absent},proceduralMapRange:{lower:low,upper:high,selected:procedural},freshResetConditional:{timer:0,activeByte:0,oldSelectedMapAndActiveByteCleared:true,sourceListsReset:true,poolStorageReuseAndResidualBytesUnknown:true,groupAndPointerUnknown:true,conditions,conditionsMeasured:false},schedulerComponent:{resolvedUnderConditions:inactive,active:inactive?false:null,ATCalls:inactive?{min:'0',max:'0'}:{min:'0',max:null},scope:'Selected field scheduler only; no source update count needed while inactive',notWholeWorldGap:true},pickupComponent:{eligibleUnderCurrentRecord:pickupEligible,ATCalls:pickupEligible?{min:'0',max:null}:{min:'0',max:'0'},sourceRule:{fieldInitial,maximumFieldCodeLength,specialCode,specialCompareLength},scope:'0208fa7c materializer current-code gate before old record/pool reads; not recurring global updater',conditions:['Selected ROM record supplies current map metadata code','Reached the bound ordinary materializer entry'],conditionsMeasured:false},treasureComponent:{archive:'data/scenario/treasure.nsarc',sha256:treasureHash,fieldCode:r.fieldCode,exactMemberStemAbsent:treasureAbsent,ATCalls:treasureAbsent?{min:'0',max:'0'}:{min:'0',max:null},conditions:['Reached ordinary destination-specific treasure member loop; no alternative global treasure consumer included']},npcPlacement,mapLoadSource:load,mapLoadSourceError:loadError,globalAndOtherConsumers:{min:'0',max:null},sourceClockKnown:false,actualEntryCertified:false,currentATRecovered:false,unknownAlternativeRetained:true});owned.add(value);return value;
 };
}
export function projectInactiveDestinationScheduler(proof,scheduler,ATReference){
 if(!owned.has(proof)||!proof.schedulerComponent.resolvedUnderConditions||!ATReference||typeof ATReference!=='object')throw Error('Owned conditional inactive-field proof and symbolic AT reference required');
 let attemptedDraw=false;const facade=Object.create(scheduler);facade.kernel=Object.create(scheduler.kernel);facade.kernel.generate=()=>{attemptedDraw=true;throw Error('Inactive source branch requested AT');};
 const result=facade.step({seed:ATReference,position:0n,timer:proof.freshResetConditional.timer},{active:proof.schedulerComponent.active},{});
 if(!result.resolved||result.consumed!==0||attemptedDraw)throw Error('Existing scheduler contradicts inactive source proof');
 return {schema:'symbolic-destination-scheduler-component-v1',result,ATReference,componentCalls:{min:'0',max:'0'},globalCalls:{min:'0',max:null},conditions:copy(proof.freshResetConditional.conditions),numericSeedSupplied:false,sourceClockSupplied:false,wholeWorldGapResolved:false,currentATRecovered:false};
}
