import {readArm9SdkImage} from './map-browser-preview/rom-arm9.mjs';
const owned=new WeakSet();
const ranges=[
 ['detector-dispatch',0x02079fa0,396,'db19c7526cec8be981b56e4d962595ef56f4e8ba14e8791b9836c53337547674'],
 ['shared-mode3-mode4-detector',0x0207a2b4,312,'1a6ac41314756ff85a92d1ba412a7d7d79545344978b858d7f04de0d67a3304c'],
 ['state2-arrival',0x02078118,772,'0ad96b64e21313475906fc5a0652114ff2312578c3a33455cd0ee9cbaead9211'],
 ['state-change-dispatch',0x02077be8,104,'23177de72c8001df63f54c426a1163bce4919f68625aede114f1db923da2527e'],
 ['state1-entry',0x02077cbc,84,'5aa590dfc86a645024dcc0706cfd1c51cf71360a7b4326e06b7a6c673fb00ea2'],
 ['state1-dispatch-entry',0x020e8ab0,8,'59c5c717bb37e62df7af90490a6f98003e4d4f2794411219b6f2507ef6e7b57b']
];
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export function isMovementNoDrawSource(value,romSHA256=value?.romSHA256){return owned.has(value)&&value.romSHA256===romSHA256;}
// Bind the newly supported paths relative to the existing all-type1 animation,
// raw-global-position, no-correction/no-alert movement contract. This is not a
// complete runtime initializer, a near-party detector, or an outer tick proof.
export async function readMovementNoDrawSource(rom,{sdk=null,romSHA256}={}){
 if(!/^[a-f0-9]{64}$/.test(romSHA256??''))throw Error('Owned ROM identity required');
 sdk??=readArm9SdkImage(rom);
 for(const [name,address,bytes,expected] of ranges)if(await sha(sdk.read(address,bytes))!==expected)throw Error(`Unsupported movement source: ${name}`);
 const immediate=address=>{const bytes=sdk.read(address,4),word=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,true),n=word&255,shift=((word>>>8)&15)*2;return((n>>>shift)|(n<<(32-shift)))>>>0;};
 const value=Object.freeze({kind:'source-bound-movement-no-additional-draw-v1',romSHA256,
  mode3Radius:immediate(0x0207a04c),mode4Radius:immediate(0x0207a060),detectorComparison:'strict-distance-less-than',
  mode4Scope:'Same 0207a2b4 leaf as mode3, with ROM radius; no eligible target selected',
  earlyArrivalScope:'Positive full distance below4096 reaches state1 entry, then ordinary XZ arrival; repeated state1 change is a no-op',
  additionalDrawsInThesePaths:0,nearPartyState10Resolved:false,zeroVectorNormalizationResolved:false,worldStepResolved:false,
  sourceRanges:Object.freeze(ranges.map(([name,address,bytes,sha256])=>Object.freeze({name,address,bytes,sha256}))) });
 owned.add(value);return value;
}
