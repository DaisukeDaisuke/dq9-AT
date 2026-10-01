import {parseMinimapPac,pacInfo} from './minimap-pac.mjs';
import {NitroFS} from './vendor/nitro-fs.mjs';
import {mineFieldGraphs,bindFieldGraphs} from './field-graph.mjs';
import {decodeEncounterContexts,contextsForMap,ENCOUNTER_CONTEXT_PATH} from './encounter-context.mjs';
import './vendor/gp2.js';
import {parseCalls,decodeNumber,readPoolString,decodeMapRecords,u32} from './vendor/call-stream.mjs';

export function parseCSV(text) {
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(cell||row.length){row.push(cell);rows.push(row);}const headers=rows.shift()||[];
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h.replace(/^\uFEFF/,''),r[i]??''])));
}
export function decodeCalls(bytes) {
 if(bytes.length<16)throw Error('Truncated call stream');
 const pool=u32(bytes,4);if(pool>bytes.length||u32(bytes,0)>100000)throw Error('Invalid call stream');
 return parseCalls(bytes).map(c=>({...c,values:c.args.map(a=>a.type===0?readPoolString(bytes,pool,a):decodeNumber(a))}));
}
export function decodeBmmp(entry) {
 const calls=decodeCalls(entry.data),layers=[],placements=[],mapBindings=[],groups=[];let origin=[0,0],scale=null,base='T99MAP01';
 for(const c of calls){const a=c.values;
  switch(c.opcode){
   case 0x64:origin=a.slice(0,2);break;
   case 0x66:layers.push({id:a[0],name:a[1],path:a[1]+'.obg',callOffset:c.offset});break;
   case 0x68:placements.push({id:a[0],layerId:a[1],tileX:a[2],tileY:a[3],callOffset:c.offset});break;
   case 0x69:scale=a[0];break;
   case 0x6a:base=a[0];break;
   case 0x6b:groups.push({kind:'map-id-list',mapIds:a,callOffset:c.offset});break;
   case 0x6c:groups.push({kind:'coordinate-map-id-list',x:a[0],z:a[1],mapIds:a.slice(2),callOffset:c.offset});break;
   case 0x70:for(let i=0;i+1<a.length;i+=2)mapBindings.push({mapId:a[i],resource:a[i+1],callOffset:c.offset});break;
  }
 }
 return {path:entry.path,originTile:origin,worldToMapScale:scale,background:base,layers,placements,mapBindings,groups,groupOrder:'source-order-prepended',calls};
}
export function obgInfo(data) {
 if(data.length<8)throw Error('OBG header truncated');const width=data[0]*8,height=data[1]*8,depth=data[2],tileCount=u32(data,4);
 const tileBytes=depth===0?32:depth===1?64:0,paletteBytes=depth===0?32:512;
 if(!width||!height||!tileBytes)throw Error('Unsupported OBG header');
 const expected=8+paletteBytes+tileCount*tileBytes+width*height/32;
 if(expected>data.length)throw Error('OBG payload truncated');
 return {width,height,bpp:depth?8:4,tileCount,size:data.length,tileOffset:8+paletteBytes,mapOffset:8+paletteBytes+tileCount*tileBytes};
}
export class MapProject {
 constructor(buffer,csvText,onProgress=()=>{}) {
  onProgress('NDSファイルシステム');const fs=NitroFS.fromRom(buffer);this.header=fs.cartridgeHeader;this.nitro=fs;
  if(this.header.gameCode!=='YDQJ')throw Error(`日本語版DQ9 (YDQJ) が必要です。投入: ${this.header.gameCode}`);
  this.assets=new Map();this.descriptors=new Map();this.errors=[];this.archives=[];
  for(const path of ['data/pack_lv5/minimap.gp2','data/pack_lv5/minimapt.gp2']){
   onProgress(path);const entries=globalThis.NdsFontGp2.parseGp2(new Uint8Array(fs.readFile(path)));
   this.archives.push({path,entries:entries.length,size:fs.readFile(path).byteLength});
   for(const e of entries){const key=path+'::'+e.path,asset={...e,key,archive:path};
    if(e.path.endsWith('.obg')){try{asset.info=obgInfo(e.data);}catch(error){asset.error=error.message;this.errors.push({key,error:error.message});}}
    if(e.path.endsWith('.pac')){try{asset.info=pacInfo(e.data);}catch(error){asset.error=error.message;this.errors.push({key,error:error.message});}}
    if(e.path.endsWith('.bmmp')){try{const d=decodeBmmp(e);d.key=key;d.archive=path;this.descriptors.set(e.path,d);}catch(error){asset.error=error.message;this.errors.push({key,error:error.message});}}
    this.assets.set(key,asset);
   }
  }
  onProgress('マップ構造と既存CSVを結合');const b=new Uint8Array(fs.readFile('data/map/maplist9.bin'));
  const records=decodeMapRecords(b,parseCalls(b));const names=new Map(parseCSV(csvText).map(r=>[Number(r.mapId),r.nameJa]));
  this.records=records.map(r=>{
   const exact=this.descriptors.get(r.fieldCode+'.bmmp');const candidates=[];
   if(exact)candidates.push({path:exact.path,relation:'field-code'});
   for(const d of this.descriptors.values()){
    if(d.mapBindings.some(x=>x.mapId===r.mapId)&&!candidates.some(x=>x.path===d.path))candidates.push({path:d.path,relation:'bmmp-map-binding'});
    else if(d.groups.some(g=>g.kind==='map-id-list'&&g.mapIds.includes(r.mapId))&&!candidates.some(x=>x.path===d.path))candidates.push({path:d.path,relation:'bmmp-map-group'});
   }
   return {key:'map:'+r.callIndex,mapId:r.mapId,mapIdHex:'0x'+(r.mapId&65535).toString(16).padStart(4,'0'),name:names.get(r.mapId)||r.resource0||'',nameSource:names.has(r.mapId)?'existing-map-id-names.csv':'maplist9:arg2',secondaryId:r.secondaryId,fieldCode:r.fieldCode,internalLabel:r.resource1,modelResource:r.rawArgs[11]?.string??null,candidates,areaStatus:'encounter-area-unresolved',encounterTableId:null,source:{path:'data/map/maplist9.bin',callIndex:r.callIndex,callOffset:r.callOffset},rawArgs:r.rawArgs};
  });
  this.fieldGraphs=mineFieldGraphs(fs,decodeCalls,onProgress);bindFieldGraphs(this.records,this.fieldGraphs);
  this.encounterContexts=decodeEncounterContexts(decodeCalls(new Uint8Array(fs.readFile(ENCOUNTER_CONTEXT_PATH))));
  for(const record of this.records){record.encounterContexts=contextsForMap(this.encounterContexts,record.mapId);record.areaStatus=record.encounterContexts.length?'node-area-and-time-table-candidates':'no-static-encounter-context';}
  this.errors.push(...this.fieldGraphs.errors,...this.encounterContexts.warnings);
 }
 getAsset(name,archive='data/pack_lv5/minimap.gp2'){return this.assets.get(archive+'::'+name);}
 metadata(){return {format:'dq9-at-map-metadata',version:1,rom:this.header,archives:this.archives,summary:{records:this.records.length,descriptors:this.descriptors.size,images:[...this.assets.values()].filter(a=>a.path.endsWith('.obg')&&a.info).length,pacImages:[...this.assets.values()].filter(a=>a.path.endsWith('.pac')&&a.info).length,packs:[...this.assets.values()].filter(a=>a.path.endsWith('.pac')).length,recordsWithMap:this.records.filter(r=>r.candidates.length).length,fieldGraphs:this.fieldGraphs.summary,recordsWithFieldGraph:this.records.filter(r=>r.fieldGraph.key).length,encounterContexts:this.encounterContexts.summary},fieldGraphs:this.fieldGraphs,encounterContexts:this.encounterContexts,records:this.records,descriptors:[...this.descriptors.values()],assets:[...this.assets.values()].map(({key,path,archive,data,info,error})=>({key,path,archive,size:data.length,info,error})),errors:this.errors,limitations:['Static monster path graph is not a player walkmesh; generated grotto graphs remain separate.','Natural table candidates use node area and time, not a fixed map-to-table mapping.','Map-browser selection is not a video observation; AT boot proof and continuous navigation remain separate checkpoints.']};}
}
export class MapRenderer {
 constructor(instance){this.e=instance.exports;this.heap=Number(this.e.__heap_base.value);this.cursor=this.heap;}
 reset(){this.cursor=this.heap;}
 alloc(size){const p=this.cursor;this.cursor=(p+size+15)&~15;if(this.cursor>this.e.memory.buffer.byteLength)this.e.memory.grow(Math.ceil((this.cursor-this.e.memory.buffer.byteLength)/65536));return p;}
 put(bytes){const p=this.alloc(bytes.length);new Uint8Array(this.e.memory.buffer,p,bytes.length).set(bytes);return p;}
 decode(data,transparent=true){this.reset();const info=obgInfo(data),src=this.put(data),out=this.alloc(info.width*info.height*4);const rc=this.e.obg_decode(src,data.length,out,info.width*info.height*4,transparent?1:0);if(rc<0)throw Error(`OBG decode error ${rc}`);return {...info,rgba:new Uint8ClampedArray(this.e.memory.buffer,out,rc).slice()};}
 decodeAsset(asset,transparent=true){return asset.path.endsWith('.pac')?this.decodePac(asset.data):this.decode(asset.data,transparent);}
 decodePac(bytes){this.reset();const p=parseMinimapPac(bytes),tiles=this.put(p.tiles),pal=this.put(p.palette),map=this.put(p.tilemap),out=this.alloc(p.width*p.height*4);const rc=this.e.tiles_decode(tiles,p.tiles.length,pal,p.palette.length,map,p.tilemap.length,p.widthTiles,p.heightTiles,p.bpp,out,p.width*p.height*4);if(rc<0)throw Error(`PAC decode error ${rc}`);return {width:p.width,height:p.height,bpp:p.bpp,format:'PAC',rgba:new Uint8ClampedArray(this.e.memory.buffer,out,rc).slice()};}
 compose(project,path){const d=project.descriptors.get(path);if(!d)throw Error('配置がありません');const decoded=new Map();
  const parts=d.placements.map(p=>{const l=d.layers.find(l=>l.id===p.layerId);if(!l)throw Error(`layer ${p.layerId} がありません`);let image=decoded.get(l.path);if(!image){const a=project.getAsset(l.path);if(!a)throw Error(`画像 ${l.path} がありません`);image=this.decode(a.data);decoded.set(l.path,image);}return {...p,path:l.path,x:p.tileX*8,y:p.tileY*8,image};});
  if(!parts.length)throw Error('この配置には通常OBG layerがありません');
  const minX=Math.min(...parts.map(p=>p.x)),minY=Math.min(...parts.map(p=>p.y)),maxX=Math.max(...parts.map(p=>p.x+p.image.width)),maxY=Math.max(...parts.map(p=>p.y+p.image.height));
  const width=maxX-minX,height=maxY-minY;if(width<=0||height<=0||width*height>16000000)throw Error('マップ画像の寸法が範囲外');
  this.reset();const out=this.alloc(width*height*4);new Uint8Array(this.e.memory.buffer,out,width*height*4).fill(0);
  for(const p of parts){const src=this.put(p.image.rgba);this.e.blit(out,width,height,src,p.image.width,p.image.height,p.x-minX,p.y-minY);}
  return {width,height,rgba:new Uint8ClampedArray(this.e.memory.buffer,out,width*height*4).slice(),originPixel:[d.originTile[0]*8+minX,d.originTile[1]*8+minY],descriptor:d,parts:parts.map(({image,...p})=>p)};
 }
}
