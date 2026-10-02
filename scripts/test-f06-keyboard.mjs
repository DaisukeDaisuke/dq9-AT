import assert from'node:assert/strict';import fs from'node:fs';
import{validateF06KeyboardInput,F06_KEYBOARD_GATES,advanceF06HeroMotion}from'../web/f06-hero-motion.mjs';
import{sourceF06KeyboardAngles}from'../web/f06-creator.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=f=>{assert.throws(f);checks++},gates=Object.fromEntries(F06_KEYBOARD_GATES.map(k=>[k,true])),input=heldDirection=>({heldDirection,gates:structuredClone(gates)});
for(const key of ['Down','Right','Up','Left','None'])eq(validateF06KeyboardInput(input(key)).heldDirection,key);
for(const key of ['UpLeft','UpRight','DownLeft','DownRight','','down',null,undefined,[]])reject(()=>validateF06KeyboardInput(input(key)));
for(const k of F06_KEYBOARD_GATES)for(const val of [false,null,undefined,0,1]){const i=input('Right');i.gates[k]=val;reject(()=>validateF06KeyboardInput(i));}
for(const mutate of [i=>i.futureXYZ=[0,0,0],i=>i.seed=1,i=>i.targetAngle=6434,i=>i.gates.futureFlag=true,i=>delete i.gates.noTouchOverride]){const i=input('Down');mutate(i);reject(()=>validateF06KeyboardInput(i));}
const state={xyz:[0,100,0],angle:6434,targetAngle:6434,speed:0,movementByte:1,header:0xbc3,turnRate:804,targetSpeed:393,acceleration:40,e0:32,c1:0,c2:64,delayWord:0,gravity:0,verticalVelocity:0,verticalLimit:0,verticalCounter:0},plan={state,lock:-1,hero:{width:4096,height:6144,groundFlags:0},graph:{nodes:[{id:0,position:[0,0,0]}]},terrain:{},keyboardAngles:{Down:0,Right:6434,Up:12868,Left:19302}},clock={phase:2,scaledDelta:33},fake={kinematicPrefix:s=>({resolved:true,kinematic:structuredClone(s)}),walkingGround:xyz=>({resolved:true,horizontalExclusionDerived:true,nextXYZ:[...xyz],objects:[{accepted:true,selectedId:1}],bestY:100,height:100})};
const original=JSON.stringify(plan);let r=advanceF06HeroMotion(plan,fake,clock,input('None'));eq([r.state.movementByte,r.state.targetAngle],[0,6434]);r=advanceF06HeroMotion({...plan,state:{...state,movementByte:0}},fake,clock,input('Down'));eq([r.state.movementByte,r.state.targetAngle],[1,0]);r=advanceF06HeroMotion(plan,fake,clock,input('Right'));eq([r.state.movementByte,r.state.targetAngle],[1,6434]);r=advanceF06HeroMotion({...plan,lock:1},fake,clock,input('Right'));eq([r.state.movementByte,r.state.targetAngle,r.lock],[0,6434,-32]);for(const [key,angle] of [['Up',12868],['Left',19302]]){r=advanceF06HeroMotion(plan,fake,clock,input(key));eq([r.state.movementByte,r.state.targetAngle],[1,angle]);}
eq(JSON.stringify(plan),original);
eq(advanceF06HeroMotion({...plan,keyboardAngles:null},fake,clock,input('Right')).resolved,false);eq(advanceF06HeroMotion(plan,fake,clock,input('UpLeft')).resolved,false);
// Legacy callers remain held-Down by default and do not require new angles/gates.
r=advanceF06HeroMotion({...plan,keyboardAngles:null},fake,clock);eq([r.state.movementByte,r.state.targetAngle],[1,0]);
// Synthetic uncompressed ARM9 fixture exercises every newly enforced source gate.
const sourceROM=new Uint8Array(0xe8400),dv=new DataView(sourceROM.buffer),base=0x02000000,offset=0x200,size=sourceROM.length-offset;
sourceROM.set([89,68,81,74],12);dv.setUint32(0x20,offset,true);dv.setUint32(0x28,base,true);dv.setUint32(0x2c,size,true);dv.setUint32(0x70,base+4,true);dv.setUint32(offset,base+0x100,true);
const put=(address,word)=>dv.setUint32(offset+address-base,word>>>0,true),table=0x020e8150;
put(0x02037f50,table);
const bindings=[[0x02012134,0x40,0x02037c70,0xebff692f,8],[0x02012148,0x80,0x02037c8c,0xebff692d,9],[0x0201210c,0x20,0x02037ca8,0xebff6917,10],[0x02012120,0x10,0x02037cc4,0xebff6915,11]];
for(const [reader,mask,call,bl,code] of bindings){[0xe1d000b0,0xe3100000|mask,0x13a00001,0x03a00000,0xe12fff1e].forEach((word,i)=>put(reader+i*4,word));[bl,0xe3500000,0x13a00000|code,0x15c40244].forEach((word,i)=>put(call+i*4,word));}
[12868,0,19302,6434].forEach((word,i)=>put(table+i*4,word));
eq(sourceF06KeyboardAngles(sourceROM),{Down:0,Right:6434,Up:12868,Left:19302});
for(const address of [0x02037f50,...bindings.flatMap(([r,,c])=>[r,r+4,r+8,r+12,r+16,c,c+4,c+8,c+12]),table,table+4,table+8,table+12]){const changed=sourceROM.slice(),v=new DataView(changed.buffer),at=offset+address-base;v.setUint32(at,v.getUint32(at,true)^1,true);reject(()=>sourceF06KeyboardAngles(changed));}
for(const direction of ['Up','Left'])for(const replacement of [undefined,0,1234]){const p=structuredClone(plan);p.keyboardAngles[direction]=replacement;eq(advanceF06HeroMotion(p,fake,clock,input(direction)).resolved,false);}
let optional=null;if(process.argv[2]){const b=fs.readFileSync(process.argv[2]),rom=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);eq(sourceF06KeyboardAngles(rom),{Down:0,Right:6434,Up:12868,Left:19302});optional={romDirectionBinding:true};}
console.log(JSON.stringify({passed:true,checks,optional},null,2));
