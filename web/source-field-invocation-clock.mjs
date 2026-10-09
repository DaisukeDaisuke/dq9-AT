// A separate observation hypothesis. PTS is NOT converted to game ticks unless
// its explicit normal-speed/capture/ordinary-loop conditions hold. The unknown
// timing/scene/other-consumer branch always remains present.
import {decodeActorArm9} from './actor-rom-mining.mjs';
import {decodeMapEntryOverlay} from './map-entry-source-binding.mjs';
const owned=new WeakSet(),sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
const need=(x,m)=>{if(!x)throw Error(m);};
const ranges=[
 ['supported-natural-scheduler','arm9',0x02074568,2416,'ac479da1a8deeac5cc7cbf5f4287734ecb5ab2e189627d21b8036ab1250da4a5'],
 ['selected-field-reset','arm9',0x0202821c,140,'bf01f0edb9a0bc9e08debcdf027006f06a106d3fbda3fff60e0986d53a3ed496'],
 ['clock-delta-writer','arm9',0x0200ff80,224,'9b6a1cbd4e1e55de10ec3a277c0d677bcbdfe65caba3d6982377f636b84b18f5'],
 ['table-selection-helper','arm9',0x02075050,280,'cbbe70197f91ae4cbc59a0103a78445d65579c7e9c224c691bc0096ba32e061b'],
 ['weighted-one-draw-helper','arm9',0x02075168,132,'e3b6c313cf6e3bc0951422b0d254164d8318e32a7d0f33103d8d64ac496f5350'],
 ['ATRandInt-one-update','arm9',0x02031ea8,84,'4ea4d67380f9fe3bb907b4a872c35a0b49df5cbc1da329769a1a4560b716e3cb'],
 ['ordinary-loop-update-wait-return','overlay17',0x0218d0f4,1112,'6f4d23f6ab092d85bce1348f9ab43ff91deeae2100148d167fe4fab671f73938'],
 ['ordinary-scene-scheduler-dispatch','overlay17',0x0218d7b4,1172,'d1094bd2c86cbe07f1073985913b681753107ddc26a98e7dc14d49ac4bd07e58'],
 ['four-field-scheduler-loop','overlay17',0x021a2aec,100,'a5a9015d8bc89c5d9d8bb4b472cee1cebf20fa3b951661ec141b982459e2c282'],
 ['fresh-interrupt-mask1-wait','arm9',0x020cb2ec,28,'9cdbf509ae8fb9fbc96a1ef6a278357d7e0f0a5143d0d5c45041d18ad78336bb'],
 ['irq-mask-clear-and-wait','arm9',0x020c8420,116,'d7a6ce75904a9da442c2336990ec83765bb71b62aeea0d8aaf8dda9da79c3887']
];
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export async function bindOrdinaryFieldInvocationClock({rom,romSHA256}){
 need(rom instanceof Uint8Array&&/^[a-f0-9]{64}$/.test(romSHA256??'')&&await sha(rom)===romSHA256,'Owned ROM identity required');
 const images={arm9:decodeActorArm9(rom),overlay17:decodeMapEntryOverlay(rom)},sourceRanges=[];
 for(const[name,image,address,bytes,expected]of ranges){const r=images[image],b=r.bytes.subarray(address-r.base,address-r.base+bytes);need(b.length===bytes&&await sha(b)===expected,'Unsupported ordinary clock path: '+name);sourceRanges.push({name,image,address,bytes,sha256:expected});}
 const o=images.overlay17,v=new DataView(o.bytes.buffer,o.bytes.byteOffset,o.bytes.byteLength),clockKHz=v.getUint32(0x0218d430-o.base,true);
 need(clockKHz===33514,'Unsupported source tick-to-microsecond clock constant');
 // Standard DS LCD timing is a hardware assumption, not the video's encoded
 // FPS. References are the emulator authors' primary implementation sources.
 const lcd={dotsPerLine:355,cyclesPerDot:6,linesPerFrame:263},cyclesPerFrame=lcd.dotsPerLine*lcd.cyclesPerDot*lcd.linesPerFrame,maximumVBlankHz=Math.ceil(clockKHz*1000/cyclesPerFrame);
 const a=images.arm9,av=new DataView(a.bytes.buffer,a.bytes.byteOffset,a.bytes.byteLength),word=p=>av.getUint32(p-a.base,true),imm=w=>{const n=w&255,r=(w>>>8&15)*2;return((n>>>r)|(n<<(32-r)))>>>0;},attempts=imm(word(0x02074e08)),timerGate=imm(word(0x020745dc)),maxDelta=Math.floor(word(0x02010058)/imm(word(0x0200fff8)));
 need(attempts===4&&timerGate===1000&&maxDelta===50,'Unsupported scheduler budget constants');
 const value=freeze({schema:'ROM-ordinary-field-invocation-clock-v1',romSHA256,sourceRanges,clockKHz,standardLCD:{...lcd,cyclesPerFrame,references:['https://github.com/melonDS-emu/melonDS/blob/master/src/GPU.cpp#L28-L30','https://github.com/melonDS-emu/melonDS/blob/master/src/RTC.cpp']},maximumVBlankHz,maximumModeledNaturalDrawsPerInvocation:attempts*2+1,guaranteedNoDrawInvocationsAfterFreshReset:Math.floor((timerGate-1)/maxDelta),minimumFreshVBlankWaitsPerNormalLoop:1,selectedFieldInvocationsPerLoopMaximum:1,allFieldInvocationsPerLoopMaximum:4,endpointDisplayLagVBlanksEach:1,partialInitialLoopAllowance:1});owned.add(value);return value;
}
const conditions=[
 'Video PTS advances with uninterrupted recording time at normal speed or slower; no speed-up, removed time, hidden edit, seek or timestamp remapping occurs in this interval',
 'Standard DS LCD timing is in use; no turbo/overclock, VCOUNT rewriting, synthetic VBlank IRQ or alternate hardware timing',
 'Both endpoint observations represent the current display within one VBlank each; no longer display/capture buffering or stale frame is substituted',
 'The ordinary overlay17 field loop takes its normal VBlank-wait branch throughout; the branch that bypasses the wait is excluded only in this hypothesis',
 'No scene/module reentry, unobserved reload, reentrant dispatch or alternate scheduler invocation occurs inside this interval; skipped updates and stalls are allowed',
 'Natural scheduler branches remain inside the existing source-supported direction/table/weighted model; unsupported helper/callback consumers are outside this component',
 'Each selected field is visited at most once by the bound four-field loop; other actor/global/loader consumers are not declared absent'
];
function frame(f){return f&&/^[a-f0-9]{64}$/.test(f.romSHA256??'')&&typeof f.sourceId==='string'&&f.sourceId&&Number.isSafeInteger(f.sourceEpoch)&&Number.isSafeInteger(f.timelineSegment)&&Number.isFinite(f.sourcePTS)&&f.sourcePTS>=0&&Number.isSafeInteger(Math.ceil(f.sourcePTS*1000000))&&typeof f.frameKey==='string'&&f.frameKey;}
export function projectConditionalFieldInvocationSpan(binding,{fromFrame,toFrame,minimumInvocations=0,freshResetAfterStart=false}={}){
 need(owned.has(binding),'Fresh owned ordinary clock binding required');
 need(frame(fromFrame)&&frame(toFrame)&&fromFrame.romSHA256===binding.romSHA256&&['romSHA256','sourceId','sourceEpoch','timelineSegment'].every(k=>fromFrame[k]===toFrame[k])&&fromFrame.sourcePTS<=toFrame.sourcePTS,'Ordered exact same-source observation references required');
 need(Number.isSafeInteger(minimumInvocations)&&minimumInvocations>=0&&typeof freshResetAfterStart==='boolean','Explicit minimum invocation/reset hypotheses required');
 // Outward round to microseconds. Add two endpoint display phases and one
 // initially in-flight loop. Never use decoded/presented video frame counts.
 const us=BigInt(Math.ceil(toFrame.sourcePTS*1000000))-BigInt(Math.floor(fromFrame.sourcePTS*1000000)),hz=BigInt(binding.maximumVBlankHz),slack=BigInt(2*binding.endpointDisplayLagVBlanksEach+binding.partialInitialLoopAllowance),maximum=(us*hz+999999n)/1000000n+slack;
 const minimum=BigInt(minimumInvocations),empty=minimum>maximum;
 const eligibleMaximum=freshResetAfterStart?(maximum>BigInt(binding.guaranteedNoDrawInvocationsAfterFreshReset)?maximum-BigInt(binding.guaranteedNoDrawInvocationsAfterFreshReset):0n):maximum;
 const result={schema:'conditional-ordinary-field-clock-span-v1',kind:'normal-speed-unedited-standard-DS-ordinary-wait-hypothesis',fromFrame:structuredClone(fromFrame),toFrame:structuredClone(toFrame),romSHA256:binding.romSHA256,sourceRanges:structuredClone(binding.sourceRanges),sourceClockBinding:binding.schema,standardLCD:structuredClone(binding.standardLCD),conditions:conditions.slice(),conditionsMeasured:false,sourceInvocationDomain:{min:String(minimum),max:String(maximum),emptyUnderThisHypothesis:empty},allFieldInvocationMaximum:String(maximum*BigInt(binding.allFieldInvocationsPerLoopMaximum)),selectedFieldSchedulerComponentCalls:{min:'0',max:String(eligibleMaximum*BigInt(binding.maximumModeledNaturalDrawsPerInvocation)),scope:'Supported direction/table/weighted call sites of the selected field scheduler only',maximumCallsPerInvocation:binding.maximumModeledNaturalDrawsPerInvocation,excludedInitialZeroDrawInvocations:freshResetAfterStart?binding.guaranteedNoDrawInvocationsAfterFreshReset:0},calculation:{elapsedMicrosecondsUpper:String(us),maximumVBlankHz:binding.maximumVBlankHz,endpointAndInitialLoopAllowance:String(slack),formula:'ceil(outward-rounded elapsedSeconds * hardware VBlank Hz ceiling) + endpoint/initial-loop allowance'},freshResetAfterStart,minimumInvocationsDerivedFromVideoFPS:false,sourceClockCertified:false,sourceUpdateCountMeasured:false,unknownAlternativeRetained:true,otherConsumers:{min:'0',max:null},wholeWorldATCalls:{min:'0',max:null},currentATRecovered:false};
 if(freshResetAfterStart)result.conditions.push('The selected-field timer is freshly reset after the first endpoint and before any counted scheduler invocation, then receives only the ordinary delta0..50 writer/reset path; no timer/clock alias writer intervenes, and prior-map calls are outside this component');
 return result;
}
export function prepareReplayInputClockHypotheses(input,binding){
 need(owned.has(binding),'Owned ordinary loop clock binding required');
 const result={schema:'conditional-replay-clock-hypotheses-v1',spans:[],unresolved:[],unknownAlternativeRetained:true,sourceClockCertified:false,currentATRecovered:false};
 try{result.spans.push({scope:'selected-field updates between retained entry-marker observation and target observation',...projectConditionalFieldInvocationSpan(binding,{fromFrame:input.source,toFrame:input.targetFrame})});}catch(error){result.unresolved.push({scope:'observation interval',reason:error.message});}
 const min=input?.entryTimeHypothesis?.min,before=input?.entryWitnessFrames?.before;
 if(Number.isFinite(min)&&before?.sourcePTS===min){try{result.spans.push({scope:'fresh-reset post-entry selected-field prefix',...projectConditionalFieldInvocationSpan(binding,{fromFrame:before,toFrame:input.targetFrame,freshResetAfterStart:true})});}catch(error){result.unresolved.push({scope:'fresh reset',reason:error.message});}}
 else result.unresolved.push({scope:'fresh-reset post-entry selected-field prefix',reason:'Entry has no finite source-bound lower marker time; the fresh-reset invocation upper bound remains unknown'});
 return result;
}
