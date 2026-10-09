import assert from'node:assert/strict';import fs from'node:fs';
import{validateF06KeyboardInput,F06_KEYBOARD_GATES,advanceF06HeroMotion}from'../web/f06-hero-motion.mjs';
import{sourceF06KeyboardAngles}from'../web/f06-creator.mjs';
import{MonsterMovementKernel}from'../web/monster-movement.mjs?v=ordinary-turn-20261009-e76d366f';
import{preferredNodeTrigFromRom}from'../web/field-preferred-node.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=f=>{assert.throws(f);checks++},gates=Object.fromEntries(F06_KEYBOARD_GATES.map(k=>[k,true])),input=heldDirection=>({heldDirection,gates:structuredClone(gates)});
for(const key of ['Down','Right','Up','Left','UpLeft','UpRight','DownLeft','DownRight','None'])eq(validateF06KeyboardInput(input(key)).heldDirection,key);
for(const key of ['UpDown','LeftRight','UpRightLeft','Up+Right','A','','down',null,undefined,[]])reject(()=>validateF06KeyboardInput(input(key)));
for(const k of F06_KEYBOARD_GATES)for(const val of [false,null,undefined,0,1]){const i=input('Right');i.gates[k]=val;reject(()=>validateF06KeyboardInput(i));}
for(const mutate of [i=>i.futureXYZ=[0,0,0],i=>i.seed=1,i=>i.targetAngle=6434,i=>i.gates.futureFlag=true,i=>delete i.gates.noTouchOverride]){const i=input('Down');mutate(i);reject(()=>validateF06KeyboardInput(i));}
const state={xyz:[0,100,0],angle:6434,targetAngle:6434,speed:0,movementByte:1,header:0xbc3,turnRate:804,targetSpeed:393,acceleration:40,e0:32,c1:0,c2:64,delayWord:0,gravity:0,verticalVelocity:0,verticalLimit:0,verticalCounter:0},plan={state,lock:-1,hero:{width:4096,height:6144,groundFlags:0},graph:{nodes:[{id:0,position:[0,0,0]}]},terrain:{},keyboardAngles:{Down:0,Right:6434,Up:12868,Left:19302}},clock={phase:2,scaledDelta:33},fake={kinematicPrefix:s=>({resolved:true,kinematic:structuredClone(s)}),walkingGround:xyz=>({resolved:true,horizontalExclusionDerived:true,nextXYZ:[...xyz],objects:[{accepted:true,selectedId:1}],bestY:100,height:100})};
const original=JSON.stringify(plan);let r=advanceF06HeroMotion(plan,fake,clock,input('None'));eq([r.state.movementByte,r.state.targetAngle],[0,6434]);r=advanceF06HeroMotion({...plan,state:{...state,movementByte:0}},fake,clock,input('Down'));eq([r.state.movementByte,r.state.targetAngle],[1,0]);r=advanceF06HeroMotion(plan,fake,clock,input('Right'));eq([r.state.movementByte,r.state.targetAngle],[1,6434]);r=advanceF06HeroMotion({...plan,lock:1},fake,clock,input('Right'));eq([r.state.movementByte,r.state.targetAngle,r.lock],[0,6434,-32]);for(const [key,angle] of [['Up',12868],['Left',19302]]){r=advanceF06HeroMotion(plan,fake,clock,input(key));eq([r.state.movementByte,r.state.targetAngle],[1,angle]);}
const diagonalAngles={UpLeft:16085,UpRight:9651,DownLeft:22519,DownRight:3217},allAngles={...plan.keyboardAngles,...diagonalAngles},diagonalPlan={...plan,keyboardAngles:allAngles};
for(const [key,angle]of Object.entries(diagonalAngles))for(const lock of [-1,0,1]){r=advanceF06HeroMotion({...diagonalPlan,lock},fake,clock,input(key));eq([r.resolved,r.state.movementByte,r.state.targetAngle,r.lock],[true,lock>0?0:1,lock>0?state.targetAngle:angle,lock>0?-32:lock]);}
// New directions do not upgrade conditional results or bypass outer motion gates.
for(const key of Object.keys(diagonalAngles)){
 const before=JSON.stringify(diagonalPlan),ok=advanceF06HeroMotion(diagonalPlan,fake,clock,input(key));eq([ok.conditional,ok.worldResolved],[true,false]);
 for(const kernel of [
  {...fake,kinematicPrefix:()=>({resolved:false,reason:'Unsupported motion'})},
  {...fake,kinematicPrefix:s=>({resolved:true,kinematic:{...structuredClone(s),xyz:[1000,100,0]}})},
  {...fake,kinematicPrefix:s=>({resolved:true,kinematic:{...structuredClone(s),xyz:[1,100,0]}})},
  {...fake,walkingGround:()=>({resolved:false,reason:'Unsupported collision'})},
  {...fake,walkingGround:xyz=>({...fake.walkingGround(xyz),horizontalExclusionDerived:false})},
  {...fake,walkingGround:xyz=>({...fake.walkingGround(xyz),nextXYZ:[xyz[0],xyz[1]+1,xyz[2]]})},
 ])eq(advanceF06HeroMotion(diagonalPlan,kernel,clock,input(key)).resolved,false);
 eq(JSON.stringify(diagonalPlan),before);
}
eq(JSON.stringify(plan),original);
eq(advanceF06HeroMotion({...plan,keyboardAngles:null},fake,clock,input('Right')).resolved,false);eq(advanceF06HeroMotion(plan,fake,clock,input('UpLeft')).resolved,false);
// Legacy callers remain held-Down by default and do not require new angles/gates.
r=advanceF06HeroMotion({...plan,keyboardAngles:null},fake,clock);eq([r.state.movementByte,r.state.targetAngle],[1,0]);
// Synthetic uncompressed ARM9 fixture exercises every newly enforced source gate.
const sourceROM=new Uint8Array(0xe8400),dv=new DataView(sourceROM.buffer),base=0x02000000,offset=0x200,size=sourceROM.length-offset;
sourceROM.set([89,68,81,74],12);dv.setUint32(0x20,offset,true);dv.setUint32(0x28,base,true);dv.setUint32(0x2c,size,true);dv.setUint32(0x70,base+4,true);dv.setUint32(offset,base+0x100,true);
const put=(address,word)=>dv.setUint32(offset+address-base,word>>>0,true),table=0x020e8150;
const guarded=[];const bind=(address,word)=>{put(address,word);guarded.push(address);};
put(0x02037f50,table);
const bindings=[[0x02012134,0x40,0x02037c70,0xebff692f,8],[0x02012148,0x80,0x02037c8c,0xebff692d,9],[0x0201210c,0x20,0x02037ca8,0xebff6917,10],[0x02012120,0x10,0x02037cc4,0xebff6915,11]];
for(const [reader,mask,call,bl,code] of bindings){[0xe1d000b0,0xe3100000|mask,0x13a00001,0x03a00000,0xe12fff1e].forEach((word,i)=>put(reader+i*4,word));[bl,0xe3500000,0x13a00000|code,0x15c40244].forEach((word,i)=>put(call+i*4,word));}
[12868,0,19302,6434].forEach((word,i)=>put(table+i*4,word));
bind(0x02037f48,0x02114ad0);bind(0x02037bbc,0xe3a08000);
const pairs=[[0x02037bb8,0x02037bc0,0xebff695b,0x02037bd0,0xebff694d,12,0x1a00003b],[0x02037be8,0x02037bec,0xebff6950,0x02037bfc,0xebff6947,13,0x1a000030],[0x02037c14,0x02037c18,0xebff694a,0x02037c28,0xebff6937,14,0x1a000025],[0x02037c40,0x02037c44,0xebff693f,0x02037c54,0xebff6931,15,0x1a00001a]];
for(const [literal,call,bl,second,secondBL,code,jump]of pairs){bind(literal,0xe59f0000|(0x02037f48-literal-8));[bl,0xe3500000,0x0a000006].forEach((word,i)=>bind(call+i*4,word));bind(second-4,0xe59f0000|(0x02037f48-second-4));[secondBL,0xe3500000,0x13a00000|code,0x15c40244,0x13a08001,jump].forEach((word,i)=>bind(second+i*4,word));}
[0xe5d42244,0xe59f113c,0xe1a00006,0xe2422008,0xe7916102,0xebffd94f,0xe0860000,0xebffe30f].forEach((word,i)=>bind(0x02037e08+i*4,word));bind(0x02037ee0,0xe1a00004);bind(0x02037ee4,0xe1a01006);bind(0x02037ee8,0xebffed1f);
for(const [address,word]of [[0x02037ba0,0xebff60dc],[0x0200ff18,0xe59003b0],[0x0200ff1c,0xe12fff1e],[0x0202e360,0xe5900070],[0x0202e364,0xe12fff1e]])bind(address,word);
[0xe92d4010,0xe1a04000,0xe5d400be,0xe3500004,0x13500003,0x1a000002].forEach((word,i)=>bind(0x0203336c+i*4,word));[0xe1a00001,0xebfff5b3,0xe1c40abe].forEach((word,i)=>bind(0x02033390+i*4,word));
[16085,9651,22519,3217].forEach((word,i)=>bind(table+16+i*4,word));
eq(sourceF06KeyboardAngles(sourceROM),allAngles);
for(const address of [0x02037f50,...bindings.flatMap(([r,,c])=>[r,r+4,r+8,r+12,r+16,c,c+4,c+8,c+12]),table,table+4,table+8,table+12,...guarded]){const changed=sourceROM.slice(),v=new DataView(changed.buffer),at=offset+address-base;v.setUint32(at,v.getUint32(at,true)^1,true);reject(()=>sourceF06KeyboardAngles(changed));}
for(const direction of ['Up','Left'])for(const replacement of [undefined,0,1234]){const p=structuredClone(plan);p.keyboardAngles[direction]=replacement;eq(advanceF06HeroMotion(p,fake,clock,input(direction)).resolved,false);}
for(const key of Object.keys(diagonalAngles))for(const replacement of [undefined,0,1234]){const p=structuredClone(diagonalPlan);p.keyboardAngles[key]=replacement;eq(advanceF06HeroMotion(p,fake,clock,input(key)).resolved,false);}
let optional=null;if(process.argv[2]){const b=fs.readFileSync(process.argv[2]),rom=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);eq(sourceF06KeyboardAngles(rom),allAngles);optional={romDirectionBinding:true};}
// Exercise the built C/WASM arithmetic, with an explicitly synthetic flat-ground
// fixture. Portable runs use a zero trig table; optional ROM runs use ROM trig.
// Neither fixture establishes native terrain reachability (separate capture).
const wasm=(await WebAssembly.instantiate(fs.readFileSync(new URL('../web/wasm/monster_movement.wasm',import.meta.url)),{})).instance;
let trig={divisor:25736,values:new Int16Array(8192)};
if(process.argv[2]){const b=fs.readFileSync(process.argv[2]);trig=preferredNodeTrigFromRom(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const numeric=new MonsterMovementKernel(wasm,trig),flat={kinematicPrefix:(...a)=>numeric.kinematicPrefix(...a),walkingGround:fake.walkingGround};
const step=(p,key,c=clock)=>{const before=JSON.stringify(p),out=advanceF06HeroMotion(p,flat,c,input(key));eq(out.resolved,true);eq(JSON.stringify(p),before);return {...p,state:out.state,lock:out.lock,node:out.node};};
for(const [direction,angle]of Object.entries(diagonalAngles)){
 let p={...diagonalPlan,state:{...state,angle,targetAngle:angle,speed:0,movementByte:0}};const startXYZ=[...p.state.xyz];
 p=step(p,direction);eq([p.state.speed,p.state.movementByte,p.state.targetAngle],[0,1,angle]);
 for(let i=0;i<8;i++)p=step(p,direction);eq([p.state.angle,p.state.speed],[angle,393]);
 if(process.argv[2]){eq(Math.sign(p.state.xyz[0]-startXYZ[0]),direction.endsWith('Left')?-1:1);eq(Math.sign(p.state.xyz[2]-startXYZ[2]),direction.startsWith('Up')?-1:1);}
 p=step(p,'None');eq([p.state.speed,p.state.movementByte,p.state.targetAngle],[393,0,angle]);
 for(const expected of [313,233,153,73,-7,0]){const xyz=[...p.state.xyz],oldSpeed=p.state.speed;p=step(p,'None');eq(p.state.speed,expected);eq(p.state.targetAngle,angle);if(oldSpeed<0)eq(p.state.xyz,xyz);}
 p=step(p,direction);eq([p.state.speed,p.state.movementByte],[0,1]);p=step(p,direction);eq(p.state.speed,80);
 const opposite={UpLeft:'DownRight',UpRight:'DownLeft',DownLeft:'UpRight',DownRight:'UpLeft'}[direction];
 p=step(p,opposite);eq([p.state.angle,p.state.targetAngle],[angle,diagonalAngles[opposite]]);
 const oldAngle=p.state.angle;p=step(p,opposite);const change=Math.abs(p.state.angle-oldAngle);eq(Math.min(change,25736-change),1608);
 p=step(p,'Down');eq(p.state.targetAngle,0);p=step(p,direction);eq(p.state.targetAngle,angle);
}
// Source shortest-turn and inclusive one-circle boundary. No interpolation.
for(const [angle,target,turn,expected]of [[25730,3217,20,14],[6,22519,20,25722],[25736,0,804,25736],[0,25736,804,0]]){
 const s={...state,angle,targetAngle:target,turnRate:turn,speed:0,movementByte:0};const out=numeric.kinematicPrefix(s,{phase:1,scaledDelta:33},{reached:true});eq(out.resolved,true);eq(out.kinematic.angle,expected);
}
for(const phase of [0,1,2,3])for(const scaledDelta of [0,50]){
 const p=step({...diagonalPlan,state:{...state,angle:0,targetAngle:12868,speed:0,movementByte:0}},'UpRight',{phase,scaledDelta});eq([p.state.angle,p.state.targetAngle],[804*phase,9651]);
}
// Manhattan post-motion selection keeps the first node on equal distance.
for(const [x,expected]of [[-4096,0],[0,0],[4096,1]]){const p=step({...diagonalPlan,state:{...state,xyz:[x,100,0],speed:0,movementByte:0},graph:{nodes:[{id:21,position:[-1,0,0]},{id:22,position:[1,0,0]}]}},'None');eq(p.node,expected);}
console.log(JSON.stringify({passed:true,checks,optional,numericSequences:{directions:4,releaseResidue:-7,wasm:true,terrain:'synthetic flat fixture',trig:process.argv[2]?'ROM':'synthetic zero table'}},null,2));
