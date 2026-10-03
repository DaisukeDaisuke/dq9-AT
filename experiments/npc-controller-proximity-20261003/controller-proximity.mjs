// Bounded leaf of overlay_d_17:021a58fc. Caller supplies resolved position,
// active-region and radius inputs. This does not resolve the world geometry or
// advance AT. Mirrors signed 32-bit subtraction followed by ROM abs helper.
export function controllerProximityBit({flags,heroXZ,controllerXZ,radius,insideActiveRegion}) {
 const int32=x=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647;
 if(!Number.isInteger(flags)||flags<0||flags>0xffffffff||!Array.isArray(heroXZ)||heroXZ.length!==2||!heroXZ.every(int32)||!Array.isArray(controllerXZ)||controllerXZ.length!==2||!controllerXZ.every(int32)||!int32(radius)||radius<0||typeof insideActiveRegion!=='boolean')throw Error('Resolved controller proximity inputs required');
 const delta=heroXZ.map((x,i)=>(x-controllerXZ[i])|0);
 if(delta.some(x=>x===-2147483648))return {resolved:false,reason:'Signed absolute-value boundary requires separate ROM binding',ATDrawsCertified:0};
 const near=insideActiveRegion||delta.every(x=>Math.abs(x)<=radius);
 return {resolved:true,delta,near,flags:((flags&0xfffffffe)|(near?1:0))>>>0,worldResolved:false,ATDrawsCertified:0};
}
// Comparison-only entry for actual register operands observed at 021a5a9c/5ab4.
export function resolvedProximityComparisons({absoluteDeltaX,absoluteDeltaZ,radius,insideActiveRegion}) {
 const nonnegative=x=>Number.isInteger(x)&&x>=0&&x<=2147483647;
 if(typeof insideActiveRegion!=='boolean'||!nonnegative(radius))throw Error('Resolved region and radius required');
 if(insideActiveRegion)return true;
 if(!nonnegative(absoluteDeltaX))throw Error('Resolved X comparison required');
 if(absoluteDeltaX>radius)return false;
 if(!nonnegative(absoluteDeltaZ))throw Error('Resolved Z comparison required after X passed');
 return absoluteDeltaZ<=radius;
}
