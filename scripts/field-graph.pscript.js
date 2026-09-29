// @script-id dq9_at_field_graph
// Capture real spawn/monster navigation nodes; no ROM or game state writes.
const read=async(address,length)=>{const r=await mcp.call('dumpMemory',{cpu:'arm9',address,length,view:'bytes'});if(r.bytes?.length!==length)throw Error('Incomplete graph read');return new Uint8Array(r.bytes);};
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
const isRam=p=>p>=0x02000000&&p<0x02400000;
async function graph(params,context){
 if(!context.blocking)throw Error('blocking:true required');const current=view(await read(0x020fb11c,6)).getUint16(0,true),fields=[];
 for(let slot=0;slot<4;slot++){
  const address=0x020fdaac+slot*0x314,bytes=await read(address,40),v=view(bytes),mapId=v.getUint16(0,true),count=bytes[0x16],ptr=v.getUint32(0x18,true);
  if(!mapId||!isRam(ptr)||!count)continue;if(count>255)throw Error('Unexpected node count');
  const data=await read(ptr,count*16),d=view(data),nodes=[];
  for(let i=0;i<count;i++){const o=i*16,n=data[o+2],p=d.getUint32(o+12,true);if(n>255||n&&(!isRam(p)))throw Error('Unexpected adjacency');const adjacency=n?view(await read(p,n*4)):null,neighbors=[];for(let j=0;j<n;j++){const target=adjacency.getUint32(j*4,true);if(target<ptr||target>=ptr+count*16||(target-ptr)%16)throw Error('Neighbor outside node array');neighbors.push((target-ptr)/16);}nodes.push({index:i,id:data[o],areaMask:data[o+1],flags:data[o+3],position:[d.getInt16(o+4,true),d.getInt16(o+6,true),d.getInt16(o+8,true)],neighbors});}
  fields.push({slot,mapId,fieldPointer:address,graphPointer:address+0x14,nodePointer:ptr,count,nodes});
 }
 return {format:'dq9-at-field-graph',version:1,currentMapId:current,source:'actual-paused-ROM-memory',fields,routeSemantics:'monster-navigation-and-spawn-candidates; not certified player walkmesh'};
}
return [{name:'dq9FieldGraph',description:'Read loaded DQ9 field graphs for map/spawn mining without state modification.',handler:graph}];
