// Isolated static geometry adapter. Floating presentation matrices only.
// Rejects unsupported SBC/GX state instead of silently dropping it.
import {readNativeModelInfo,nativeSbcPositionScale} from './native/native-model-info.mjs';
import {readNativeNodes,planNativeNodeMatrices} from './native/native-node-pose.mjs';
import {decodeNativeSbc,readNativeShapes,decodePackedGx,decodeLocalVertices} from './native/native-sbc-gx.mjs';
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a,b)=>Array.from({length:16},(_,k)=>{const r=k%4,c=k>>2;let v=0;for(let j=0;j<4;j++)v+=a[j*4+r]*b[c*4+j];return v;});
function operation(op,p){const m=identity(),v=p.map(x=>x/4096);
 if(op===0x19||op===0x1a){for(let c=0;c<3;c++)for(let r=0;r<3;r++)m[c*4+r]=v[c*3+r];if(op===0x19)for(let r=0;r<3;r++)m[12+r]=v[9+r];}
 else if(op===0x1b){for(let i=0;i<3;i++)m[i*5]=v[i];}
 else if(op===0x1c){for(let i=0;i<3;i++)m[12+i]=v[i];}
 else throw Error('Unsupported matrix operation '+op);return m;
}
const transform=(m,v)=>[0,1,2].map(r=>m[12+r]+v.reduce((s,x,c)=>s+m[c*4+r]*x/4096,0));
function triangles(mode,start,count){const out=[],add=(a,b,c)=>out.push(start+a,start+b,start+c);
 if(mode===0){if(count%3)throw Error('Incomplete triangle list');for(let i=0;i<count;i+=3)add(i,i+1,i+2);}
 else if(mode===1){if(count%4)throw Error('Incomplete quad list');for(let i=0;i<count;i+=4){add(i,i+1,i+2);add(i,i+2,i+3);}}
 else if(mode===2){for(let i=0;i<count-2;i++)i%2?add(i,i+2,i+1):add(i,i+1,i+2);}
 else if(mode===3){if(count%2)throw Error('Incomplete quad strip');for(let i=0;i<count-3;i+=2){add(i,i+1,i+3);add(i,i+3,i+2);}}
 else throw Error('Missing primitive mode');return out;
}
export function buildStaticGeometry(bytes,pivotTable,{modelIndex=0,defaultColor555=null}={}){
 const model=readNativeModelInfo(bytes).models[modelIndex];if(!model)throw Error('Missing model');
 const sbc=decodeNativeSbc(bytes,model);if(sbc.unresolved.length||!sbc.terminated)throw Error('Unresolved SBC');
 const nodes=readNativeNodes(bytes,model,pivotTable),plan=planNativeNodeMatrices(nodes,sbc);if(plan.unresolved.length)throw Error('Unresolved default node plan');
 const byOffset=new Map(plan.results.map(r=>[r.offset,r])),shapes=readNativeShapes(bytes,model),stack=new Map(),draws=[];
 let matrix=identity(),visible=true,material=null,color=defaultColor555;
 for(const c of sbc.commands){
  if(c.opcode===0)continue;if(c.opcode===1)break;
  if(c.opcode===2){visible=c.nodeVisibility.visible;continue;}
  if(c.opcode===3){if(!stack.has(c.matrixRestore))throw Error('Read uninitialized SBC matrix slot');matrix=[...stack.get(c.matrixRestore)];continue;}
  if(c.opcode===4){material=c.materialIndex;continue;}
  if(c.opcode===6){const d=c.nodeDescription;if(d.flags!==0)throw Error('Unsupported SBC node descriptor flags');if(d.restoreSlot!==null){if(!stack.has(d.restoreSlot))throw Error('Read uninitialized node matrix slot');matrix=[...stack.get(d.restoreSlot)];}
   for(const op of byOffset.get(c.offset).gx)matrix=multiply(matrix,operation(op.opcode,op.signedFx12));if(d.storeSlot!==null)stack.set(d.storeSlot,[...matrix]);continue;}
  if(c.opcode===11){matrix=multiply(matrix,operation(0x1b,nativeSbcPositionScale(model,c.option)));continue;}
  if(c.opcode!==5)throw Error('Unsupported SBC opcode '+c.opcode);
  if(!visible)continue;if(material===null)throw Error('No material before shape');const shape=shapes[c.shape.index];if(!shape)throw Error('Missing shape');
  const gx=decodePackedGx(bytes,shape.displayListOffset,shape.displayListBytes);if(gx.unresolved.length)throw Error('Unresolved display list');
  const permitted=new Set([0,0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x40,0x41]);for(const q of gx.commands)if(!permitted.has(q.opcode))throw Error('Unsupported shape GX opcode '+q.opcode);
  const local=decodeLocalVertices(gx.commands);if(local.unresolved.length)throw Error('Unresolved vertex state');
  const colors=new Map();gx.commands.forEach((q,i)=>{if(q.opcode===0x20)color=q.parameterWords[0]&32767;colors.set(i,color);});
  const vertices=local.vertices.map(v=>({position:transform(matrix,v.positionFx12),color555:colors.get(v.command),texcoord:v.texcoordFx4?.map(x=>x/16)??null,normalFx9:v.normalFx9}));
  const indices=[];let open=null;for(const b of local.boundaries){if(b.type==='begin'){if(open)throw Error('Nested primitive');open=b;}else{if(!open)throw Error('End without primitive');indices.push(...triangles(open.primitive,open.vertexIndex,b.vertexIndex-open.vertexIndex));open=null;}}if(open)throw Error('Unterminated primitive');
  draws.push({sbcOffset:c.offset,shapeIndex:shape.index,materialIndex:material,vertices,indices,matrix:[...matrix]});
 }
 return {modelIndex,draws,scope:'Default static node/SBC geometry, floating presentation transform. No animation, callback, visibility override, lighting, texture transform, placement, clipping or native raster parity.'};
}
