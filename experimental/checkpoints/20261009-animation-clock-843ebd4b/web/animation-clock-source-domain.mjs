// Source clock factors used by ordinary kind1 animation, not AT outputs and
// not the separate integer 0..3 actor-turn phase. No video-time conversion.
import {readArm9SdkImage} from './map-browser-preview/rom-arm9.mjs';
const owned=new WeakSet(),need=(v,m)=>{if(!v)throw Error(m);};
const ranges=[
 ['clock-initializer-and-setter',0x0200ff80,228,'0d091316931983819bf474d36eb388e461059a6354d11445a9e1fb7d0796dd64'],
 ['animation-clock-read-signed16',0x02034bd4,32,'4bccf292c9c8cea319f369d2bf062e394853533143cf5a57c16bfdedf79314ec'],
 ['source-float-to-integer',0x0200c4c0,116,'bd170e112b5aedf2925bc618ecad929625816b674389d8e59d66c4fae6677008']
];
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const signed16=n=>(n<<16)>>16,uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const factor=(q,rules)=>Math.trunc(Math.fround(Math.fround(q/rules.phaseDivisor)*rules.phaseScale));
export function isAnimationClockSourceDomain(value,romSHA256=value?.romSHA256){return owned.has(value)&&value.romSHA256===romSHA256;}
export async function readAnimationClockSourceDomain(rom,{romSHA256,sdk=null}={}){
 need(rom instanceof Uint8Array&&/^[a-f0-9]{64}$/.test(romSHA256??''),'ROM bytes and identity required');
 // A source object can be shared with other readers only after the owner has
 // matched the ROM identity; direct callers receive that check here too.
 need(await sha(rom)===romSHA256,'Animation clock ROM identity mismatch');sdk??=readArm9SdkImage(rom);
 for(const [name,address,size,expected] of ranges)need(await sha(sdk.read(address,size))===expected,'Unsupported animation clock source: '+name);
 const view=address=>{const b=sdk.read(address,4);return new DataView(b.buffer,b.byteOffset,b.byteLength);},u32=a=>view(a).getUint32(0,true),f32=a=>view(a).getFloat32(0,true);
 const immediate=a=>{const w=u32(a),n=w&255,s=((w>>>8)&15)*2;return((n>>>s)|(n<<(32-s)))>>>0;};
 const rules={maximumElapsedUs:u32(0x02010058),elapsedDivisor:immediate(0x0200fff8),rateUnit:f32(0x0201005c),phaseScale:f32(0x0201005c),phaseDivisor:f32(0x02010060),initialPhaseWide:immediate(0x0200ffa0)};
 need(rules.maximumElapsedUs>0&&rules.elapsedDivisor>0&&rules.rateUnit>0&&rules.phaseScale>0&&rules.phaseDivisor>0,'Positive source clock constants required');
 const maximumDelta=Math.floor(rules.maximumElapsedUs/rules.elapsedDivisor),maximumScaledDelta=Math.trunc(Math.fround(Math.fround(maximumDelta)*Math.fround(32767/rules.rateUnit)));
 // The setter loads the rate as signed16. Finite negative products return0
 // through 0200c4f4; no nonnegative rate or fixed4096 rate is assumed.
 const byValue=new Map();for(let q=0;q<=maximumScaledDelta;q++){const wide=factor(q,rules),value=signed16(wide);if(!byValue.has(value))byValue.set(value,[]);byValue.get(value).push(q);}
 const initial=signed16(rules.initialPhaseWide);if(!byValue.has(initial))byValue.set(initial,[]);
 const value=Object.freeze({kind:'source-animation-clock-domain-v1',romSHA256,rules:Object.freeze(rules),maximumDelta,maximumScaledDelta,
  candidates:Object.freeze([...byValue].sort(([a],[b])=>a-b).map(([clockPhaseFx,scaledDeltaAlternatives])=>Object.freeze({clockPhaseFx,scaledDeltaAlternatives:Object.freeze(scaledDeltaAlternatives),includesInitializer:clockPhaseFx===initial}))),
  sourceRanges:Object.freeze(ranges.map(([name,address,bytes,sha256])=>Object.freeze({name,address,bytes,sha256}))),
  sourceScope:'After ordinary clock initialization or0200ffac setter and02034bd4 animation read; no unmodeled writer. Entire signed16 rate domain retained. Actor clip rate and actor animation rate are separate unresolved inputs.',
  numericalSeedUsed:false,ATPredicateProduced:false,sourceInvocationCountKnown:false,videoTimeConverted:false,currentVideoStateRecovered:false,unknownAlternativeRetained:true});
 owned.add(value);return value;
}
export function projectAnimationClockFromSource(domain,{elapsedLow,elapsedHigh,rateFx,integerPhaseCounter}={}){
 need(isAnimationClockSourceDomain(domain),'Owned source animation clock domain required');
 need(uint(elapsedLow)&&uint(elapsedHigh)&&Number.isInteger(rateFx)&&rateFx>=-32768&&rateFx<=32767&&uint(integerPhaseCounter),'Explicit native-width clock setter inputs required');
 const r=domain.rules,elapsedUs=elapsedHigh!==0||elapsedLow>r.maximumElapsedUs?r.maximumElapsedUs:elapsedLow,delta=Math.floor(elapsedUs/r.elapsedDivisor),product=Math.fround(Math.fround(delta)*Math.fround(rateFx/r.rateUnit)),scaledDelta=product<0?0:Math.trunc(product),phaseWide=factor(scaledDelta,r),clockPhaseFx=signed16(phaseWide);
 need(domain.candidates.some(c=>c.clockPhaseFx===clockPhaseFx&&c.scaledDeltaAlternatives.includes(scaledDelta)),'Projected clock outside source domain');
 return {delta,scaledDelta,phaseWide,clockPhaseFx,integerPhase:Math.min(integerPhaseCounter,3),separateClockFields:true,atConsumed:0,sourceInvocationCountKnown:false};
}
