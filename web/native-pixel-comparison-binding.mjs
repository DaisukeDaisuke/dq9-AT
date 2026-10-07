// Exact compared buffers, not a claimed map, background or runtime-state identity.
const ownedBindings=new WeakMap();
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export async function sourcePixelComparisonBinding({sourcePixelSHA256,videoRGBA,backgroundRGBA,validMask},prior=null){
 const owner=prior&&ownedBindings.get(prior);
 // Reuse only the exact private immutable work buffers originally hashed by
 // this module. Serialized claims and copied metadata must be verified anew.
 if(owner&&owner.sourcePixelSHA256===sourcePixelSHA256&&owner.videoRGBA===videoRGBA&&owner.backgroundRGBA===backgroundRGBA&&owner.validMask===validMask)return prior;
 if(!/^[a-f0-9]{64}$/.test(sourcePixelSHA256??'')||!ArrayBuffer.isView(videoRGBA)||videoRGBA.byteLength!==196608||!ArrayBuffer.isView(backgroundRGBA)||backgroundRGBA.byteLength!==196608||!(validMask instanceof Uint8Array)||validMask.length!==49152||validMask.some(x=>x!==0&&x!==1))throw Error('Exact frozen native comparison buffers required');
 const [videoRGBA_SHA256,backgroundRGBA_SHA256,validMaskSHA256]=await Promise.all([hash(videoRGBA),hash(backgroundRGBA),hash(validMask)]);
 const binding=Object.freeze({kind:'same-frozen-native-pixel-comparison-v1',sourcePixelSHA256,videoRGBA_SHA256,backgroundRGBA_SHA256,validMaskSHA256,width:256,height:192,objective:'RGB squared error; unchanged background outside each rendered footprint',currentBackgroundCertified:false});ownedBindings.set(binding,{sourcePixelSHA256,videoRGBA,backgroundRGBA,validMask});return binding;
}
export function sameSourcePixelComparison(a,b){return a?.kind==='same-frozen-native-pixel-comparison-v1'&&b?.kind===a.kind&&a.width===256&&a.height===192&&b.width===256&&b.height===192&&['sourcePixelSHA256','videoRGBA_SHA256','backgroundRGBA_SHA256','validMaskSHA256'].every(k=>/^[a-f0-9]{64}$/.test(a[k]??'')&&a[k]===b[k]);}
