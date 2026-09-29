// @script-id dq9_at_field_trace
// Read-only UpdateAT entry/return trace. Helpers and exec strategy reused from
// LocalAI/scripts/dq9/pickup_spawn_at_probe.js; no write watch or register mutation.
const CPU='arm9',AT=0x020eee90;
const reg=async name=>Number(await memory.getregister(name,CPU))>>>0;
const u8=async address=>Number(await memory.readbyte(address,CPU))&255;
const u16=async a=>(await u8(a))|((await u8(a+1))<<8);
const u32=async a=>((await u8(a))|((await u8(a+1))<<8)|((await u8(a+2))<<16)|((await u8(a+3))<<24))>>>0;
let armed=false,limit=48,events=[],updates=0,pending=null,intCall=null,label=null,startSeed=null;
const record=e=>events.push({order:events.length,...e});
memory.registerexec(0x02003c30,async()=>{
 if(!armed)return;
 if(updates>=limit){armed=false;record({kind:'bounded-stop',beforeNextCall:true});await emu.pause();return;}
 pending={before:await u32(AT),caller:await reg('lr'),intCall:intCall?{...intCall}:null};
},{cpu:CPU});
memory.registerexec(0x02003c54,async()=>{
 if(!armed||!pending)return;
 record({kind:'UpdateAT',sequence:++updates,...pending,after:await u32(AT),random:await reg('r0')});pending=null;
},{cpu:CPU});
memory.registerexec(0x02031ea8,async()=>{if(armed){intCall={argument:await reg('r0'),caller:await reg('lr'),beforeUpdate:updates};record({kind:'ATRandInt-entry',...intCall});}},{cpu:CPU});
memory.registerexec(0x02031ef4,async()=>{if(armed&&intCall){record({kind:'ATRandInt-return',...intCall,result:await reg('r0'),afterUpdate:updates});intCall=null;}},{cpu:CPU});
for(const [address,kind] of [[0x02074568,'field-spawn-attempt'],[0x02075050,'field-table-select'],[0x02075168,'field-monster-select'],[0x021a2bb8,'spawn-create'],[0x021a2e74,'forced-spawn-path']])memory.registerexec(address,async()=>{if(!armed)return;const values={kind,address,atSequence:updates,r0:await reg('r0'),r1:await reg('r1'),r2:await reg('r2'),r3:await reg('r3'),lr:await reg('lr')};if(kind==='field-monster-select'&&values.r0>=0x02000000&&values.r0<0x02400000)values.tableId=await u16(values.r0);if(events.length<10000)record(values);},{cpu:CPU});
return [
 {name:'dq9ATTraceStart',description:'Arm a bounded read-only actual-ROM AT trace; does not reset game or modify seed.',handler:async(p,c)=>{if(!c.blocking)throw Error('blocking:true required');armed=false;events=[];updates=0;pending=null;intCall=null;limit=Math.max(1,Math.min(256,Number(p?.limit)||48));label=p?.label||null;startSeed=await u32(AT);record({kind:'trace-start',label,startSeed,mapId:await u16(0x020fb11c),origin:'paused-state-observation-not-boot'});armed=true;return {armed,limit,startSeed};}},
 {name:'dq9ATTraceRead',description:'Read current trace and optionally disarm it without changing the game.',handler:async p=>{if(p?.disarm)armed=false;return {format:'dq9-at-exec-trace',version:1,label,armed,startSeed,updates,events,proofOrigin:'state-not-boot'};}}
];
