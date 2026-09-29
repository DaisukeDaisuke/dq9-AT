// @script-id dq9_at_field_observer
// Read-only, explicit snapshots. No per-frame callback or input/seed mutation.
// Registry/field offsets reused from enc_jp.lua; region/table loops checked against Ghidra.
const REG=0x020f33d8;
const hex=n=>'0x'+(n>>>0).toString(16).padStart(8,'0');
const bytes=async(address,length)=>{const r=await mcp.call('dumpMemory',{cpu:'arm9',address,length,view:'bytes'});if(!r.bytes||r.bytes.length!==length)throw Error('Incomplete memory read '+hex(address));return new Uint8Array(r.bytes);};
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
const ram=p=>p>=0x02000000&&p<0x02400000;
async function snapshot(params,context){
 if(!context.blocking)throw Error('Snapshot requires blocking:true');
 const registry=await bytes(REG,0x470),v=view(registry),map=view(await bytes(0x020fb11c,112));
 const active=(await bytes(REG+0x371c,1))[0],at=view(await bytes(0x020eee90,4)).getUint32(0,true),time=view(await bytes(0x0210790c,4)).getUint32(0,true);
 const playerPointer=active<0xe9?v.getUint32(8+active*4,true):0;
 let player=null,region=null,areaMask=0;
 if(ram(playerPointer)){
  const b=await bytes(playerPointer,0x118),p=view(b),packed=p.getUint16(0x114,true);
  const locationCode=((packed&31)*100+0x7530+((packed&0x3e0)>>5)*10+((packed&0x7c00)>>10))&65535;
  player={pointer:hex(playerPointer),activeIndex:active,packedLocation:packed,locationCode,positionRaw:[p.getInt32(0x44,true),p.getInt32(0x48,true),p.getInt32(0x4c,true)]};
  const ptr=v.getUint32(0x468,true),count=v.getUint32(0x46c,true);
  if(count>4096)throw Error('Region count outside bounded observer capacity');
  if(ram(ptr)&&count){const rows=await bytes(ptr,count*16),rv=view(rows);for(let i=0;i<count;i++)if(rv.getUint16(i*16,true)===locationCode){const flags=rows[i*16+14],index=(flags>>2)&15;areaMask=index===8?0:1<<index;region={row:i,pointer:hex(ptr+i*16),flags,index,areaMask};break;}}
 }
 const tb=await bytes(0x020fdb08,0xc4),tv=view(tb),count=tv.getUint32(0xc0,true),tables=[];let selectedTable=null;
 if(count>6)throw Error('Encounter row count exceeds observed context capacity');
 for(let i=0;i<count;i++){const flags=tv.getUint32(i*32+4,true),row={row:i,pointer:hex(0x020fdb08+i*32),tableId:tv.getUint16(i*32,true),flags,timeMode:flags&7,areaMask:(flags>>>13)&255,maxSpawns:(flags>>>10)&7};row.matches=((time===0?1:0)===row.timeMode||row.timeMode===2)&&!!(areaMask&row.areaMask);tables.push(row);if(row.matches&&!selectedTable)selectedTable=row;}
 const monsters=[];let nonzeroSlots=0;
 for(let i=0;i<48;i++){const ptr=v.getUint32(8+(i+0x70)*4,true);if(!ptr)continue;nonzeroSlots++;if(!ram(ptr))throw Error('Unexpected monster pointer '+hex(ptr));const b=await bytes(ptr,0x16c),mv=view(b),spawnId=mv.getUint16(0x16a,true);if(!spawnId)continue;monsters.push({slot:i,registryIndex:i+0x70,pointer:hex(ptr),monsterId:mv.getUint16(2,true),spawnTableId:mv.getUint16(0x168,true),spawnId,coordinateComponents:[0x44,0x4c,0x54].map(offset=>({offset,low:mv.getUint16(offset,true),high:mv.getUint16(offset+2,true),raw:mv.getInt32(offset,true)}))});}
 return {format:'dq9-at-field-observation',version:1,label:params?.label||null,mapId:map.getUint16(0,true),previousMapId:map.getUint16(2,true),parentMapId:map.getUint16(4,true),at,atHex:hex(at),player,region,timeArgument:time,tables,selectedTable,monsterSlots:{capacity:48,nonzero:nonzeroSlots,active:monsters.length},monsters,proofStatus:'snapshot-only-not-boot-origin-proof'};
}
return [{name:'dq9FieldSnapshot',description:'Read paused DQ9 map, area mask, time-selected encounter table, AT and field monsters without writes.',handler:snapshot}];
