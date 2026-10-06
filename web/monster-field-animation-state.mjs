// Bounded ordinary-field source rules. No seconds-to-ticks conversion, guessed
// actor state, live clip/phase/visibility selection, or automatic phase sweep.
const need=(v,m)=>{if(!v)throw Error(m);},s32=x=>Number(BigInt.asIntN(32,x)),int=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
function hash(bytes){let h=0x811c9dc5;for(const b of bytes)h=Math.imul(h^b,0x1000193)>>>0;return h;}
const SPANS=[[33764352, 2304, 3685144010], [33777632, 1536, 4208937979], [33769216, 2560, 559806485], [34504800, 384, 1988812298], [34535472, 400, 346233062], [34535440, 600, 2250897246]];
export function readFieldAnimationRules(sdk){
 need(sdk?.read,'Original source reader required');const evidence=SPANS.map(([address,length,checksum])=>{const bytes=sdk.read(address,length);need(bytes.length===length&&hash(bytes)===checksum,'Field animation source mismatch');return{address,length,checksum};});
 const u32=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.length).getUint32(0,true);},string=a=>{const b=sdk.read(a,24),end=b.indexOf(0);need(end>0,'Source clip name missing terminator');return new TextDecoder().decode(b.subarray(0,end));},s8=a=>Array.from(sdk.read(a,12),x=>(x<<24)>>24);
 return{kind:'source-field-animation-rules-v1',evidence,transitions:Array.from({length:9},(_,mode)=>s8(0x020ef8b4+mode*13)),nextModes:Array.from({length:9},(_,mode)=>(sdk.read(0x020ef8c0+mode*13,1)[0]<<24)>>24),clipNames:Array.from({length:12},(_,i)=>string(u32(0x020ef884+4*i))),postureNames:Array.from({length:7},(_,i)=>string(u32(0x020ef868+4*i))),postureIndices:Array.from(sdk.read(0x020e8100,14)),flags:Array.from({length:12},(_,i)=>u32(0x020e8110+4*i)),followingTransitions:s8(0x020e80f4)};
}
/** 0203390c -> 020336d8 requests by actor mode/posture. The component-list
 * lookup can fail and is not inferred from a file's mere presence. */
export function deriveFieldAnimationRequest(rules,{mode,transition,postureByte,registrySlot}){
 need(rules?.kind==='source-field-animation-rules-v1'&&int(mode,0,255)&&int(transition,0,255)&&int(postureByte,0,255)&&int(registrySlot,-32768,32767),'Explicit native-width actor mode/transition/posture/slot required');
 if(mode>=9)return{resolved:true,requested:false,reason:'Source mode>=9 returns before selector',liveStateKnown:false};
 const prior=transition>=12?0:transition,selected=rules.transitions[mode][prior];if(selected<0)return{resolved:true,requested:false,selected,transitionAfter:prior,reason:'Source negative transition returns without requesting clip',liveStateKnown:false};
 if(selected===0){const posture=postureByte>>>4;if(posture>=7)return{resolved:true,requested:false,selected,transitionAfter:0,reason:'Source posture>=7 skips request',liveStateKnown:false};const row=registrySlot>=192&&registrySlot<=199?1:0,index=rules.postureIndices[row*7+posture];return{resolved:true,requested:true,selected,requests:[{name:rules.postureNames[index],flags:16},{name:rules.clipNames[0],flags:0,onlyIfPreviousLookupFails:true}],transitionAfter:0,liveStateKnown:false,componentLookupResolved:false};}
 const next=rules.followingTransitions[selected];return{resolved:true,requested:true,selected,requests:[{name:rules.clipNames[selected],flags:rules.flags[selected]}],transitionAfter:next>=0?next:selected,liveStateKnown:false,componentLookupResolved:false};
}
/** Reached 02034d5c / 02034ddc arithmetic leaf only. Caller has already passed
 * pause, current clip, blend and first-tick gates. period is (frames-1)*4096,
 * with one source wrap/subtract, never a fabricated continuous video clock. */
export function advanceFieldAnimationPhase(rules,{phaseFx,clockPhaseFx,clipRateFx,actorRateFx,numFrames,reverse,clampAtEnd,advanceAllowed}){
 need(rules?.kind==='source-field-animation-rules-v1'&&int(phaseFx,-2147483648,2147483647)&&int(clockPhaseFx,-32768,32767)&&int(clipRateFx,-2147483648,2147483647)&&int(actorRateFx,-32768,32767)&&int(numFrames,2,512)&&[reverse,clampAtEnd,advanceAllowed].every(v=>typeof v==='boolean'),'Explicit reached-field-clock leaf inputs required');
 const roundMul=(a,b)=>s32((BigInt(a)*BigInt(b)+2048n)>>12n),deltaFx=roundMul(roundMul(clockPhaseFx,clipRateFx),actorRateFx),periodFx=(numFrames-1)*4096;
 let next=advanceAllowed?s32(BigInt(phaseFx)+(reverse?-BigInt(deltaFx):BigInt(deltaFx))):phaseFx,crossed=reverse?next<=0:next>=periodFx,completed=false;
 if(crossed){if(clampAtEnd){next=reverse?0:periodFx;completed=true;}else next=s32(BigInt(next)+(reverse?BigInt(periodFx):-BigInt(periodFx)));}
 return{phaseFx:next,previousPhaseFx:phaseFx,deltaFx,periodFx,crossed,completed,sourceSingleWrap:true,liveClockKnown:false,blendEvaluated:false};
}
