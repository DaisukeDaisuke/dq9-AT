// Static material texture-matrix convention 3, SDK dispatch 020bcd68.
// Inputs remain ROM material fields. Animated SRT and other conventions are separate.
const i32=n=>Number(BigInt.asIntN(32,BigInt(n))),fx=(a,b)=>i32(BigInt(a)*BigInt(b)>>12n);
const mul32=(a,b)=>i32(BigInt(a)*BigInt(b));
export function buildNativeTextureMatrix3(result){
 const q=result.textureSrt;if(!q)throw Error('Texture matrix requires authored static SRT');
 const W=result.originalWidth,H=result.originalHeight;
 if(!Number.isInteger(W)||!Number.isInteger(H)||W<=0||H<=0)throw Error('Invalid original texture dimensions');
 let [sx,sy]=q.scale,[sin,cos]=q.rotationSinCos,[tx,ty]=q.translation;
 if(result.flags&1)sx=sy=4096;if(result.flags&2){sin=0;cos=4096;}if(result.flags&4)tx=ty=0;
 if([sx,sy,sin,cos,tx,ty,result.bindingScaleS,result.bindingScaleT].some(v=>!Number.isInteger(v)))throw Error('Texture SRT must contain native integers');
 const ratio=(a,b)=>Number(((BigInt(a)<<32n)/BigInt(b)+0x80000n)>>20n);
 const m=Array(16).fill(0);m[15]=4096;
 m[0]=fx(sx,cos);m[5]=fx(sy,cos);
 m[1]=mul32(fx(sy,sin),ratio(H,W))>>12;
 m[4]=mul32(-fx(sx,sin),ratio(W,H))>>12;
 const u=i32((BigInt(cos)*BigInt(tx)+BigInt(sin)*BigInt(ty))>>12n),v=i32((BigInt(sin)*BigInt(tx)-BigInt(cos)*BigInt(ty))>>12n);
 m[12]=mul32(mul32(W,i32(fx(sx,sin)-fx(sx,u))),16);
 m[13]=mul32(mul32(-H,i32(fx(sy,cos)+fx(sy,v)-4096)),16);
 for(const k of[0,1,12])m[k]=fx(m[k],result.bindingScaleS);
 for(const k of[4,5,13])m[k]=fx(m[k],result.bindingScaleT);
 return m;
}
export function transformExplicitTextureCoordinate(uv,m){
 if(!Array.isArray(uv)||uv.length!==2)throw Error('Explicit texture coordinates absent');
 const raw=uv.map(v=>v*16);if(raw.some(v=>!Number.isInteger(v)||v< -32768||v>32767))throw Error('Texture coordinate outside signed FX16 state');
 // TEXCOORD source: translation is in matrix FX12 applied to raw FX4.
 return [0,1].map(i=>i32((BigInt(m[i])*BigInt(raw[0])+BigInt(m[i+4])*BigInt(raw[1])+BigInt(m[i+8])+BigInt(m[i+12]))>>12n)/16);
}
