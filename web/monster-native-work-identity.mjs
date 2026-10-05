// Resumable work is confined to one exact frozen request. Tokens never authorize
// score reuse across a changed frame, pixel buffer, branch, environment or policy.
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)),v=>v.toString(16).padStart(2,'0')).join('');
export async function nativeWorkIdentity(request){
 const comparison=request.nativeComparison,video=request.nativeVideo;
 if(!video?.rgba||video.rgba.length!==196608)throw Error('Exact native pixels required for continuation');
 const [videoSHA,backgroundSHA,maskSHA]=await Promise.all([digest(video.rgba),comparison?.alignedBackground?digest(comparison.alignedBackground):null,comparison?.validMask?digest(comparison.validMask):null]);
 const identity={videoEvidence:request.videoEvidence,backgroundEvidence:request.backgroundEvidence,nativeVideo:{width:video.width,height:video.height,sha256:videoSHA},nativeComparison:comparison?{backgroundSHA,maskSHA,alignment:comparison.alignment}:null,regions:request.regions,candidates:request.candidates,variant:request.variant,appearancePoseHints:request.appearancePoseHints??null};
 return digest(new TextEncoder().encode(JSON.stringify(identity)));
}
