import {readRomInitialHeading} from './rom-initial-heading.mjs';
// Ordinary field-camera input clamp endpoints; no current input/yaw inference.
export function readRomCameraYawCandidates(sdk){
 const u32=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const check=[[0x020a40c4,0xe59f13b4],[0x020a40cc,0xe1560001],[0x020a40d0,0xda000002],[0x020a40d4,0xe59f03a8],[0x020a40d8,0xe1560000],[0x020a40dc,0xb1a06001],[0x020a4128,0xe59f1350],[0x020a4130,0xe1560001],[0x020a4134,0xda000002],[0x020a4138,0xe59f0344],[0x020a413c,0xe1560000],[0x020a4140,0xb1a06000]];
 for(const[a,w]of check)if(u32(a)!==w)throw Error('Source camera clamp instructions differ at'+a.toString(16));
 const positive=u32(0x020a4480)|0,negativeWrapped=u32(0x020a4484)|0,period=25736;if(!(positive>0&&negativeWrapped>positive&&negativeWrapped<period))throw Error('Source clamp literals invalid');
 return{candidates:[{kind:'ROM-initial-yaw',yawFx:readRomInitialHeading(sdk).yawFx},{kind:'positive-input-clamp',yawFx:positive},{kind:'negative-input-clamp',yawFx:negativeWrapped}].map(r=>({...r,yawDegrees:r.yawFx/period*360})),source:{checks:check,literals:[0x020a4480,0x020a4484]},period,scope:'Only initial and native ordinary input clamp endpoints. Intermediate retained/transition yaw, extra/script yaw and current input state remain unobserved. These are alternative preview parameters, never measured camera values.'};
}
