// Source-only JP revision0 clock producer. No native-state packet, seed,
// elapsed video-time conversion, invocation schedule or AT consumption is inferred.
import {readArm9SdkImage,backwards} from './map-browser-preview/rom-arm9.mjs';
const BINDINGS={"arm9":[{"role":"clock-update","address":33619884,"bytes":184,"sha256":"376db4af26d2c9abc0b021954672ca685dcc09e65a15e40e5ef54c456b3dc429"},{"role":"clock-getters","address":33620068,"bytes":32,"sha256":"4d3b349599590f3f39ea9a5938d628a80beb7adb0241526e08a3a038ff22d149"},{"role":"npc-context-getter","address":33619736,"bytes":8,"sha256":"502a6b5e1e6c4fd6c50fc5efe69fa6146e340319217b6608210f70892b17e8e3"},{"role":"tick-snapshot","address":34383912,"bytes":160,"sha256":"c8b90b01a57322a310e7de8d15f8800507fee6cb4abeee6ae94bc0f718378454"},{"role":"timer-overflow-writer","address":34383808,"bytes":104,"sha256":"fa71f3f2e956bf1c09060191c259ef6544c1ffeb2f4ec1f9c533034ded09ce1d"},{"role":"phase-counter-writer","address":33630624,"bytes":92,"sha256":"f68130f1e33ca934f893dfdd97e7519653adc4f03bdfb0df1b222c8905899b20"},{"role":"npc-dispatch","address":33808924,"bytes":116,"sha256":"fd16be3fade778a72cf82b0d09caa8f5f458081e42d549c0b64fcc30f1dc5e90"},{"role":"scheduler-clock-use","address":34031024,"bytes":44,"sha256":"8104a43bab75c582601e82014e90382490986516978c5e2693438e2fdc6cb892"},{"role":"soft-arithmetic","address":33603584,"bytes":4416,"sha256":"5767f45db19bede1ea3d41381499398510803acdd3de0ddb611f4ca399fa43e7"},{"role":"controller-global","address":33616476,"bytes":12,"sha256":"b85aaade95c91b0c563ca03de3284574313ecef50f4a695bac43afb97b32a0c5"}],"overlay17":[{"role":"ordinary-field-elapsed","address":35181416,"bytes":284,"sha256":"b2954adbf60863496a110e7b9efda832f48b5753a1035a046b4fbf1082bb5ea2"}]};
const u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff,i16=n=>Number.isInteger(n)&&n>=-32768&&n<=32767;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const words=x=>exact(x,['low','high'])&&u32(x.low)&&u32(x.high),as64=x=>(BigInt(x.high)<<32n)|BigInt(x.low),out64=x=>({low:Number(BigInt.asUintN(32,x)),high:Number(BigInt.asUintN(32,x>>32n))});
const unresolved=(reason,missing=[])=>({resolved:false,reason,missing,nativeReplayExecuted:false,videoTimeUsed:false,minimumProvenATCalls:0});
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const value=(read,a,kind='u32')=>{const b=read(a,4),v=new DataView(b.buffer,b.byteOffset,b.byteLength);return kind==='float32'?v.getFloat32(0,true):v.getUint32(0,true);};
const literalValue=(read,a)=>{const w=value(read,a);if((w&0x0f7f0000)!==0x051f0000)throw Error('Expected guarded PC-relative literal load');return value(read,a+8+((w&0x00800000)?1:-1)*(w&4095));};
const armImmediate=w=>{const r=((w>>>8)&15)*2,b=w&255;return ((b>>>r)|(b<<(32-r)))>>>0;};
/** The arithmetic capability exists only after every consumer/producer range
 * matches the reviewed ROM instructions. readArm9/readOverlay17 are immutable
 * initialized source images, never live RAM or outputs from a later frame. */
