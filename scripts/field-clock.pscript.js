// @script-id dq9_field_clock
// Bounded read-only observation of the actual elapsed-input -> field-delta writer.
const CPU='arm9',rows=[];
const reg=async n=>Number(await memory.getregister(n,CPU))>>>0;
const b=async a=>Number(await memory.readbyte(a,CPU))&255;
const u32=async a=>((await b(a))|((await b(a+1))<<8)|((await b(a+2))<<16)|((await b(a+3))<<24))>>>0;
let pending=null,armed=true,frame=null;
memory.ontick(e=>{frame=e.frame;});
memory.registerexec(0x0200ffac,async()=>{if(armed)pending={frame,manager:await reg('r0'),elapsedLow:await reg('r1'),elapsedHigh:await reg('r2'),caller:await reg('lr')};},{cpu:CPU});
memory.registerexec(0x02010004,async()=>{if(!armed||!pending)return;rows.push({...pending,delta:await u32(pending.manager+0x3b8),r0:await reg('r0')});pending=null;if(rows.length>=24){armed=false;await emu.pause();}},{cpu:CPU});
return [{name:'dq9FieldClockRead',description:'Read real field-delta writer inputs/results; no state changes.',handler:async()=>({format:'dq9-field-clock-observation',version:1,origin:'paused-state-not-boot',entryPC:'0200ffac',resultPC:'02010004',armed,rows})}];
