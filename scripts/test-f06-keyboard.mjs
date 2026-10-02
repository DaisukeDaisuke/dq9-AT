import assert from'node:assert/strict';import fs from'node:fs';
import{validateF06KeyboardInput,F06_KEYBOARD_GATES,advanceF06HeroMotion}from'../web/f06-hero-motion.mjs';
import{sourceF06KeyboardAngles}from'../web/f06-creator.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=f=>{assert.throws(f);checks++},gates=Object.fromEntries(F06_KEYBOARD_GATES.map(k=>[k,true])),input=heldDirection=>({heldDirection,gates:structuredClone(gates)});
for(const key of ['Down','Right','None'])eq(validateF06KeyboardInput(input(key)).heldDirection,key);
for(const key of ['Up','Left','DownRight','','down',null,undefined,[]])reject(()=>validateF06KeyboardInput(input(key)));
for(const k of F06_KEYBOARD_GATES)for(const val of [false,null,undefined,0,1]){const i=input('Right');i.gates[k]=val;reject(()=>validateF06KeyboardInput(i));}
for(const mutate of [i=>i.futureXYZ=[0,0,0],i=>i.seed=1,i=>i.targetAngle=6434,i=>i.gates.futureFlag=true,i=>delete i.gates.noTouchOverride]){const i=input('Down');mutate(i);reject(()=>validateF06KeyboardInput(i));}
const state={xyz:[0,100,0],angle:6434,targetAngle:6434,speed:0,movementByte:1,header:0xbc3,turnRate:804,targetSpeed:393,acceleration:40,e0:32,c1:0,c2:64,delayWord:0,gravity:0,verticalVelocity:0,verticalLimit:0,verticalCounter:0},plan={state,lock:-1,hero:{width:4096,height:6144,groundFlags:0},graph:{nodes:[{id:0,position:[0,0,0]}]},terrain:{},keyboardAngles:{Down:0,Right:6434}},clock={phase:2,scaledDelta:33},fake={kinematicPrefix:s=>({resolved:true,kinematic:structuredClone(s)}),walkingGround:xyz=>({resolved:true,horizontalExclusionDerived:true,nextXYZ:[...xyz],objects:[{accepted:true,selectedId:1}],bestY:100,height:100})};
const original=JSON.stringify(plan);let r=advanceF06HeroMotion(plan,fake,clock,input('None'));eq([r.state.movementByte,r.state.targetAngle],[0,6434]);r=advanceF06HeroMotion({...plan,state:{...state,movementByte:0}},fake,clock,input('Down'));eq([r.state.movementByte,r.state.targetAngle],[1,0]);r=advanceF06HeroMotion(plan,fake,clock,input('Right'));eq([r.state.movementByte,r.state.targetAngle],[1,6434]);r=advanceF06HeroMotion({...plan,lock:1},fake,clock,input('Right'));eq([r.state.movementByte,r.state.targetAngle,r.lock],[0,6434,-32]);eq(JSON.stringify(plan),original);
eq(advanceF06HeroMotion({...plan,keyboardAngles:null},fake,clock,input('Right')).resolved,false);eq(advanceF06HeroMotion(plan,fake,clock,input('Up')).resolved,false);
// Legacy callers remain held-Down by default and do not require new angles/gates.
r=advanceF06HeroMotion({...plan,keyboardAngles:null},fake,clock);eq([r.state.movementByte,r.state.targetAngle],[1,0]);
let optional=null;if(process.argv[2]){const b=fs.readFileSync(process.argv[2]),rom=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);eq(sourceF06KeyboardAngles(rom),{Down:0,Right:6434});optional={romDirectionBinding:true};}
console.log(JSON.stringify({passed:true,checks,optional},null,2));
