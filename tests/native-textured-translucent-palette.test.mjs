import assert from 'node:assert/strict';
import {collectInferredMode2TexturedTranslucentInputs} from '../web/map-browser-preview/integer/native-textured-translucent.mjs';
import {readNativeTextureResource} from '../web/map-browser-preview/native/native-tex0.mjs';

// Generated BTX0 only. No ROM, palette colors, or extracted game assets.
function fixture(format, paletteColors, index, {trailingBytes=0, keyColor0=false, alphaZero=false}={}) {
 const rawBytes=format===3?32:64, base=20, paletteAt=128+rawBytes;
 const sectionBytes=paletteAt+paletteColors*2, bytes=new Uint8Array(base+sectionBytes+trailingBytes), d=new DataView(bytes.buffer);
 const text=(at,value)=>bytes.set(new TextEncoder().encode(value),at), u16=(at,value)=>d.setUint16(at,value,true), u32=(at,value)=>d.setUint32(at,value,true);
 text(0,'BTX0');u16(4,0xfeff);u32(8,bytes.length);u16(12,16);u16(14,1);u32(16,base);
 text(base,'TEX0');u32(base+4,sectionBytes);u16(base+12,rawBytes/8);u16(base+14,60);u32(base+20,128);
 u32(base+36,paletteAt);u32(base+40,paletteAt);u16(base+48,paletteColors/4);u16(base+52,96);u32(base+56,paletteAt);
 const parameter=(format<<26)|(keyColor0?0x20000000:0);
 for(const [at,stride,name] of [[base+60,8,'texture'],[base+96,4,'palette']]) {
  bytes[at+1]=1;u16(at+2,12+stride+16);u16(at+6,8);u16(at+8,stride);u16(at+10,4+stride);text(at+12+stride,name);
 }
 u32(base+72,parameter);
 bytes.fill(format===3?index|(index<<4):index|(alphaZero?0:format===1?0xe0:0xf8),base+128,base+paletteAt);
 for(let i=0;i<paletteColors;i++)u16(base+paletteAt+2*i,(i*1057)&32767);
 if(trailingBytes)bytes.fill(0xff,base+sectionBytes);
 const parsed=readNativeTextureResource(bytes), t=parsed.textures[0], pal=parsed.palettes[0];
 const identity=[4096,0,0,0,0,4096,0,0,0,0,4096,0,0,0,0,4096], positions=[[0,0,0],[1024,0,0],[0,1024,0]];
 const primitive={primitiveMode:0,vertexIndices:[0,1,2],vertexCommands:[1,2,3],localPositionFx:positions};
 const binding={status:'bound',material:{textureParameter:0},texture:t,selectionEvidence:{rule:'embedded-model-then-reverse-ambl-first-exact16-per-mapping',texture:{kind:'embedded-model',entryIndex:0,nameHex:t.nameHex},palette:{kind:'embedded-model',entryIndex:0,nameHex:pal.nameHex}}};
 const p={index:0,classification:'rejected',binaryRejection:'Texture format outside connected opaque/binary path',materialEvidence:{polygonAttribute:(format===3?15:31)<<16},sceneIndex:0,instanceId:0,sbcOffset:12,archive:'synthetic',model:'synthetic.btx',shapeIndex:0,primitive,positionMatrixFx:identity,projectionFx:identity};
 const recordKey='map:1:2', automatic={mode2Applied:true,mode2Evaluation:{ready:true,source:{callIndex:1,callOffset:2}},plan:{recordKey},scenes:[{instances:[{id:0,draws:[{sbcOffset:12,textureBinding:binding,vertices:positions.map(()=>({color555:32767}))}]}]}]};
 const inventory={recordKey,snapshot:{profile:'ROM-mode2-inverse-source-hypothesis'},polygons:[p],rasterProfile:{},unresolved:[]};
 const sourceCache={shape:()=>({gx:{unresolved:[]},local:{unresolved:[],vertices:positions.map((positionFx12,i)=>({command:i+1,positionFx12,texcoordFx4:[0,0]}))}})};
 return collectInferredMode2TexturedTranslucentInputs({archive:()=>({get:()=>bytes})},automatic,inventory,sourceCache);
}

let checks=0;
for(const format of [1,3,6]) {
 for(const trailingBytes of [0,64]) {
  const result=fixture(format,4,3,{trailingBytes});
  assert.equal(result.rejected.length,0);assert.equal(result.polygons.length,1);
  const texture=result.polygons[0].translucentInput.texture;
  assert.equal(texture.raw.palette.length,4);assert.equal(texture.rgba6665.length,256);
  assert.deepEqual(texture.raw.palette,[0,1057,2114,3171]);checks++;
 }
 const invalid=fixture(format,4,4);
 assert.equal(invalid.polygons.length,0);
 assert.equal(invalid.rejected[0].reason,'Used texture palette index outside declared palette memory');checks++;
 const full=fixture(format,format===1?32:format===3?16:8,format===1?31:format===3?15:7);
 assert.equal(full.rejected.length,0);assert.equal(full.polygons[0].translucentInput.texture.raw.palette.length,format===1?32:format===3?16:8);checks++;
}
for(const format of [1,6]) {
 const invalid=fixture(format,4,4,{alphaZero:true,trailingBytes:64});
 assert.equal(invalid.polygons.length,0);assert.equal(invalid.rejected[0].reason,'Used texture palette index outside declared palette memory');checks++;
}
// Existing I4 key-color behavior does not consume palette color zero.
const transparent=fixture(3,0,0,{keyColor0:true});
assert.equal(transparent.rejected.length,0);assert.equal(transparent.polygons[0].translucentInput.texture.raw.palette.length,0);
assert(transparent.polygons[0].translucentInput.texture.rgba6665.every(v=>v===0));checks++;
console.log(JSON.stringify({passed:true,checks,formats:[1,3,6],syntheticOnly:true}));
