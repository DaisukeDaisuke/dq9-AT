/* GPL-2.0-or-later. Adapted from DeSmuME core535f676 gfx3d.cpp
 * NDSGeometryEngine::SetNormal/SetLightDirection/UpdateLightDirectionHalfAngleVector
 * and matrix.cpp::__vec3_multiply_mtx3_fixed. Copyright DeSmuME contributors.
 * Requires explicit captured state. No ROM light constants or shininess defaults.
 */
const i32=n=>Number(BigInt.asIntN(32,BigInt(n))),shift=n=>i32(BigInt.asIntN(64,n)>>12n),dot=(a,b)=>shift(a.reduce((s,x,i)=>s+BigInt(x)*BigInt(b[i]),0n));
const vec=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647);
export function transformDirectionFx(v,m){if(!vec(v,3)||!vec(m,16))throw Error('Explicit FX vectors required');return[0,1,2].map(r=>{let s=0n;for(let c=0;c<3;c++)s+=BigInt(m[c*4+r])*BigInt(v[c]);s=BigInt.asIntN(64,s);return s>0x7ffffffffffn?2147483647:s< -0x80000000000n?-2147483648:shift(s);});}
const signed10=n=>(n&512)?(n&1023)-1024:n&1023;
export function createCoreLighting({lightDirectionWords,lightColorWords,lightMatrixFx,shininessTable}){
 if(!vec(lightDirectionWords,4)||!vec(lightColorWords,4)){
  // Packed words may carry the unsigned light3 identifier.
  const u=a=>Array.isArray(a)&&a.length===4&&a.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff);if(!u(lightDirectionWords)||!u(lightColorWords))throw Error('Four explicit light register words required');
 }
 if(!(shininessTable instanceof Uint8Array)||shininessTable.length!==128)throw Error('Explicit applied shininess table required');
 const lights=lightDirectionWords.map((word,i)=>{if((word>>>30)!==i||(lightColorWords[i]>>>30)!==i)throw Error('Light register ID mismatch');const v=[0,10,20].map(k=>signed10(word>>>k)*8),direction=transformDirectionFx(v,lightMatrixFx),half=[direction[0],direction[1],direction[2]-4096],squared=dot(half,half);if(squared<0)throw Error('Overflowing half-vector outside accepted subset');let len=Math.trunc(Math.sqrt(squared));const halfNegative=half.map(x=>len?-Math.trunc(i32(x<<6)/len):-x);return{direction,halfNegative,color:[0,5,10].map(k=>lightColorWords[i]>>>k&31)};});
 return{lights,shininessTable:shininessTable.slice()};
}
export function shadeCoreNormal(normalFx9,directionMatrixFx,material,context){
 if(!Array.isArray(normalFx9)||normalFx9.length!==3||normalFx9.some(x=>!Number.isInteger(x)||x< -512||x>511))throw Error('Native signed10 normal required');
 const normal=transformDirectionFx(normalFx9.map(x=>x*8),directionMatrixFx),rgb=w=>[0,5,10].map(k=>w>>>k&31),diffuse=rgb(material.diffuseAmbient),ambient=rgb(material.diffuseAmbient>>>16),specular=rgb(material.specularEmission),emission=rgb(material.specularEmission>>>16),color=emission.slice(),terms=[];
 for(let i=0;i<4;i++){if(!(material.polygonAttribute&(1<<i)))continue;const light=context.lights[i],diff=Math.max(0,-dot(light.direction,normal)),d=dot(light.halfNegative,normal);let shiny=d>0?i32(2*shift(BigInt(d)*BigInt(d))-4096):0;shiny=Math.max(0,Math.min(4095,shiny));if(material.specularEmission&0x8000)shiny=context.shininessTable[shiny>>5]<<4;for(let c=0;c<3;c++){const sc=specular[c]*light.color[c]*shiny,dc=diffuse[c]*light.color[c]*diff;if(sc>2147483647||dc>2147483647)throw Error('Color-product overflow outside accepted subset');color[c]+=(sc>>17)+(dc>>17)+((ambient[c]*light.color[c])>>5);}terms.push({light:i,diffuseFx:diff,shininessFx:shiny});}
 const color5=color.map(x=>Math.min(31,x));return{color555:color5[0]|color5[1]<<5|color5[2]<<10,color5,color6:color5.map(x=>x===0?0:2*x+1),normalFx:normal,terms};
}
