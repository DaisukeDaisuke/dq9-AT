// @script-id dq9_nonspawn_consumers
// Read-only fresh-state pairing of AT return, arithmetic result, and actual writer.
const CPU='arm9',reg=async n=>Number(await memory.getregister(n,CPU))>>>0,b=async a=>Number(await memory.readbyte(a,CPU))&255,u32=async a=>((await b(a))|((await b(a+1))<<8)|((await b(a+2))<<16)|((await b(a+3))<<24))>>>0;
let frame=null,armed=true,items=[],pending={};memory.ontick(e=>{frame=e.frame;});
function hook(pc,f){memory.registerexec(pc,async()=>{if(armed)await f();},{cpu:CPU});}
hook(0x020409d0,async()=>pending.movement={kind:'movement-init',frame,random:await reg('r0'),object:await reg('r4'),inputPC:'020409d0',storePC:'020409dc'});
hook(0x020409e0,async()=>{if(pending.movement){items.push({...pending.movement,result:await u32(pending.movement.object+4)});delete pending.movement;}});
hook(0x0203ccf0,async()=>pending.actor={kind:'actor-phase-init',frame,random:await reg('r0'),object:await reg('r4'),inputPC:'0203ccf0',storePC:'0203cd18'});
hook(0x0203ccf8,async()=>{if(pending.actor)pending.actor.remainder=await reg('r1');});
hook(0x0203cd1c,async()=>{if(pending.actor){items.push({...pending.actor,result:await u32(pending.actor.object+0x84)});delete pending.actor;}});
hook(0x0208fbd8,async()=>{const sp=await reg('sp'),model=await u32(sp+12);pending.pickup={kind:'pickup-materialize',frame,random:await reg('r0'),object:await reg('r9'),lower:await reg('r10'),upper:await u32(model+0x14),inputPC:'0208fbd8',storePC:'0208fbec'};});
hook(0x0208fbf0,async()=>{if(pending.pickup){items.push({...pending.pickup,result:await u32(pending.pickup.object+0x10)});delete pending.pickup;if(items.length>=24){armed=false;await emu.pause();}}});
return[{name:'dq9NonspawnRead',description:'Actual AT-return/result/writer pairs; state-relative and no automatic boot proof.',handler:async p=>{if(p?.disarm)armed=false;return{format:'dq9-nonspawn-actual-pairs',version:1,origin:'fresh-erahulita-state-not-boot',armed,items};}}];
