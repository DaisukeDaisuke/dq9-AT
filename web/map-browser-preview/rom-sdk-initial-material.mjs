// NNS global initialization at 020b518c. Values read from supplied ROM literals.
// Subsequent environment/material setters are NOT represented by this initializer.
export function readSdkInitialMaterialGlobals(sdk){
 const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 return {diffuseAmbient:word(0x020b52cc),specularEmission:word(0x020b52cc),polygonAttribute:word(0x020b52d0)};
}
