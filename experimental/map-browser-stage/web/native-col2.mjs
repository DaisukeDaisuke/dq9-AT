// Structural COL2 reader from native loader0204cd64 and candidate consumer0204ce50.
// Does not perform ground-height selection or claim that collision faces are visible.
export function readNativeCol2(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<60)throw Error('COL2 header required');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u=o=>d.getUint32(o,true),version=u(0),shift=u(4)&255;
 if(version!==3)throw Error('Only observed COL2 version3 accepted');
 if(shift>30)throw Error('COL2 shift outside accepted signed-coordinate subset');
 const offsets=[u(0x24),u(0x28),u(0x2c),u(0x30),u(0x38)];
 if(offsets.some((o,i)=>o<60||o>bytes.length||(i&&o<offsets[i-1])))throw Error('COL2 offsets outside ordered spans');
 const recordBytes=offsets[1]-offsets[0];if(recordBytes%28)throw Error('Unresolved COL2 record padding');
 const columns=u(0x1c),rows=u(0x20),cells=columns*rows+Math.floor(rows/2);
 if(!Number.isSafeInteger(cells)||cells>offsets[2]-offsets[1]||cells*2>offsets[3]-offsets[2])throw Error('COL2 cell tables too short');
 const count=recordBytes/28,records=Array.from({length:count},(_,index)=>{
  const at=offsets[0]+index*28,triplets=Array.from({length:4},(_,v)=>Array.from({length:3},(_,k)=>d.getInt16(at+v*6+k*2,true)));
  return {index,sourceOffset:at,tripletsQuantized:triplets,verticesQuantized:triplets.slice(0,3),normalFx:triplets[3],packedBoundsIndices:[d.getUint8(at+24),d.getUint8(at+25),d.getUint8(at+26)],rawFlags:d.getUint8(at+27),surfaceAttribute:d.getUint8(at+27)>>>1};
 });
 const grid=Array.from({length:cells},(_,index)=>{
  const n=d.getUint8(offsets[1]+index),start=d.getUint16(offsets[2]+index*2,true),at=offsets[3]+start*2;
  if(at+n*2>offsets[4])throw Error('COL2 referenced-index span overflow');
  const indices=Array.from({length:n},(_,k)=>d.getUint16(at+k*2,true));if(indices.some(i=>i>=count))throw Error('COL2 polygon index out of bounds');return {index,start,indices};
 });
 const bounds={min:Array.from({length:3},(_,i)=>d.getInt16(8+i*2,true)),max:Array.from({length:3},(_,i)=>d.getInt16(14+i*2,true))};
 return {version,shift,columns,rows,cells,bounds,records,grid,offsets,version3ExtraBytes:bytes.length-offsets[4],scope:'Native structural records and grid references only. 02030cc0/02030df4 consume three vertices plus a normal; only vertices receive instance scale. Native field selection/instance transform still require verification. Height, ray intersection, walkability and visible rendering not implemented.'};
}
