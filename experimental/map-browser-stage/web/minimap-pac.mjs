// DQ9 minimapt PAC: member records, not a NARC archive.
// Layout established from actual-ROM mapt_001/002/003.pac; see docs/mining/PAC_FORMAT.md.
const u16=(b,p)=>b[p]|b[p+1]<<8;
const u32=(b,p)=>(b[p]|b[p+1]<<8|b[p+2]<<16|b[p+3]<<24)>>>0;
const ascii=b=>new TextDecoder('ascii').decode(b);
export function parseMinimapPac(bytes){
 const members=[];let offset=0;
 while(offset+80<=bytes.length&&bytes[offset]!==0){
  if(members.length>=4096)throw Error('PAC member count exceeds limit');
  let end=offset;while(end<offset+64&&bytes[end])end++;
  const name=ascii(bytes.subarray(offset,end)),relative=u32(bytes,offset+64),size=u32(bytes,offset+68),span=u32(bytes,offset+72);
  if(relative<80||span<relative||size>span-relative||offset+span>bytes.length)throw Error(`Invalid PAC member ${name}`);
  const data=bytes.subarray(offset+relative,offset+relative+size);
  members.push({name,offset,dataOffset:offset+relative,size,span,magic:ascii(data.subarray(0,4)),data});offset+=span;
 }
 const char=members.find(m=>m.magic==='CHAR'),pal=members.find(m=>m.magic==='PALT'),scr=members.find(m=>m.magic==='SCRN');
 if(!char||!pal||!scr)throw Error('PAC requires CHAR/PALT/SCRN');
 if(char.size<16||pal.size<12||scr.size<16)throw Error('Truncated PAC image header');
 const widthTiles=u16(scr.data,4),heightTiles=u16(scr.data,6),tileCount=u16(char.data,4),tileSize=u32(char.data,12),paletteSize=u32(pal.data,8),mapSize=u32(scr.data,12);
 const stride=tileCount?tileSize/tileCount:0,bpp=stride===32?4:stride===64?8:0;
 if(!widthTiles||!heightTiles||!bpp||tileSize>char.size-16||paletteSize>pal.size-12||mapSize>scr.size-16||mapSize<widthTiles*heightTiles*2)throw Error('Unsupported PAC image dimensions');
 return {width:widthTiles*8,height:heightTiles*8,widthTiles,heightTiles,bpp,tileCount,tiles:char.data.subarray(16,16+tileSize),palette:pal.data.subarray(12,12+paletteSize),tilemap:scr.data.subarray(16,16+mapSize),members};
}
export function pacInfo(bytes){const p=parseMinimapPac(bytes);return {format:'PAC',width:p.width,height:p.height,bpp:p.bpp,tileCount:p.tileCount,size:bytes.length,members:p.members.map(({data,...m})=>m)};}
