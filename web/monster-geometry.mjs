// Bounded static NSBMD reader. Format reference: vendored apicula (0BSD).
// DS command decoding, position transforms and triangulation execute in WASM.
import {BufferReader,TEX0} from './vendor/nitro-fs.mjs';
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a,b)=>Array.from({length:16},(_,i)=>{const r=i%4,c=i>>2;let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];return s;});
const scaled=(m,s)=>m.map((v,i)=>i<12?v*s:v);
const hex=n=>'0x'+n.toString(16);
function reader(bytes){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const range=(p,n)=>{if(!Number.isInteger(p)||p<0||n<0||p+n>bytes.length)throw Error('NSBMD range outside selected member: '+hex(p));};
 const u8=p=>(range(p,1),d.getUint8(p)),u16=p=>(range(p,2),d.getUint16(p,true)),u32=p=>(range(p,4),d.getUint32(p,true));
 const fx16=p=>(range(p,2),d.getInt16(p,true)/4096),fx32=p=>(range(p,4),d.getInt32(p,true)/4096);
 const name=(p,n=16)=>(range(p,n),new TextDecoder().decode(bytes.subarray(p,p+n)).replace(/\0.*$/s,''));
 const dict=(p,size=4)=>{const n=u8(p+1),data=p+16+4*n;range(p,u16(p+2));if(u8(p)!==0||u16(data-4)!==size)throw Error('Unsupported Nitro dictionary layout');range(data,n*(size+16));return Array.from({length:n},(_,i)=>({name:name(data+n*size+i*16),data:data+i*size}));};
 return{range,u8,u16,u32,fx16,fx32,name,dict};
}
function objectMatrix(r,p){
 const flags=r.u16(p),m0=r.fx16(p+2);p+=4;let trans=[0,0,0],rotation=[1,0,0,0,1,0,0,0,1],scale=[1,1,1];
 if(!(flags&1)){trans=[r.fx32(p),r.fx32(p+4),r.fx32(p+8)];p+=12;}
 if(flags&8){const a=r.fx16(p),b=r.fx16(p+2),select=(flags>>4)&15,neg=(flags>>8)&15,o=neg&1?-1:1,c=neg&2?-b:b,d=neg&4?-a:a;p+=4;
  const choices=[[o,0,0,0,a,b,0,c,d],[0,o,0,a,0,b,c,0,d],[0,0,o,a,b,0,c,d,0],[0,a,b,o,0,0,0,c,d],[a,0,b,0,o,0,c,0,d],[a,b,0,0,0,o,c,d,0],[0,a,b,0,c,d,o,0,0],[a,0,b,c,0,d,0,o,0],[a,b,0,c,d,0,0,0,o]];
  if(!choices[select])throw Error('Unsupported pivot rotation '+select);rotation=choices[select];
 }else if(!(flags&2)){rotation=[m0,...Array.from({length:8},(_,i)=>r.fx16(p+i*2))];p+=16;}
 if(!(flags&4))scale=[r.fx32(p),r.fx32(p+4),r.fx32(p+8)];
 const m=identity();for(let c=0;c<3;c++)for(let row=0;row<3;row++)m[c*4+row]=rotation[c*3+row]*scale[c];for(let row=0;row<3;row++)m[12+row]=trans[row];return m;
}
export function inspectMonsterModel(bytes){
 const r=reader(bytes);if(r.name(0,4)!=='BMD0'||r.u16(4)!==0xfeff||r.u32(8)!==bytes.length)throw Error('Invalid BMD0 header');
 const sections=Array.from({length:r.u16(14)},(_,i)=>{const p=r.u32(16+i*4),size=r.u32(p+4);r.range(p,size);return{format:r.name(p,4),offset:p,size};});
 const mdls=sections.filter(s=>s.format==='MDL0'),texs=sections.filter(s=>s.format==='TEX0');if(mdls.length!==1||texs.length!==1)throw Error('Preview requires one MDL0 and embedded TEX0');
 const entries=r.dict(mdls[0].offset+8);if(entries.length!==1)throw Error('Preview requires one model per NSBMD');
 const m=mdls[0].offset+r.u32(entries[0].data),end=m+r.u32(m);r.range(m,end-m);if(end>mdls[0].offset+mdls[0].size)throw Error('Model exceeds MDL0');
 const renderStart=m+r.u32(m+4),mat=m+r.u32(m+8),piecesStart=m+r.u32(m+12),inverseStart=m+r.u32(m+16);
 if(!(m+64<=renderStart&&renderStart<mat&&mat<piecesStart&&piecesStart<inverseStart&&inverseStart<=end))throw Error('Unsupported model section order');
 const objects=r.dict(m+64).map(x=>({name:x.name,matrix:objectMatrix(r,m+64+r.u32(x.data))}));
 const materials=r.dict(mat+4).map(x=>{const p=mat+r.u32(x.data),misc=r.u16(p+30),dif=r.u32(p+4),polygon=r.u32(p+12),param=r.u32(p+20);
  if(r.u16(p+2)<44)throw Error('Short material '+x.name);
  if((misc&1)&&(misc&14)!==14)throw Error('Unsupported texture matrix: '+x.name);
  if(r.fx32(p+36)!==1||r.fx32(p+40)!==1)throw Error('Unsupported material texture scale: '+x.name);
  if(((polygon>>4)&3)!==0)throw Error('Unsupported polygon mode: '+x.name);
  if(((polygon>>16)&31)!==31)throw Error('Unsupported translucent material: '+x.name);
  if(param>>>30)throw Error('Unsupported generated texture coordinates: '+x.name);
  return{name:x.name,width:r.u16(p+32),height:r.u16(p+34),diffuse:[dif&31,(dif>>5)&31,(dif>>10)&31].map(v=>v/31),defaultColor:!!(dif&32768),alpha:((polygon>>16)&31)/31,
   cullBack:!(polygon&64),cullFront:!(polygon&128),textureParams:param,textureName:null,paletteName:null};
 });
 for(const [offset,key] of [[r.u16(mat),'textureName'],[r.u16(mat+2),'paletteName']])for(const pair of r.dict(mat+offset)){
  const p=mat+r.u16(pair.data),n=r.u8(pair.data+2);r.range(p,n);for(let i=0;i<n;i++){const id=r.u8(p+i);if(!materials[id]||materials[id][key]!==null)throw Error('Invalid/duplicate material '+key+' binding');materials[id][key]=pair.name;}}
 const section=texs[0],tex=new TEX0(new BufferReader(bytes.buffer,bytes.byteOffset+section.offset,section.size));
 for(const material of materials){const ti=tex.textureInfo.names.indexOf(material.textureName),pi=tex.paletteInfo.names.indexOf(material.paletteName);
  if(ti<0||pi<0)throw Error('Missing explicitly named texture/palette: '+material.name);
  const t=tex.textureInfo.entries[ti],pal=tex.paletteInfo.entries[pi];if(t.format!==3)throw Error('Unsupported preview texture format '+t.format);
  if(t.width!==material.width||t.height!==material.height)throw Error('Material/texture size differs: '+material.name);
  if(tex.header.textureDataOffset+t.textureOffset+t.width*t.height/2>section.size||tex.header.paletteDataOffset+pal.paletteOffset+32>section.size)throw Error('Texture/palette data out of bounds');
  const textureParams=r.u32(r.dict(section.offset+tex.header.textureInfoOffset,8)[ti].data);if(textureParams>>>30)throw Error('Unsupported TEX0 generated coordinates: '+material.name);
  material.textureIndex=ti;material.paletteIndex=pi;material.textureFormat=t.format;material.rgba=tex.parseTexture(ti,pi);
 }
 const pieces=r.dict(piecesStart).map(x=>{const p=piecesStart+r.u32(x.data),offset=p+r.u32(p+8),length=r.u32(p+12);if(r.u16(p+2)!==16||length%4||offset+length>inverseStart)throw Error('Invalid piece range');r.range(offset,length);return{name:x.name,offset,length};});
 if(objects.length!==r.u8(m+23)||materials.length!==r.u8(m+24)||pieces.length!==r.u8(m+25))throw Error('Model dictionary/count mismatch');
 const inverse=Array.from({length:Math.min(objects.length,Math.floor((end-inverseStart)/84))},(_,i)=>{const out=identity();for(let c=0;c<4;c++)for(let row=0;row<3;row++)out[c*4+row]=r.fx32(inverseStart+i*84+(c*3+row)*4);return out;});
 return{r,bytes,name:entries[0].name,modelOffset:m,modelEnd:end,objects,materials,pieces,inverse,renderStart,renderEnd:mat,upScale:r.fx32(m+28),downScale:r.fx32(m+32),declared:{vertices:r.u16(m+36),surfaces:r.u16(m+38),triangles:r.u16(m+40),quads:r.u16(m+42)}};
}
export class MonsterGeometry {
 constructor(instance){this.w=instance.exports;this.w._initialize?.();}
 static async create(){const response=await fetch(new URL('./wasm/monster_geometry.wasm',import.meta.url));if(!response.ok)throw Error('Monster geometry WASM unavailable');const{instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});return new MonsterGeometry(instance);}
 decode(asset){
  const model=inspectMonsterModel(asset.model.bytes),{r,materials,objects,pieces,inverse}=model,w=this.w;w.monster_reset();
  let current=identity(),stack=Array(32).fill(null),material=-1,p=model.renderStart,finished=false,visibility=true;const drawCalls=[],sbcCommands={};
  const load=slot=>{if(slot>31||!stack[slot])throw Error('Uninitialized SBC matrix stack '+slot);current=stack[slot].slice();};
  const store=slot=>{if(slot>31)throw Error('SBC matrix stack out of bounds');stack[slot]=current.slice();};
  while(p<model.renderEnd){const at=p,op=r.u8(p++);sbcCommands[hex(op)]=(sbcCommands[hex(op)]||0)+1;
   const take=n=>{if(p+n>model.renderEnd)throw Error('Truncated SBC '+hex(op));const a=Array.from({length:n},(_,i)=>r.u8(p+i));p+=n;return a;};
   if(op===0)continue;if(op===1){finished=true;break;}
   if(op===2){const[node,visible]=take(2);if(node>=objects.length||visible!==1)throw Error('Unsupported SBC visibility');visibility=true;continue;}
   if(op===3){load(take(1)[0]);continue;}
   if(op===4||op===0x24||op===0x44){material=take(1)[0];if(!materials[material])throw Error('Invalid material ID');continue;}
   if([6,0x26,0x46,0x66].includes(op)){const a=take(op===6?3:op===0x66?5:4);if(!objects[a[0]])throw Error('Invalid object ID');if(a[2]!==0)throw Error('Unsupported SBC segment-scale flags');if(op===0x46)load(a[3]);if(op===0x66)load(a[4]);current=multiply(current,objects[a[0]].matrix);if(op===0x26||op===0x66)store(a[3]);continue;}
   if(op===9){const[slot,n]=take(2),terms=take(n*3),blend=Array(16).fill(0);if(!n)throw Error('Empty skin blend');let weight=0;for(let i=0;i<n;i++){const[s,b,wt]=terms.slice(i*3,i*3+3);if(!stack[s]||!inverse[b])throw Error('Skin matrix index out of bounds');weight+=wt;const matrix=multiply(stack[s],inverse[b]);for(let k=0;k<16;k++)blend[k]+=matrix[k]*wt/256;}if(weight===0||weight>256)throw Error('Unsupported skin weights total '+weight);current=blend;store(slot);continue;}
   if(op===0x0b||op===0x2b){current=scaled(current,op===0x0b?model.upScale:model.downScale);continue;}
   if(op===5){const pieceId=take(1)[0],piece=pieces[pieceId],mat=materials[material];if(!piece||!mat||!visibility)throw Error('Invalid SBC draw state');if(piece.length>8*1024*1024)throw Error('Geometry command buffer exceeds WASM budget');
    new Uint8Array(w.memory.buffer,w.monster_input(),piece.length).set(model.bytes.subarray(piece.offset,piece.offset+piece.length));
    new Float32Array(w.memory.buffer,w.monster_matrix(),16).set(current);const matrices=new Float32Array(w.memory.buffer,w.monster_stack(),512);let valid=0;stack.forEach((m,i)=>{if(m){matrices.set(m,i*16);valid=(valid|(1<<i))>>>0;}});
    const firstIndex=w.monster_index_count(),firstVertex=w.monster_vertex_count(),color=mat.defaultColor?mat.diffuse:[1,1,1];
    const code=w.monster_decode(piece.length,valid,mat.width,mat.height,...color);
    if(code)throw Error(`Geometry ${piece.name}: ${['','unsupported command','truncated/bounds','budget exceeded','invalid primitive sequence','uninitialized matrix'][code]||code}; opcode ${hex(w.monster_error_opcode())} at ${hex(piece.offset+w.monster_error_offset())}`);
    current=Array.from(new Float32Array(w.memory.buffer,w.monster_matrix(),16));
    drawCalls.push({pieceId,pieceName:piece.name,materialId:material,firstIndex,indexCount:w.monster_index_count()-firstIndex,firstVertex,vertexCount:w.monster_vertex_count()-firstVertex});continue;
   }
   throw Error('Unsupported SBC command '+hex(op)+' at '+hex(at));
  }
  if(!finished||!drawCalls.length)throw Error('Model has no complete SBC draw sequence');
  const vertices=new Float32Array(w.memory.buffer,w.monster_vertices(),w.monster_vertex_count()*11).slice(),indices=new Uint32Array(w.memory.buffer,w.monster_indices(),w.monster_index_count()).slice();
  if(!vertices.length||!indices.length||!vertices.every(Number.isFinite)||indices.some(i=>i>=vertices.length/11))throw Error('Invalid decoded geometry');
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<vertices.length;i+=11)for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],vertices[i+k]);bounds.max[k]=Math.max(bounds.max[k],vertices[i+k]);}
  const gpuCommands=Object.fromEntries(Array.from(new Uint32Array(w.memory.buffer,w.monster_commands(),256),(count,op)=>[hex(op),count]).filter(([,n])=>n));
  return{format:'dq9-monster-preview',version:1,modelId:asset.modelId,variant:asset.variant,speciesCandidates:asset.speciesCandidates,source:{...asset.source,modelMember:asset.model.name},
   vertices,indices,materials,drawCalls,bounds,declared:model.declared,counts:{objects:objects.length,materials:materials.length,pieces:pieces.length,vertices:vertices.length/11,triangles:indices.length/3},sbcCommands,gpuCommands,
   pose:'static-model-bind-pose',geometryBackend:'WebAssembly',materialBinding:'MDL0-name-to-embedded-TEX0',animationApplied:false,fieldVariantConfirmed:false,recognitionEvidence:false,
   limitations:['Static bind pose; NSBCA not applied','Unlit texture preview; game lighting not reproduced','Variant field role unverified','No video identification or AT observation coupling']};
 }
}
export const monsterPreviewTransfers=p=>[p.vertices.buffer,p.indices.buffer,...p.materials.map(m=>m.rgba.buffer)];
