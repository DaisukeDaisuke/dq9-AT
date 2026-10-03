const alpha3To5=[0,4,8,13,17,22,26,31],alpha3To8=[0,36,73,109,146,182,219,255],expand5=n=>(n<<3)|(n>>>2),expand5to6=n=>n===0?0:2*n+1;
export function unpackNativeTexture(bytes,resource,texture,palette,output='6665'){
 if(!['6665','8888'].includes(output)||!(bytes instanceof Uint8Array))throw new Error('Texture bytes and explicit6665/8888 output required');if(![1,2,3,4,6,7].includes(texture.format))throw new Error('Texture format outside the observed whole-map subset');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),pixels=new Uint8Array(texture.width*texture.height*4),src=texture.data.offset,header=resource.textureSection,paletteEnd=header.base+header.paletteDataOffset+header.paletteDataUnits*8,rgba=(at,c,alpha5,alpha8)=>{pixels[at]=output==='6665'?expand5to6(c&31):expand5(c&31);pixels[at+1]=output==='6665'?expand5to6(c>>>5&31):expand5(c>>>5&31);pixels[at+2]=output==='6665'?expand5to6(c>>>10&31):expand5(c>>>10&31);pixels[at+3]=output==='6665'?alpha5:alpha8;};
 if(texture.format!==7&&!palette)throw new Error('An explicit native palette binding is required');
 const readColor=index=>{const at=palette.paletteDataOffset+2*index;if(at<header.base+header.paletteDataOffset||at+2>paletteEnd)throw new Error('Used texture palette index outside declared palette memory');return d.getUint16(at,true)&32767;};
 for(let i=0;i<texture.width*texture.height;i++){
  const at=4*i,format=texture.format;let index,alpha5=31,alpha8=255;
  if(format===7){const raw=d.getUint16(src+2*i,true);if(raw&32768)rgba(at,raw&32767,31,255);continue;}
  if(format===1){const raw=bytes[src+i];index=raw&31;alpha5=alpha3To5[raw>>>5];alpha8=alpha3To8[raw>>>5];}
  else if(format===6){const raw=bytes[src+i];index=raw&7;alpha5=raw>>>3;alpha8=expand5(alpha5);}
  else if(format===2)index=bytes[src+(i>>>2)]>>>((i&3)*2)&3;
  else if(format===3)index=bytes[src+(i>>>1)]>>>((i&1)*4)&15;
  else index=bytes[src+i];
  if([2,3,4].includes(format)&&texture.keyColor0&&index===0)continue;
  rgba(at,readColor(index),alpha5,alpha8);
 }
 return {width:texture.width,height:texture.height,pixels,output,scope:'Provided core texture unpack component precision; sampling, lighting/blending, depth/fog and rasterization are separate.'};
}
