import {BufferReader,Compression} from './vendor/nitro-fs.mjs';
import {Narc} from './vendor/narc-source.js';
import './vendor/gp2.js';

export const PATH_ARCHIVE='data/pack_lv5/path.gp2';
// overlay_d_17:021b4e7c: format the field code, then replace byte3 with 'P'.
export function fieldPathName(fieldCode){
 const code=String(fieldCode??'');if(!code)return null;
 const name=code.length<6?`${code}P00.bin`:`${code}.bin`;
 return name.slice(0,3)+'P'+name.slice(4);
}
function coordinate(value){
 if(!Number.isFinite(value))throw Error('Non-finite field node coordinate');
 const whole=Math.trunc(Math.fround(Math.fround(value)*4096))>>12;
 return (whole<<16)>>16;
}
export function decodeFieldGraph(calls,source){
 const graph={key:source.pack,path:source.pack,source,nodes:[],edges:[],pairs:[],nodeCapacity:0,edgeCapacity:0,pairCapacity:0,warnings:[],routeSemantics:'monster-navigation-and-spawn-candidates; not certified player walkmesh'};
 const lookup=id=>graph.nodes.findIndex(n=>n.id===(Number(id)&255));
 const edge=(left,right)=>{if(left<0||right<0||left===right)return;if(graph.edges.length>=graph.edgeCapacity){graph.warnings.push('edge-capacity-limit');return;}graph.edges.push([left,right]);};
 const chain=ids=>{let previous=-1;for(const id of ids){const index=lookup(id);if(index<0)continue;edge(previous,index);previous=index;}};
 for(const call of calls){const a=call.values;
  switch(call.opcode){
   case 104:graph.nodes=[];graph.nodeCapacity=Number(a[0])&255;break;
   case 106:graph.edges=[];graph.edgeCapacity=Number(a[0])&255;break;
   case 108:graph.pairs=[];graph.pairCapacity=Number(a[0])&255;break;
   case 100:
    if(a.length!==5)throw Error(`Node opcode100 has ${a.length} arguments`);
    if(graph.nodes.length>=graph.nodeCapacity){graph.warnings.push('node-capacity-limit');break;}
    graph.nodes.push({index:graph.nodes.length,id:Number(a[0])&255,areaMask:Number(a[1])&255,position:a.slice(2,5).map(coordinate),initialFlags:0,neighbors:[],sourceCallOffset:call.offset});break;
   case 101:edge(lookup(a[0]),lookup(a[1]));break;
   case 102:chain(a);break;
   case 103:{const from=Number(a[0]),to=Number(a[1]);if(to-from>65535)throw Error('Node chain range exceeds field ID domain');chain(Array.from({length:Math.max(0,to-from+1)},(_,i)=>from+i));break;}
   case 105:case 107:break;
   case 109:if(graph.pairs.length<graph.pairCapacity)graph.pairs.push([Number(a[0])&65535,Number(a[1])&65535]);else graph.warnings.push('pair-capacity-limit');break;
   default:throw Error(`Unresolved field graph opcode ${call.opcode} at ${call.offset}`);
  }
 }
 for(const node of graph.nodes)for(const [a,b] of graph.edges){if(graph.nodes[a].id===node.id)node.neighbors.push(b);else if(graph.nodes[b].id===node.id)node.neighbors.push(a);}
 graph.allPairsEqual=graph.pairs.every(([a,b])=>a===b);
 graph.nodeCount=graph.nodes.length;graph.edgeCount=graph.edges.length;
 graph.areaMasks=[...new Set(graph.nodes.map(n=>n.areaMask))].sort((a,b)=>a-b);
 graph.warnings=[...new Set(graph.warnings)];
 return graph;
}
export function mineFieldGraphs(nitro,decodeCalls,onProgress=()=>{}){
 const entries=globalThis.NdsFontGp2.parseGp2(new Uint8Array(nitro.readFile(PATH_ARCHIVE))),graphs=[],errors=[];
 for(const entry of entries){
  try{
   const archive=Narc.load(entry.data);let found=false;
   // 0207663c uses the FIRST substring match, not an invented extension priority.
   for(let i=0;i<archive.files.length;i++){const member=archive.fnt.getFilenameOf(i);if(!member.includes('bin'))continue;
    let bytes=archive.files[i],calls,compression='none';
    // An uncompressed stream with 16 calls starts with 0x10 too. Validate the
    // complete existing call-stream header first; a single-byte sniff is ambiguous.
    try{calls=decodeCalls(bytes);}catch(rawError){if(bytes[0]!==0x10)throw rawError;bytes=Compression.decompress(new BufferReader(bytes.buffer,bytes.byteOffset,bytes.byteLength));calls=decodeCalls(bytes);compression='lz10';}
    graphs.push(decodeFieldGraph(calls,{archive:PATH_ARCHIVE,pack:entry.path,member,memberIndex:i,decodedBytes:bytes.length,compression,dispatch:'020ef5e8'}));found=true;break;
   }
   if(!found)errors.push({pack:entry.path,error:'No bin member selected by ROM loader'});
  }catch(error){errors.push({pack:entry.path,error:error.message});}
 }
 onProgress(`フィールド経路 ${graphs.length}/${entries.length}`);
 return {format:'dq9-at-field-graphs',version:1,archive:PATH_ARCHIVE,packCount:entries.length,graphs,errors,summary:{graphs:graphs.length,nodes:graphs.reduce((sum,g)=>sum+g.nodeCount,0),edges:graphs.reduce((sum,g)=>sum+g.edgeCount,0),errors:errors.length},limitations:['Static path.gp2 resources only; generated grotto graphs require their separate runtime construction.','Node flags are runtime state and are not inferred from static coordinates.','No player walkability claim.']};
}
export function bindFieldGraphs(records,mined){
 const index=new Map(mined.graphs.map(g=>[g.path,g]));
 for(const record of records){const requestedPath=fieldPathName(record.fieldCode),graph=index.get(requestedPath);
  record.fieldGraph={requestedPath,key:graph?.key??null,status:record.mapId>=40000&&record.mapId<50000?'procedural-grotto':graph?'static-resource-found':'no-static-resource',nodeCount:graph?.nodeCount??0,areaMasks:graph?.areaMasks??[],binding:'overlay_d_17:021b4e7c-field-code-format'};
 }
 return records;
}
export function compareObservedGraph(graph,observation){
 if(!graph)return {matches:false,reason:'ROM graph missing',mismatches:[]};
 const rows=observation.nodes??observation.fields?.[0]?.nodes??[];
 const mismatches=[];if(rows.length!==graph.nodes.length)mismatches.push({kind:'nodeCount',rom:graph.nodes.length,observed:rows.length});
 for(let i=0;i<rows.length;i++){const row=rows[i],expected=Array.isArray(row)?{index:row[0],id:row[1],areaMask:row[2],position:row.slice(3,6),neighbors:row[6]}:row;
  const actual=graph.nodes[i];if(!actual){mismatches.push({kind:'missingNode',index:i});continue;}
  for(const field of ['index','id','areaMask','position','neighbors'])if(JSON.stringify(actual[field])!==JSON.stringify(expected[field]))mismatches.push({index:i,field,rom:actual[field],observed:expected[field]});
 }
 return {matches:mismatches.length===0,nodeCount:rows.length,orderedAdjacencyChecked:true,fields:['index','id','areaMask','position','neighbors'],mismatches};
}
