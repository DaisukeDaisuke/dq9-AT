// Isolated candidate merge. Both sources have independently passed the same
// current-frame body gates. This never certifies identity, birth, absence or AT.
export function mergeFineAlphaAlternatives(chroma,opaque){
 if(JSON.stringify(chroma.captureStamp)!==JSON.stringify(opaque.captureStamp))throw Error('Different capture stamps');
 if(chroma.enemyIdentityCertified||opaque.enemyIdentityCertified||chroma.birthCertified||opaque.birthCertified||chroma.ATDrawsCertified||opaque.ATDrawsCertified)throw Error('Unexpected certified input');
 const overlap=(a,b)=>{const i=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return i/(a.w*a.h+b.w*b.h-i);};
 const raw=[...chroma.rawCandidates.map(p=>({...p,alphaAlternative:'chroma'})),...opaque.rawCandidates.map(p=>({...p,alphaAlternative:'opaque'}))].sort((a,b)=>b.priority-a.priority||a.roi.y-b.roi.y||a.roi.x-b.roi.x),distinct=[],duplicates=[];
 for(const p of raw){if(distinct.some(q=>overlap(p.nativeROI,q.nativeROI)>.35)){duplicates.push(p.nativeROI);continue;}distinct.push(p);}
 return{...structuredClone(chroma),rawCandidates:distinct,proposals:distinct.slice(0,8).map((p,i)=>({...p,proposalId:`${chroma.captureStamp.frameSerial}:${i}`})),alphaAlternativeDuplicates:duplicates,coverage:{...chroma.coverage,candidateComponents:distinct.length,retainedCandidates:Math.min(8,distinct.length),budgetDropped:Math.max(0,distinct.length-8),absenceCertified:false}};
}
