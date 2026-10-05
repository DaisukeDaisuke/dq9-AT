// Native0204ce50 candidate order/caps for an explicitly supplied local context.
import{fxDiv}from'./native/native-camera-fx.mjs';
const i32=x=>Number(BigInt.asIntN(32,BigInt(x))),overlap=(a,b)=>a.slice(0,3).every((x,i)=>x>=b[3+i])&&a.slice(3).every((x,i)=>x<=b[i]);
export function collectNativeCol2Candidates(col,{maxFx,minFx,originFx,boundsFx,initialCells}){
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
 if(!vec(maxFx)||!vec(minFx)||!vec(originFx)||!Array.isArray(boundsFx)||boundsFx.length!==6||!boundsFx.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647))throw Error('Explicit native query bounds/origin/context bounds required');
 if(col.gridSpan<=0||col.shift>30)throw Error('Unsupported native grid divisor/shift');
 const query=[...maxFx.map((v,i)=>i32(v-originFx[i])),...minFx.map((v,i)=>i32(v-originFx[i]))];
 if(!overlap(query,boundsFx))return {indices:[],cells:[],reason:'coarse-rejected'};
 const q=query.map(x=>x>>col.shift),cellAt=dist=>Math.trunc(Math.fround(Math.fround(fxDiv(dist,col.gridSpan))/4096));let cells=[];
 if(col.cells<=7){if(!Array.isArray(initialCells)||initialCells.length!==7)throw Error('Native seven-word initial cell table required');cells=initialCells.slice(0,col.cells);}
 else{
  const row=cellAt(i32(Math.trunc(i32(q[2]+q[5])/2)-col.bounds.min[2]));
  if(row>=0&&row<col.rows){const odd=row&1,xmid=Math.trunc(i32(q[0]+q[3])/2),column=cellAt(i32(xmid-col.bounds.min[0]+(odd?Math.trunc(col.gridSpan/2):0)));
   if(column>=0&&column<col.columns+odd){const center=row*col.columns+column+Math.trunc(row/2);cells=[center];
    if(!odd){if(row>0)cells.push(center-col.columns,center-col.columns-1);if(row<col.rows-1)cells.push(center+col.columns,center+col.columns+1);if(column>0)cells.push(center-1);if(column<col.columns-1)cells.push(center+1);}
    else{if(row>0){if(column>0)cells.push(center-col.columns-1);if(column<col.columns)cells.push(center-col.columns);}if(row<col.rows-1){if(column>0)cells.push(center+col.columns);if(column<col.columns)cells.push(center+col.columns+1);}if(column>0)cells.push(center-1);if(column<col.columns)cells.push(center+1);}
   }
  }
 }
 const visited=new Set(),indices=[];let capacityStop=null;
 outer:for(const cell of cells){if(!col.grid[cell])throw Error('Native selected cell outside source table');for(const index of col.grid[cell].indices){const rec=col.records[index];if((rec.rawFlags&1)||visited.has(index))continue;visited.add(index);if(visited.size===192)throw Error('Native visited-cap outer continuation unresolved; reject instead of inventing a safe result');
  const words=rec.tripletsQuantized.flat(),b=rec.packedBoundsIndices,ix=[b[0]&15,b[0]>>>4,b[1]&15,b[1]>>>4,b[2]&15,b[2]>>>4];if(ix.some(x=>x>=12))throw Error('Native record bound-index outside decoded triplets');const lo=ix.slice(0,3).map(x=>words[x]),hi=ix.slice(3).map(x=>words[x]);
  if(overlap([...hi,...lo],q)){indices.push(index);if(indices.length===96){capacityStop='accepted96';break outer;}}
 }}
 return {indices,cells,visitedCount:visited.size,capacityStop,scope:'Native candidate routine subset with explicit context; field instance enumeration/rotation and dynamic input provenance remain separate.'};
}
