// Ordinary type-1 actor draw-link connection (02034fb0), not a live-state producer.
// The existing native sampler/blender owns all joint arithmetic. No pair/weight search.
const need=(v,m)=>{if(!v)throw Error(m);};
const SPANS=[[0x02034fb0,0x19c,0xe812843b],[0x02036a00,0xe8,0xe9eaa849],[0x020b4598,0x34,0x4cd6ed0b],[0x020b468c,0xb8,0x219a815b],[0x020b47ac,0x80,0xa775cfca],[0x0207f970,0x38,0xf75cd76e]];
const hash=b=>{let h=0x811c9dc5;for(const x of b)h=Math.imul(h^x,0x1000193)>>>0;return h;};
export function verifyNativeDrawAnimationSource(sdk){need(sdk?.read,'Original draw-link source required');return{kind:'source-ordinary-type1-draw-links-v1',spans:SPANS.map(([address,length,checksum])=>{const b=sdk.read(address,length);need(b.length===length&&hash(b)===checksum,'Draw animation source mismatch');return{address,length,checksum};})};}
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const clip=x=>exact(x,['clip','phaseFx','resourceFlags','resourceSHA256'])&&typeof x.clip==='string'&&/^[A-Za-z0-9_]+\.nsbca$/.test(x.clip)&&Number.isInteger(x.phaseFx)&&x.phaseFx>=-2147483648&&x.phaseFx<=2147483647&&Number.isInteger(x.resourceFlags)&&x.resourceFlags>=0&&x.resourceFlags<=3&&/^[a-f0-9]{64}$/.test(x.resourceSHA256);
/** A caller supplies conditional source state, never raw matrices or observed
 * identity. The ordinary single joint descriptor per component and initial
 * priority127/default callback mappings are explicit assumptions, not defaults.
 * Source draw attaches previous then current. Equal priorities preserve that
 * order in020b468c. Both links remain present at endpoint weights0/4096. */
export function nativeDrawAnimationTerms(condition){
 need(exact(condition,['kind','current','previous','previousWeightFx','componentType','drawBindingReachedAssumed','singleJointPerComponentAssumed','ordinaryPriority127Assumed','defaultCallbackAssumed','currentStateKnown'])&&condition.kind==='conditional-source-field-draw-links-v1'&&condition.componentType===1&&condition.drawBindingReachedAssumed===true&&condition.singleJointPerComponentAssumed===true&&condition.ordinaryPriority127Assumed===true&&condition.defaultCallbackAssumed===true&&condition.currentStateKnown===false,'Explicit conditional ordinary draw-link admission required');
 need(clip(condition.current),'Complete current draw animation resource binding required');
 if(condition.previous===null){need(condition.previousWeightFx===null,'Absent previous link must not supply a weight');return[{...condition.current,weightFx:4096,sourceRole:'current'}];}
 need(clip(condition.previous)&&Number.isInteger(condition.previousWeightFx)&&condition.previousWeightFx>=0&&condition.previousWeightFx<=4096,'Complete prior draw animation resource/weight binding required');
 need(condition.previous.clip!==condition.current.clip,'Same-clip component aliases outside ordinary single-component draw subset');
 return[{...condition.previous,weightFx:condition.previousWeightFx,sourceRole:'previous'},{...condition.current,weightFx:4096-condition.previousWeightFx,sourceRole:'current'}];
}
export function bindNativeDrawAnimationTerms(source,condition,resources){
 need(source?.kind==='source-ordinary-type1-draw-links-v1'&&source.spans?.length===SPANS.length,'Verified source draw-link rules required');
 return nativeDrawAnimationTerms(condition).map(t=>{const e=resources.get(t.clip);need(e&&e.resourceSHA256===t.resourceSHA256&&e.animation.resourceFlags===t.resourceFlags,'Draw animation source/condition binding differs');return{animation:e.animation,phaseFx:t.phaseFx,weightFx:t.weightFx};});
}