export async function bindNativeReplayClockSource({readArm9,readOverlay17}){
 for(const [kind,read]of [['arm9',readArm9],['overlay17',readOverlay17]])for(const r of BINDINGS[kind]){const bytes=read(r.address,r.bytes);if(!(bytes instanceof Uint8Array)||bytes.length!==r.bytes||await hash(bytes)!==r.sha256)throw Error('Native clock source binding mismatch: '+r.role);}
 const c={maximumElapsed:value(readArm9,0x02010058),microDivisor:armImmediate(value(readArm9,0x0200fff8)),scaleUnit:value(readArm9,0x0201005c,'float32'),ratioDivisor:value(readArm9,0x02010060,'float32'),maximumPhase:armImmediate(value(readArm9,0x0200ffe4)),tickNumerator:armImmediate(value(readOverlay17,0x0218d44c)),tickDenominator:value(readOverlay17,0x0218d430),timerIRQMask:armImmediate(value(readArm9,0x020ca868)),timerHalfMask:armImmediate(value(readArm9,0x020ca874)),overflowHighMask:value(readArm9,0x020ca8c0)};
 const source={schema:'ROM-native-replay-clock-source-v1',bindings:structuredClone(BINDINGS),constants:{...c},controllerAddress:value(readArm9,0x0200f264),timerDataAddress:value(readArm9,0x020ca8bc),overflowCounterAddress:value(readArm9,0x020ca8c4)+8,zeroElapsedFlagAddress:literalValue(readOverlay17,0x0218d3b0)};
 /** Operands in the native read order while interrupts are disabled. This
  * models pending TIMER0 overflow correction, not a fabricated timer origin. */
 function sampleHardwareTick(input){
  const keys=['timer0Data','overflowLow','overflowHigh','irqFlags','interruptsDisabled'];
  if(!exact(input,keys)||input.interruptsDisabled!==true||!u32(input.timer0Data)||input.timer0Data>65535||!['overflowLow','overflowHigh','irqFlags'].every(k=>u32(input[k])))return unresolved('Exact native timer-read operands and interrupt boundary required',keys);
  let count=(BigInt(input.overflowHigh&c.overflowHighMask)<<32n)|BigInt(input.overflowLow);const corrected=Boolean((input.irqFlags&c.timerIRQMask)&&!(input.timer0Data&c.timerHalfMask));if(corrected)count++;
  return {resolved:true,tick:out64(BigInt.asUintN(64,(count<<16n)|BigInt(input.timer0Data))),pendingOverflowCorrected:corrected,nativeStateCertified:false,videoTimeUsed:false};
 }
 /** 0200ffac: elapsed-u64 clamp/divide, phase transfer/reset, signed Q12 scale
  * through native float32 arithmetic and unsigned truncation. */
 function updateControllerClock(input){
  const keys=['elapsedLow','elapsedHigh','scaleQ12','pendingPhaseCounter'];
  if(!exact(input,keys)||!u32(input.elapsedLow)||!u32(input.elapsedHigh)||!i16(input.scaleQ12)||!u32(input.pendingPhaseCounter))return unresolved('Native elapsed words, signed scale and phase counter required',keys);
  const micros=input.elapsedHigh||input.elapsedLow>c.maximumElapsed?c.maximumElapsed:input.elapsedLow,delta=Math.trunc(micros/c.microDivisor),scale=Math.fround(input.scaleQ12/c.scaleUnit),product=Math.fround(Math.fround(delta)*scale);
  // Source0200c4f4 returns0 for bounded negative finite values. Do not wrap
  // negative scale into a huge unsigned duration or force it to nominal speed.
  const scaledDelta=product<0?0:Math.trunc(product)>>>0,phase=Math.min(input.pendingPhaseCounter,c.maximumPhase),ratioFx=Math.trunc(Math.fround(Math.fround(Math.fround(scaledDelta)/c.ratioDivisor)*c.scaleUnit));
  return {resolved:true,delta,scaledDelta,phase,ratioFx,writes:{'0x3b8':delta,'0x3b4':scaledDelta,'0x3c4':phase,'0x3c8':0,'0x3c0':ratioFx},firstSpawnClockDomainSupported:delta<=50&&scaledDelta<=50,nativeStateCertified:false,videoTimeUsed:false,minimumProvenATCalls:0};
 }
 /** Ordinary field overlay17 dispatch. The timestamp stored for the next
  * invocation is read AFTER updateControllerClock, not the before-update tick.
  * All tick operands must come from their own native source points. */
 function projectFieldClockDispatch(input){
  const keys=['zeroElapsedFlag','previousTick','currentTick','postUpdateTick','scaleQ12','pendingPhaseCounter'];
  if(!exact(input,keys)||!u32(input.zeroElapsedFlag)||input.zeroElapsedFlag>255||!words(input.postUpdateTick)||!i16(input.scaleQ12)||!u32(input.pendingPhaseCounter)||(input.zeroElapsedFlag===0&&(!words(input.previousTick)||!words(input.currentTick))))return unresolved('Reached overlay17 clock branch requires native tick origins, post-update tick, runtime flag, scale and phase counter',keys);
  const difference=input.zeroElapsedFlag===0?BigInt.asUintN(64,as64(input.currentTick)-as64(input.previousTick)):null,elapsed=difference===null?0n:BigInt.asUintN(64,difference*BigInt(c.tickNumerator))/BigInt(c.tickDenominator),e=out64(elapsed),clock=updateControllerClock({elapsedLow:e.low,elapsedHigh:e.high,scaleQ12:input.scaleQ12,pendingPhaseCounter:input.pendingPhaseCounter});
  return {resolved:true,clock,tickDifference:difference===null?null:out64(difference),elapsed:e,nextPreviousTick:{...input.postUpdateTick},replayClock:{delta:clock.delta,actorClock:{scaledDelta:clock.scaledDelta,phase:clock.phase}},unproduced:['Reached invocation schedule and native source-frame identity','Initial seed, loader/actor/registry/field state and intervening consumers','NPC dispatcher context argument from controller+0x3b0'],sourceBranch:input.zeroElapsedFlag?'explicit-zero-elapsed-runtime-flag':'hardware-tick-difference',nativeReplayExecuted:false,videoTimeUsed:false,minimumProvenATCalls:0};
 }
 return Object.freeze({get source(){return structuredClone(source);},sampleHardwareTick,updateControllerClock,projectFieldClockDispatch});
}
/** Source loader only. Overlay17 is a reviewed native code binding, not a
 * rule selecting a video map or an assumption that its dispatch was reached. */
