// Reuses dq9-AT MIT map-core decoding/composition; assets stay in caller ROM.
import{parseMinimapPac}from'./minimap-pac.mjs';
import './vendor/gp2.js';
import{parseCalls,decodeNumber,readPoolString,u32}from'./vendor/call-stream.mjs';
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

export function minimapProjectFromRom(nfs){
 const entries=globalThis.NdsFontGp2.parseGp2(new Uint8Array(nfs.readFile('data/pack_lv5/minimap.gp2'))),assets=new Map(),descriptors=new Map();
 for(const e of entries){if(assets.has(e.path))throw Error('Duplicate minimap asset');assets.set(e.path,e);if(e.path.endsWith('.bmmp'))descriptors.set(e.path,decodeBmmp(e));}
 return {descriptors,getAsset:name=>assets.get(name)};
}
