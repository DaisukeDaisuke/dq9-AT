import {BufferReader,Compression,TEX0} from './vendor/nitro-fs.mjs';
import {Narc} from './vendor/narc-source.js';
import {parseCSV} from './map-core.mjs';
import './vendor/gp2.js';

export const MONSTER_ARCHIVE='data/pack_lv5/enemy.gp2';
export const MAX_MONSTER_REQUESTS=8;
const MAX_CONTAINER_BYTES=8*1024*1024,MAX_RESULT_BYTES=16*1024*1024;
const reader=b=>new BufferReader(b.buffer,b.byteOffset,b.byteLength);

export function parseMonsterAssetCatalog(csvText){
 const catalog=new Map();
 for(const row of parseCSV(csvText)){
  const modelId=row['Model ID'];
  if(!/^[0-9a-f]{4}$/i.test(row.ID)||!modelId)throw Error('Invalid monster catalogue row');
  if(!catalog.has(modelId))catalog.set(modelId,[]);
  catalog.get(modelId).push({monsterId:parseInt(row.ID,16),idHex:row.ID,nameJa:row.Japanese,nameEn:row.English});
 }
 return catalog;
}

function inspectModel(bytes){
 const r=reader(bytes);
 if(bytes.length<20||r.readChars(0,4)!=='BMD0')throw Error('Selected model is not BMD0');
 const sectionCount=r.readUint16(14),sections=[],textures=[];
 if(sectionCount>16||16+sectionCount*4>bytes.length)throw Error('Invalid model section table');
 for(let i=0;i<sectionCount;i++){
  const offset=r.readUint32(16+i*4);
  if(offset+8>bytes.length)throw Error('Model section outside member');
  const format=r.readChars(offset,4),size=r.readUint32(offset+4);
  if(size<8||offset+size>bytes.length)throw Error('Invalid model section size');
  sections.push({format,offset,size});
  if(format==='TEX0'){
   const tex=new TEX0(r.slice(offset,offset+size));
   textures.push({sectionOffset:offset,
    textures:(tex.textureInfo.entries||[]).map((t,index)=>({index,name:tex.textureInfo.names[index],
     width:t.width,height:t.height,format:t.format,firstColorTransparent:t.firstColorTransparent})),
    palettes:(tex.paletteInfo.entries||[]).map((p,index)=>({index,name:tex.paletteInfo.names[index],offset:p.paletteOffset})),
    materialBinding:'unresolved-no-index-based-palette-assignment'});
  }
 }
 return {sections,textureSections:textures,geometryDecoded:false};
}

// All payloads returned below are independent copies, never views into NitroFS.
// This only resolves exact requested variants; it does not infer field usage.
export function readMonsterAssets(nitro,catalog,requests){
 if(!Array.isArray(requests)||!requests.length||requests.length>MAX_MONSTER_REQUESTS)
  throw Error(`Request 1..${MAX_MONSTER_REQUESTS} explicit monster model variants`);
 const seen=new Set(),selected=requests.map(request=>{
  const {modelId,variant}=request||{};
  if(!catalog.has(modelId))throw Error('Unknown monster model ID: '+modelId);
  if(variant!=='regular'&&variant!=='_f')throw Error('Choose variant regular or _f explicitly');
  const stem=modelId+(variant==='regular'?'':variant),member=stem+'.mon';
  if(seen.has(member))throw Error('Duplicate selected monster variant: '+member);
  seen.add(member);return {modelId,variant,stem,member};
 });
 const archive=new Uint8Array(nitro.readFile(MONSTER_ARCHIVE));
 const members=new Map(globalThis.NdsFontGp2.parseGp2(archive,seen).map(f=>[f.path,f.data]));
 let resultBytes=0;
 const copy=(name,bytes,format)=>{
  if(!bytes||bytes.length<4)throw Error('Missing or truncated selected resource: '+name);
  resultBytes+=bytes.length;if(resultBytes>MAX_RESULT_BYTES)throw Error('Selected monster assets exceed result budget');
  return {name,format,bytes:bytes.slice()};
 };
 const models=selected.map(({modelId,variant,stem,member})=>{
  const outerBytes=members.get(member);
  if(!outerBytes)throw Error('Selected monster variant is unavailable: '+member);
  if(outerBytes.length>MAX_CONTAINER_BYTES)throw Error('Monster container exceeds size budget');
  const outer=Narc.load(outerBytes),compressedName=stem+'.cchr',compressed=outer.getFile(compressedName);
  if(!compressed||compressed.length<4||compressed[0]!==0x10)throw Error('Expected LZ10 .cchr: '+compressedName);
  const expandedBytes=reader(compressed).readUint24(1);
  if(expandedBytes<16||expandedBytes>MAX_CONTAINER_BYTES)throw Error('Invalid expanded monster container size');
  const inner=Narc.load(Compression.decompress(reader(compressed))),modelName=stem+'.nsbmd',modelBytes=inner.getFile(modelName);
  if(!modelBytes)throw Error('Selected model member missing: '+modelName);
  const model={...copy(modelName,modelBytes,'BMD0'),...inspectModel(modelBytes)};
  const animations=[];
  for(let i=0;i<inner.files.length;i++){
   const name=inner.fnt.getFilenameOf(i),bytes=inner.files[i];
   if(!name?.endsWith('.nsbca'))continue;
   if(bytes.length<20||reader(bytes).readChars(0,4)!=='BCA0')throw Error('Invalid selected animation: '+name);
   animations.push(copy(name,bytes,'BCA0'));
  }
  return {modelId,variant,speciesCandidates:catalog.get(modelId).map(row=>({...row})),
   source:{archive:MONSTER_ARCHIVE,archiveMember:member,compressedMember:compressedName,
    compression:'LZ10',variantRole:'unverified-explicit-selection',animationScope:'selected-cchr-only',
    catalogue:'data/monsters.csv',speciesIdEncoding:'hexadecimal-csv-to-decimal'},
   model,animations,innerMembers:inner.files.map((b,i)=>({name:inner.fnt.getFilenameOf(i),size:b.length})),
   fieldVariantConfirmed:false,materialBindingConfirmed:false,animationBindingConfirmed:false};
 });
 return {format:'dq9-monster-assets',version:1,models,payloadBytes:resultBytes,recognitionEvidence:false};
}

export function monsterAssetTransfers(result){
 return result.models.flatMap(({model,animations})=>[model.bytes.buffer,...animations.map(a=>a.bytes.buffer)]);
}
