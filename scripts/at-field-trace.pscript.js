// @script-id dq9_at_field_trace
// Read-only live ROM observation, reusing the existing AT trace. No game state/register writes.
const CPU='arm9',AT=0x020eee90;
const reg=async n=>Number(await memory.getregister(n,CPU))>>>0;
const u8=async a=>Number(await memory.readbyte(a,CPU))&255;
const u16=async a=>(await u8(a))|((await u8(a+1))<<8);
const u32=async a=>((await u8(a))|((await u8(a+1))<<8)|((await u8(a+2))<<16)|((await u8(a+3))<<24))>>>0;
let armed=false,limit=48,events=[],updates=0,pending=null,intCall=null,label=null,startSeed=null;
let scheduler=false,schedulerInstalled=false,schedulerEvents=[],run=0,frame=null,field=0;
const record=e=>events.push({order:events.length,...e});
// S rows: [kind, invocation, lastCompletedFrame, atSequence, ...fields]. Exec events do not contain frame.
const sched=(kind,values)=>schedulerEvents.push([kind,run,frame,updates,...values]);
memory.ontick(({frame:f})=>{frame=f;});
memory.registerexec(0x02003c30,async()=>{
 if(!armed)return;
 if(updates>=limit){armed=false;record({kind:'bounded-stop',beforeNextCall:true});await emu.pause();return;}
 pending={before:await u32(AT),caller:await reg('lr'),intCall:intCall?{...intCall}:null};
},{cpu:CPU});
memory.registerexec(0x02003c54,async()=>{if(armed&&pending){record({kind:'UpdateAT',sequence:++updates,...pending,after:await u32(AT),random:await reg('r0')});pending=null;}},{cpu:CPU});
memory.registerexec(0x02031ea8,async()=>{if(armed){intCall={argument:await reg('r0'),caller:await reg('lr'),beforeUpdate:updates};record({kind:'ATRandInt-entry',...intCall});}},{cpu:CPU});
memory.registerexec(0x02031ef4,async()=>{if(armed&&intCall){record({kind:'ATRandInt-return',...intCall,result:await reg('r0'),afterUpdate:updates});intCall=null;}},{cpu:CPU});
for(const [address,kind] of [[0x02074568,'field-spawn-attempt'],[0x02075050,'field-table-select'],[0x02075168,'field-monster-select'],[0x021a2bb8,'spawn-create'],[0x021a2e74,'forced-spawn-path']])memory.registerexec(address,async()=>{
 if(!armed)return;
 const v={kind,address,atSequence:updates,r0:await reg('r0'),r1:await reg('r1'),r2:await reg('r2'),r3:await reg('r3'),lr:await reg('lr')};
 if(kind==='field-spawn-attempt'&&scheduler){run++;field=v.r0;if(field>=0x02000000&&field<0x02400000)sched('entry',[field,await u16(field),await u8(field+12),await u32(field+8)]);}
 if(kind==='field-monster-select'&&v.r0>=0x02000000&&v.r0<0x02400000)v.tableId=await u16(v.r0);
 if(scheduler)v.schedulerInvocation=run;
 if(events.length<30000)record(v);
},{cpu:CPU});
function installScheduler(){
 if(schedulerInstalled)return;
 const hook=(address,fn)=>memory.registerexec(address,async()=>{if(armed&&scheduler)await fn();},{cpu:CPU});
 hook(0x020745d0,async()=>{field=await reg('r8');sched('delta',[await u32(field+8),await reg('r0')]);});
 hook(0x020745dc,async()=>sched('timer',[await reg('r0')]));
 hook(0x020745fc,async()=>sched('slot',[(await reg('r0'))|0]));
 hook(0x020748cc,async()=>sched('member',[(await reg('r9'))|0,await u32((await reg('sp'))+0x18)]));
 hook(0x02074b38,async()=>{const count=await reg('r7'),sp=await reg('sp'),ids=[];if(count<=17)for(let i=0;i<count;i++){const p=await u32(sp+0x60+4*i);ids.push(await u8(p));}sched('direction',[(await reg('r4'))|0,count,ids]);});
 hook(0x02074b64,async()=>sched('node',[(await reg('r4'))|0]));
 hook(0x02074dc8,async()=>{const p=await reg('r0');sched('table',[p,p?await u16(p):null,p?await u32(p+4):null]);});
 hook(0x02074df0,async()=>sched('delay',[(await reg('r1'))|0,(await reg('r0'))|0,await reg('r11'),await reg('r4'),await u32((await reg('sp'))+0x18)]));
 hook(0x02074e10,async()=>sched('tail',[await reg('r11'),await u32((await reg('sp'))+0x18)]));
 hook(0x02074e20,async()=>sched('weighted',[(await reg('r0'))|0]));
 hook(0x02074ebc,async()=>sched('created',[await reg('r0')]));
 hook(0x02074ec8,async()=>{const p=await reg('r8');sched('exit',[p>=0x02000000&&p<0x02400000?await u32(p+8):null]);});
 schedulerInstalled=true;
}
function compact(){return {format:'dq9-at-observed-exec-series',version:2,label,origin:'paused-state-observation-not-boot',startSeed,updates:events.filter(e=>e.kind==='UpdateAT').map(e=>[e.sequence,e.after,e.random,e.caller]),intCalls:events.filter(e=>e.kind==='ATRandInt-return').map(e=>[e.afterUpdate,e.argument,e.result,e.caller]),spawnCreationEntries:events.filter(e=>e.kind==='spawn-create').map(e=>[e.atSequence,e.r2,e.r3,e.r1]),rawSpawns:events.filter(e=>e.kind==='spawn-create'),intentCounts:Object.fromEntries(['field-spawn-attempt','field-table-select','field-monster-select','spawn-create'].map(k=>[k,events.filter(e=>e.kind===k).length])),tableCalls:events.filter(e=>e.kind==='field-table-select').map(e=>[e.atSequence,e.r0,e.r1,e.r2,e.r3]),schedulerEvents,schedulerSchema:'[kind,invocation,lastCompletedFrame,atSequence,...values]; see scripts/at-field-trace.pscript.js hook PCs',spawnOutcomesDecoded:scheduler,bounded:!armed};}
return [
 {name:'dq9ATTraceStart',description:'Arm a bounded read-only actual-ROM AT trace; optional scheduler branch observations.',handler:async(p,c)=>{if(!c.blocking)throw Error('blocking:true required');armed=false;events=[];schedulerEvents=[];run=0;updates=0;pending=null;intCall=null;limit=Math.max(1,Math.min(256,Number(p?.limit)||48));label=p?.label||null;scheduler=p?.scheduler===true;if(scheduler)installScheduler();startSeed=await u32(AT);record({kind:'trace-start',label,startSeed,mapId:await u16(0x020fb11c),origin:'paused-state-observation-not-boot'});armed=true;return {armed,limit,startSeed,scheduler};}},
 {name:'dq9ATTraceRead',description:'Read real observations; summary avoids repeating large traces.',handler:async p=>{if(p?.disarm)armed=false;if(p?.summary)return {armed,updates,run,schedulerRows:schedulerEvents.length,startSeed,label,lastFrame:frame,created:schedulerEvents.filter(r=>r[0]==='created').length,lastScheduler:schedulerEvents.slice(-8)};if(p?.compact)return compact();return {format:'dq9-at-exec-trace',version:2,label,armed,startSeed,updates,events,schedulerEvents,proofOrigin:'state-not-boot'};}}
];
