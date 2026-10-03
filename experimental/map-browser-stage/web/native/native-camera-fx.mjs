// ARM9 fixed-point camera subset reconstructed from ROM instructions.
// Matrices use native packed column-major words; all integer intermediates are BigInt.
const i32=x=>Number(BigInt.asIntN(32,BigInt(x)));
const roundShift=(x,b)=>i32((BigInt.asIntN(64,x)+(1n<<BigInt(b-1)))>>BigInt(b));
export function integerSqrt(n){if(n<0n)throw Error('Negative square root');if(n<2n)return n;let x=1n<<BigInt((n.toString(2).length+1)>>1);for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
export function fxDiv(a,b){if(!b)throw Error('Zero divisor');return roundShift((BigInt(a)<<32n)/BigInt(b),20);}
export function fxNormalize(v){const s=v.reduce((sum,x)=>sum+BigInt(x)*BigInt(x),0n);if(!s)throw Error('Zero vector');const q=(1n<<56n)/s,factor=BigInt.asUintN(64,q*integerSqrt(s*4n));return v.map(x=>i32(((BigInt.asIntN(64,BigInt(x)*factor)>>32n)+0x1000n)>>13n));}
export function fxCross(a,b){return [roundShift(BigInt(a[1])*BigInt(b[2])-BigInt(a[2])*BigInt(b[1]),12),roundShift(BigInt(a[2])*BigInt(b[0])-BigInt(a[0])*BigInt(b[2]),12),roundShift(BigInt(a[0])*BigInt(b[1])-BigInt(a[1])*BigInt(b[0]),12)];}
export function fxDot(a,b){return roundShift(a.reduce((s,x,i)=>s+BigInt(x)*BigInt(b[i]),0n),12);}
export function followTargetFx(positionFx,heightFx,offsetFx=[0,0,0]){return [i32(positionFx[0]+offsetFx[0]),i32(positionFx[1]+Math.trunc(heightFx/2)+offsetFx[1]),i32(positionFx[2]+offsetFx[2])];}
export function fovHalfAngleFx(halfDegreesFx,trig){if(!Number.isInteger(halfDegreesFx)||halfDegreesFx<=0||halfDegreesFx>=90*4096)throw Error('Unsupported half-angle');const radiansFx=roundShift(BigInt(halfDegreesFx)*71n,12),index=((Math.trunc((radiansFx<<16)/25736)&0xffff)>>>4),[sinHalfFovFx,cosHalfFovFx]=trig(index);return {halfDegreesFx,radiansFx,trigIndex:index,sinHalfFovFx,cosHalfFovFx};}
export function buildEyeFx({target,yawFx,heightFx,radiusFx},trig){
 if(!Number.isInteger(yawFx)||yawFx<0||yawFx>25736)throw Error('Yaw must already be normalized to native range 0..25736');
 const square=x=>roundShift(BigInt(x)*BigInt(x),12),radicand=square(radiusFx)-square(heightFx);
 if(radicand<0)throw Error('Height exceeds radius');
 const z=i32((integerSqrt(BigInt(radicand)<<32n)+0x200n)>>10n),index=((Math.trunc((yawFx<<16)/25736)&0xffff)>>>4),[sin,cos]=trig(index);
 const offset=[i32((BigInt(z)*BigInt(sin))>>12n),heightFx,i32((BigInt(z)*BigInt(cos))>>12n)];
 return {eye:offset.map((x,i)=>i32(x+target[i])),offset,z,trigIndex:index,sinFx:sin,cosFx:cos};
}
export function lookAtFx(eye,up,target){const z=fxNormalize(eye.map((x,i)=>i32(x-target[i]))),x=fxNormalize(fxCross(up,z)),y=fxCross(z,x);return [x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2],i32(-fxDot(eye,x)),i32(-fxDot(eye,y)),i32(-fxDot(eye,z))];}
export function perspectiveFx({sinHalfFovFx,cosHalfFovFx,aspectFx,nearFx,farFx}){
 if(nearFx<=0||farFx<=nearFx||aspectFx<=0||sinHalfFovFx<=0)throw Error('Unsupported perspective parameters');
 const f=fxDiv(cosHalfFovFx,sinHalfFovFx),inv=(4096n<<32n)/BigInt(nearFx-farFx),p=Array(16).fill(0);
 p[0]=fxDiv(f,aspectFx);p[5]=f;p[10]=roundShift(BigInt(farFx+nearFx)*inv,32);p[11]=-4096;
 p[14]=roundShift(BigInt(roundShift(BigInt(nearFx*2)*BigInt(farFx),12))*inv,32);return p;
}
