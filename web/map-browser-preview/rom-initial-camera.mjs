// Ordinary initial camera presets, extracted from the supplied YDQJ SDK image.
// This is not the current camera after scripts, area blending, shake or player-follow.
export function readRomInitialCamera(sdk,selector){
 if(!Number.isInteger(selector)||selector<0||selector>3)throw Error('Map camera selector is unresolved');
 const word=a=>{const b=sdk.read(a,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);};
 const immediate=(a,opcode,rd)=>{const w=word(a);if((w>>>28)!==14||((w>>>25)&7)!==1||((w>>>21)&15)!==opcode||((w>>>12)&15)!==rd)throw Error('Camera initialization instruction differs at '+a.toString(16));const n=w&255,r=(w>>>8&15)*2;return ((n>>>r)|(n<<(32-r)))>>>0;};
 let height,radius,fov;
 if(selector===0){height=word(0x020a4574)|0;radius=immediate(0x020a4554,13,2);fov=immediate(0x020a4568,13,1);}
 if(selector===1){height=immediate(0x020a4580,13,1);radius=immediate(0x020a4588,13,2);fov=immediate(0x020a459c,13,1);}
 if(selector===2){height=word(0x020a45d8)|0;radius=word(0x020a45dc)|0;fov=immediate(0x020a45cc,13,1);}
 if(selector===3){height=word(0x020a4610)|0;radius=height+immediate(0x020a45f0,4,2);fov=immediate(0x020a4604,13,1);}
 return {selector,orbitHeightFx:height,radiusFx:radius,halfFovFx:fov,aspectFx:word(0x0202dbf8)|0,nearFx:immediate(0x0202daf0,13,1),farFx:immediate(0x0202daf8,13,2),upFx:[0,immediate(0x0202db34,13,0),0],scope:'ROM initial preset only; ground/target, current yaw and subsequent map/script camera changes remain separate'};
}
