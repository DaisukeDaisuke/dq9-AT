// Pure source-bound decoding. No historical table, place names or runtime snapshot inputs.
const uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
export function decodeEncounterStream(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<16)throw Error('Expected complete byte stream');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u32=o=>v.getUint32(o,true),u16=o=>v.getUint16(o,true);
 const count=u32(0),poolOffset=u32(4),poolBytes=u32(8),version=u32(12);
 if(count>100000||poolOffset<16||poolOffset>bytes.length||poolBytes>bytes.length-poolOffset||version!==2)throw Error('Unsupported or malformed stream header');
 const calls=[];let p=16;
 for(let index=0;index<count;index++){
  if(p+4>poolOffset)throw Error('Truncated call header');
  const opcode=u16(p),n=bytes[p+2],typeBytes=Math.ceil(n/4),header=(3+typeBytes+3)&~3,end=p+header+n*4;
  if(end>poolOffset)throw Error('Call overruns argument region');
  const args=[];
  for(let i=0;i<n;i++){
   const type=(bytes[p+3+(i>>2)]>>((i%4)*2))&3,raw=u32(p+header+i*4);let value;
   if(type===1)value=raw|0;
   else if(type===2){value=v.getFloat32(p+header+i*4,true);if(!Number.isFinite(value))throw Error('Non-finite argument');}
   else if(type===0){if(raw>=poolBytes)throw Error('String outside pool');let e=poolOffset+raw;while(e<poolOffset+poolBytes&&bytes[e]!==0)e++;if(e===poolOffset+poolBytes)throw Error('Unterminated string');value=new TextDecoder('shift_jis').decode(bytes.subarray(poolOffset+raw,e));}
   else throw Error('Unsupported argument type');
   args.push({type,raw,value});
  }
  calls.push({index,offset:p,opcode,args});p=end;
 }
 const groups=[],tables=[],ids=new Set(),commands=[];let group=null,table=null;
 const shape=(c,types)=>{if(c.args.length!==types.length||c.args.some((a,i)=>!(Array.isArray(types[i])?types[i]:[types[i]]).includes(a.type)))throw Error('Unsupported argument shape for opcode '+c.opcode);};
 const finish=()=>{if(table&&table.flagsRaw===null)throw Error('Missing table flags');};
 for(const c of calls){
  if(c.opcode===100||c.opcode===101){shape(c,[0]);if(groups.length)throw Error('Late stream command');commands.push({opcode:c.opcode,value:c.args[0].value,offset:c.offset});}
  else if(c.opcode===105){shape(c,[1,1,1,1,1]);finish();group={mapId:c.args[0].value,conditions:c.args.slice(1).map(a=>a.value),sourceOffset:c.offset,tableIds:[]};groups.push(group);table=null;}
  else if(c.opcode===104){shape(c,[1]);finish();const id=c.args[0].value;if(!group||id<0||id>65535||ids.has(id))throw Error('Missing map, invalid or duplicate table ID');ids.add(id);table={tableId:id,sourceOffset:c.offset,mapGroupIndex:groups.length-1,flagsRaw:null,rows:[]};tables.push(table);group.tableIds.push(id);}
  else if(c.opcode===102){shape(c,[1]);if(!table||table.flagsRaw!==null||table.rows.length)throw Error('Missing table or duplicate/late flags');table.flagsRaw=c.args[0].raw;table.flagsSourceOffset=c.offset;}
  else if(c.opcode===103){shape(c,[1,[1,2]]);if(!table||table.flagsRaw===null||table.rows.length===65535)throw Error('Missing table flags or unsupported row count');const packedRaw=c.args[0].raw;if(!uint(packedRaw)||packedRaw>65535)throw Error('Row is not a native unsigned halfword');const speciesId=packedRaw&0xfff,weight=(packedRaw&0x7fff)>>>12;table.rows.push({sourceOffset:c.offset,packedRaw,speciesId,weight,isTrapSpecies:[0x26,0x27,0x28].includes(speciesId),scaleArgument:{...c.args[1]}});}
  else throw Error('Unsupported encounter opcode '+c.opcode);
 }
 finish();
 for(const t of tables){let sum=0;for(const row of t.rows){row.start=sum;sum+=row.weight;row.end=sum-1;}t.totalWeight=sum;t.rowCount=t.rows.length;}
 return {format:'jp-encfld-rom-decoding',version:1,sourceHeader:{count,poolOffset,poolBytes,version,callEnd:p},commands,groups,tables,summary:{groups:groups.length,mapCount:new Set(groups.map(g=>g.mapId)).size,tables:tables.length,rows:tables.reduce((n,t)=>n+t.rows.length,0),speciesCount:new Set(tables.flatMap(t=>t.rows.map(r=>r.speciesId))).size},qualification:{weights:'Raw native integer weights, not a uniform15-bit-output probability or successful-spawn probability',trapClassification:'Species0x26/0x27/0x28 require existing special spawn behavior; classification does not resolve that behavior',mapContext:'Ordered raw map/table bindings and condition words only, not warp adjacency or place-name proof',scale:'Source argument preserved; runtime conversion is outside this decoder'}};
}
