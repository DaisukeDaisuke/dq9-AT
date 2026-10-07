// Resumable work is confined to one exact frozen request. Tokens never authorize
// score reuse across a changed frame, pixel buffer, branch, environment or policy.
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)),v=>v.toString(16).padStart(2,'0')).join('');
export async function nativeWorkIdentity(request){
 const comparison=request.nativeComparison,video=request.nativeVideo;
 if(!video?.rgba||video.rgba.length!==196608)throw Error('Exact native pixels required for continuation');
 const [videoSHA,backgroundSHA,maskSHA]=await Promise.all([digest(video.rgba),comparison?.alignedBackground?digest(comparison.alignedBackground):null,comparison?.validMask?digest(comparison.validMask):null]);
 const identity={videoEvidence:request.videoEvidence,backgroundEvidence:request.backgroundEvidence,nativeVideo:{width:video.width,height:video.height,sha256:videoSHA},nativeComparison:comparison?{backgroundSHA,maskSHA,alignment:comparison.alignment}:null,regions:request.regions,candidates:request.candidates,variant:request.variant,appearancePoseHints:request.appearancePoseHints??null};
 // Keep ordinary JSON semantics and every surrounding metadata field. Typed
 // source planes are bound by their actual bytes and location, without expanding
 // each sample into a decimal object key. A null placeholder is unambiguous
 // because the separate view list binds its exact property path, type and size.
 // No caller-supplied integrity field substitutes for these byte digests.
 const paths=new WeakMap(),views=[];let root=true;
 const metadata=JSON.stringify(identity,function(key,value){
  const path=root?(root=false,[]):[...(paths.get(this)??[]),key];
  if(ArrayBuffer.isView(value)){
   views.push({path,type:Object.prototype.toString.call(value),length:value.length??null,byteLength:value.byteLength,sha256:digest(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))});
   return null;
  }
  if(value&&typeof value==='object')paths.set(value,path);
  return value;
 });
 if(!views.length)return digest(new TextEncoder().encode(metadata));
 const bound=await Promise.all(views.map(async view=>({...view,sha256:await view.sha256})));
 return digest(new TextEncoder().encode(JSON.stringify({kind:'byte-bound-native-work-identity-v1',metadata,views:bound})));
}
