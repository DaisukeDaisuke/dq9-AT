/* GPL-2.0-or-later. Component formulas adapted from DeSmuME contributors,
 * commit 535f676778dff6e2cbd57ff8468b4a9846d23933:
 * gfx3d.cpp:1569-1571 RGB5->RGB6 before interpolation;
 * rasterize.cpp:977-990 interpolation truncation, 580-582/2080 modulation;
 * colorspacehandler.cpp material_5bit_to_8bit/material_6bit_to_8bit tables.
 * This helper changes RGB only. Coverage, alpha, compositing, depth and fog are
 * caller concerns; RGB555 presentation is a separate explicit operation.
 */
export const NATIVE_MODE0_COLOR_SOURCE='rom-binding-and-native-gx-rgb555';
const expand5to8=n=>(n<<3)|(n>>>2),expand5to6=n=>n===0?0:2*n+1;
const rgb8to6=new Map(Array.from({length:32},(_,n)=>[expand5to8(n),expand5to6(n)]));
const alpha3=new Set([0,36,73,109,146,182,219,255]),alpha5=new Set(Array.from({length:32},(_,n)=>expand5to8(n)));
export const expandCore6to8=n=>(n<<2)|(n>>>4);
export function modulateNativeRgb6(textureChannel,interpolatedVertexChannel){
 if(!Number.isInteger(textureChannel)||textureChannel<0||textureChannel>63||!Number.isFinite(interpolatedVertexChannel))throw Error('Native RGB6 modulation inputs required');
 const vertex=Math.trunc(Math.max(0,Math.min(63,interpolatedVertexChannel)));
 return expandCore6to8(((textureChannel+1)*(vertex+1)-1)>>>6);
}
/** Only prepareDrawPackets' source-validated encoding is eligible. A missing
 * encoding returns null for explicit legacy fallback. Invalid marked data throws.
 * Vertex RGB5 is recovered exactly, never rounded from arbitrary normalized RGB.
 * Texture RGB8 is inverted through the exact native 32-entry expansion alphabet.
 * The returned texture intentionally retains its original ALPHA8 unchanged.
 */
export function prepareNativeMode0Color(packet,textureCache=new Map()){
 const source=packet.nativeColorEncoding;if(!source)return null;
 if(source.source!==NATIVE_MODE0_COLOR_SOURCE||source.vertex!=='rgb555-normalized-f32'||source.texture!==(packet.texture?'native-unpack-8888':'untextured'))throw Error('Unrecognized native color encoding');
 if(packet.polygonMode!==0)throw Error('Native RGB helper supports mode0 only');
 const vertices=new Float32Array(packet.vertices);if(vertices.length%8)throw Error('Interleaved native preview vertex layout required');
 for(let i=0;i<vertices.length;i+=8)for(let c=3;c<6;c++){const v=vertices[i+c],n=Math.round(v*31);if(n<0||n>31||(v!==Math.fround(n/31)&&v!==n/31))throw Error('Marked native vertex is not an exact RGB5 channel');vertices[i+c]=expand5to6(n);}
 let texture=null,hasTranslucentTexels=false;
 if(packet.texture){const t=packet.texture,format=source.textureFormat;if(![1,2,3,4,6,7].includes(format)||t.output!=='8888'||t.pixels.length!==t.width*t.height*4)throw Error('Unsupported native unpack encoding');
  let cached=textureCache.get(t);if(cached&&cached.format!==format)throw Error('Native texture format changed for the same decoded resource');
  if(!cached){const pixels=new Uint8Array(t.pixels.length),allowedAlpha=format===1?alpha3:format===6?alpha5:new Set([0,255]);
   for(let i=0;i<pixels.length;i++){const value=t.pixels[i];if(i%4===3){if(!allowedAlpha.has(value))throw Error('Marked texture alpha outside native format alphabet');pixels[i]=value;if(value!==0&&value!==255)hasTranslucentTexels=true;}else{const v=rgb8to6.get(value);if(v===undefined)throw Error('Marked texture RGB outside lossless native-unpack alphabet');pixels[i]=v;}}
   cached={format,hasTranslucentTexels,texture:{...t,pixels,output:'rgb666-alpha8'}};textureCache.set(t,cached);
  }texture=cached.texture;hasTranslucentTexels=cached.hasTranslucentTexels;
 }
 return {vertices,texture,hasTranslucentTexels};
}
/** Explicit display precision only, from locked wasm-port.cpp:476-480,
 * masterNativeBuffer16 -> ColorspaceConvertBuffer555xTo8888Opaque. This does not
 * implement native 2D composition/master brightness; alpha remains diagnostic.
 */
export function presentPreviewRgb555(image){
 if(!(image.rgba instanceof Uint8Array)&&!(image.rgba instanceof Uint8ClampedArray))throw Error('Preview RGBA bytes required');
 const rgba=new Uint8ClampedArray(image.rgba);for(let i=0;i<rgba.length;i+=4)for(let c=0;c<3;c++)rgba[i+c]=expand5to8(rgba[i+c]>>>3);
 return {...image,rgba,presentation:'rgb555-expanded-to-rgba8888',scope:image.scope+' RGB555 display precision only; native 2D composition remains separate.'};
}