export async function createNativeReplayClockProducer(rom){
 const sdk=readArm9SdkImage(rom),v=new DataView(rom.buffer,rom.byteOffset,rom.byteLength),table=v.getUint32(0x50,true),size=v.getUint32(0x54,true),fat=v.getUint32(0x48,true);if(table+size>rom.length||size%32)throw Error('Invalid ARM9 overlay table');
 const rows=[];for(let p=table;p<table+size;p+=32)if(v.getUint32(p,true)===17)rows.push({base:v.getUint32(p+4,true),size:v.getUint32(p+8,true),fileId:v.getUint32(p+24,true),flags:v.getUint32(p+28,true)});
 if(rows.length!==1)throw Error('Native field clock overlay binding missing');const r=rows[0],p=fat+8*r.fileId;if(p+8>rom.length)throw Error('Overlay FAT bounds');const start=v.getUint32(p,true),end=v.getUint32(p+4,true);if(end<start||end>rom.length)throw Error('Overlay payload bounds');const raw=rom.subarray(start,end),bytes=r.flags&0x01000000?backwards(raw):raw;if(bytes.length!==r.size)throw Error('Overlay expanded size');
 return bindNativeReplayClockSource({readArm9:sdk.read,readOverlay17:(a,n)=>{if(a<r.base||a+n>r.base+bytes.length)throw Error('Native clock overlay range');return bytes.subarray(a-r.base,a-r.base+n);}});
}
