// ROM-verified post-tick lifetime range. This is not a camera far plane.
// No absent actor, zero flag, post-tick state or draw ordering is inferred.
const need=(v,m)=>{if(!v)throw Error(m);},u16=n=>Number.isInteger(n)&&n>=0&&n<=65535,u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff,i32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const xyz=a=>Array.isArray(a)&&a.length===3&&[0,1,2].every(i=>Object.hasOwn(a,i)&&i32(a[i]));
const word=(image,address)=>{const b=image.read(address,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
function checked(image,address,length,expected){need(typeof image?.read==='function','Source image reader required');const b=image.read(address,length);need(b?.length===length,'Complete source function required');let hash=2166136261;for(const v of b)hash=Math.imul(hash^v,16777619)>>>0;need(hash===expected,'Unsupported source lifetime function at '+address.toString(16));return{address,length,fnv32:hash};}
const immediate=w=>{const v=w&255,n=(w>>>8&15)*2;return((v>>>n)|(v<<(32-n)))>>>0;};
const RULES=new WeakSet();
/** Guards include the writer, typed getters, raw-coordinate branch, inclusive
 * comparator and ordinary draw disabled-bit gate. The returned numeric range
 * is decoded from the unchanged source instructions, never supplied by a fit. */
export function readNaturalMonsterRangeRule({sdk,fieldOverlay}){
 need(fieldOverlay?.id===17,'Source field overlay17 required');
 const guards=[checked(fieldOverlay,0x021a2560,0x2c8,0x28d94441),...[ [0x02030c50,0x70,0x48cb5bfa],[0x02033c3c,0xcc,0xae06f339],[0x0202c094,0x38,0x256a5038],[0x0202b388,0x14,0xfdd528e1],[0x0201b350,0x28,0x3d41f8e7],[0x0200fbec,0x3c,0x39902c0d],[0x0200fc88,0x3c,0x39cfa80f],[0x02036e64,0x10,0x7318296f],[0x02035424,0x64,0x4d524e40] ].map(v=>checked(sdk,...v))];
 const rangeWords=[0x021a26dc,0x021a26e8,0x021a26ec,0x021a270c,0x021a2718,0x021a271c].map(a=>word(fieldOverlay,a)),rangeFx=immediate(rangeWords[0]);need(rangeWords.every(w=>immediate(w)===rangeFx),'Range axis instructions disagree');
 const mapMin=word(sdk,0x0201b374),mapMax=mapMin+immediate(word(sdk,0x0201b35c)),routeExemptionMask=[0x021a260c,0x021a2614,0x021a2634].reduce((mask,a)=>mask|immediate(word(fieldOverlay,a)),0),stateExemptions=[0x021a2758,0x021a275c].map(a=>immediate(word(fieldOverlay,a)));
 const result=Object.freeze({kind:'source-ordinary-monster-posttick-range',rangeFx,units:'signed FX32 XYZ box, inclusive, wrapping bounds',mapExemption:Object.freeze({min:mapMin,max:mapMax}),routeExemptionMask,stateExemptions:Object.freeze(stateExemptions),rangeAnchorSlots:Object.freeze([0,1,2,3]),source:Object.freeze({outer:0x021a2560,afterTick:0x021a2604,boxComparator:0x02030c50,resetCall:0x021a2768,disableCall:0x021a2770,ordinaryDrawGate:0x02035424,guards:Object.freeze(guards.map(Object.freeze))}),universalRange:false});RULES.add(result);return result;
}
/** Exact supported offline/raw-coordinate path. The range anchors are the
 * four registry indices0..3 returned by 0200fbec (header mask0x0002); they are not
 * assumed to be four independent multiplayer party leaders. Each range-actor entry is either a known
 * typed-getter miss, or a typed-getter hit with source map and raw XYZ. A missing
 * entry is unknown, not an absent actor. Actor XYZ is the supplied proposal.
 * Retain/reset are only this source post-tick decision, not actor existence. */
export function evaluateNaturalMonsterRange({rule,actor,context}){
 need(RULES.has(rule),'Rule must be read from the supplied source ROM');
 const out=(outcome,reason,extra={})=>({kind:'conditional-source-monster-range',outcome,resolved:outcome!=='unresolved',reason,rangeFx:rule.rangeFx,sourceOuter:rule.source.outer,visibilityCertified:false,absenceCertified:false,drawExclusionCertified:false,otherRuntimeBranchesUnknown:true,noEventPossible:true,minimumProvenATCalls:0,...extra}),unknown=reason=>out('unresolved',reason);
 if(context?.afterTickReached!==true||context.globalWord!==0||!u16(context.fieldGroupFlags)||(context.fieldGroupFlags&4)===0)return unknown('Offline raw-position active-group post-tick context is not established');
 if(context.typedRelookupSameActor!==true)return unknown('Post-tick typed relookup for the same actor is not established');
 if(!Number.isInteger(actor?.routeFlags)||actor.routeFlags<0||actor.routeFlags>255||!u16(context.managerMapId))return unknown('Post-tick route flags or manager map is unknown');
 if(actor.routeFlags&rule.routeExemptionMask)return out('retain','Source route-flag exemption');
 if(context.managerMapId>=rule.mapExemption.min&&context.managerMapId<=rule.mapExemption.max)return out('retain','Source manager-map exemption');
 if(!u16(actor.mapId)||!xyz(actor.positionFx))return unknown('Actor map or signed post-tick position is unknown');
 if(!Array.isArray(context.rangeActors)||context.rangeActors.length!==4||![0,1,2,3].every(i=>Object.hasOwn(context.rangeActors,i))||new Set(context.rangeActors.map(p=>p?.slot)).size!==4||context.rangeActors.some(p=>!p||!Number.isInteger(p.slot)||p.slot<0||p.slot>3))return unknown('All four unique typed actor lookup slots are required');
 let unresolvedParty=false;const checks=[];
 for(const p of context.rangeActors.slice().sort((a,b)=>a.slot-b.slot)){
  if(p.typedLookupKnown!==true||!u32(p.pointer)){unresolvedParty=true;checks.push({slot:p.slot,status:'unknown-typed-lookup'});continue;}
  if(p.pointer===0){checks.push({slot:p.slot,status:'typed-lookup-miss'});continue;}
  if(!u16(p.mapId)){unresolvedParty=true;checks.push({slot:p.slot,status:'unknown-map'});continue;}
  if(p.mapId!==actor.mapId){checks.push({slot:p.slot,status:'different-map'});continue;}
  if(!xyz(p.positionFx)){unresolvedParty=true;checks.push({slot:p.slot,status:'unknown-position'});continue;}
  const minimumFx=p.positionFx.map(v=>(v-rule.rangeFx)|0),maximumFx=p.positionFx.map(v=>(v+rule.rangeFx)|0),inside=actor.positionFx.every((v,i)=>v>=minimumFx[i]&&v<=maximumFx[i]);checks.push({slot:p.slot,status:inside?'inside-inclusive-box':'outside-box',minimumFx,maximumFx});
  if(inside)return out('retain','Same-map typed actor within source inclusive XYZ box',{checks});
 }
 if(!u32(actor.state))return unknown('Post-tick state is unknown');
 if(rule.stateExemptions.includes(actor.state))return out('retain','Source state exemption',{checks});
 if(unresolvedParty)return out('unresolved','A possibly eligible actor remains unknown',{checks});
 return out('reset-deactivate','Outside every same-map typed actor source box',{checks,resetRequested:true,resetDoesNotProveRegistryUnlink:true,ordinaryDrawExcludedOnlyIf:'This reset completed before the draw of the same actor lifetime, without intervening reactivation/recreation or relevant mutation'});
}
const FRAME_KEYS=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
function frameSame(a,b){return a&&b&&FRAME_KEYS.every(k=>a[k]!==null&&a[k]!==undefined&&a[k]===b[k])&&/^[a-f0-9]{64}$/.test(a.romSHA256)&&/^[a-f0-9]{64}$/.test(a.fullRGBA_SHA256);}
/** Additive hook for already generated source proposals. Never deletes, reorders
 * or rescales a proposal. An absent/stale branch-specific runtime binding stays
 * unresolved. Even reset-deactivate is not a video gate: draw order, lifetime
 * and the other unmodeled runtime alternatives remain explicitly unresolved. */
export function attachSourceMonsterRange(proposals,{rule,frame,branchId,regionId,modelId,variant,binding=null}){
 need(RULES.has(rule)&&Array.isArray(proposals),'Source rule and proposal list required');need(typeof branchId==='string'&&branchId.length&&(typeof regionId==='string'&&regionId.length||Number.isSafeInteger(regionId)&&regionId>=0)&&typeof modelId==='string'&&modelId.length&&typeof variant==='string'&&variant.length,'Exact background branch/region/model/variant required');
 const bound=frameSame(frame,binding?.frame)&&binding.branchId===branchId&&binding.regionId===regionId&&binding.modelId===modelId&&binding.variant===variant;
 return proposals.map(p=>({...p,sourceRange:bound?evaluateNaturalMonsterRange({rule,actor:{...binding.actor,positionFx:p.positionFx},context:binding.context}):{kind:'conditional-source-monster-range',outcome:'unresolved',resolved:false,reason:binding?'Runtime range binding is stale, incomplete or belongs to another background branch/region/model':'No independently bound same-frame actor/lifecycle context',rangeFx:rule.rangeFx,visibilityCertified:false,absenceCertified:false,drawExclusionCertified:false,otherRuntimeBranchesUnknown:true,noEventPossible:true,minimumProvenATCalls:0}}));
}
