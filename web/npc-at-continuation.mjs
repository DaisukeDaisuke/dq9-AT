// Ordinary NPC controller02041128, actor0203cd50, mode7/8 helper02041444.
// Clocks and invocation times are explicit upstream contracts. No ATSession,
// future memory, monster FSM, wall clock, or measured cycle constants are used.
const u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const i32=n=>Number.isInteger(n)&&n>=-0x80000000&&n<=0x7fffffff;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const xyz=a=>dense(a)&&a.length===3&&a.every(i32);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const pointer=p=>u32(p)&&p>=0x02000000&&p<0x02400000&&p%4===0;
const signed=n=>Number(BigInt.asIntN(32,BigInt(n)));
const add=(a,b)=>(a+b)|0;
const fixedMul=(a,b)=>signed((BigInt(a)*BigInt(b)+2048n)>>12n);
function fixedDiv(a,b){
 if(!i32(a)||!i32(b)||b===0||(a===-0x80000000&&b===-1))throw Error('Unsupported fixed-point division');
 return signed(((BigInt(a)<<32n)/BigInt(b)+524288n)>>20n);
}
function sqrt(n){if(n<2n)return n;let x=1n<<BigInt((n.toString(2).length+1)>>1);for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
function distance(a,b){
 const v=a.map((n,i)=>(n-b[i])|0),sum=v.reduce((s,n)=>s+BigInt(n)*BigInt(n),0n);
 if(sum>=1n<<60n)throw Error('NPC distance outside supported hardware-root domain');
 return Number((sqrt(sum*4n)+1n)>>1n);
}
function wrapAngle(a,full){
 if(a<0)return add(a,fixedMul(full,(fixedDiv(-a,full)+4096)&0xfffff000));
 if(a>full)return (a-fixedMul(full,fixedDiv(a,full)&0xfffff000))|0;
 return a;
}
function atanXZ(x,z,r){
 if(x===0)return z<0?r.fullAngle/2:0;
 if(z===0)return x<0?-r.fullAngle/4:r.fullAngle/4;
 if(x===-0x80000000||z===-0x80000000)throw Error('Unsupported atan absolute value');
 const ax=Math.abs(x),az=Math.abs(z),small=Math.min(ax,az),large=Math.max(ax,az),index=fixedDiv(small,large)>>5;
 if(index<0||index>128)throw Error('Atan table index outside domain');
 let a=r.atan[index];if(ax>az)a=r.fullAngle/4-a;if(z<0)a=r.fullAngle/2-a;if(x<0)a=-a;
 return (a<<16)>>16;
}
function resourceValid(r){
 return exact(r,['fullAngle','positiveHalf','negativeHalf','angleLimits','vectors','trig','atan'])&&r.fullAngle===25736&&r.positiveHalf===12868&&r.negativeHalf===-12868&&dense(r.angleLimits)&&r.angleLimits.length===3&&r.angleLimits.every(i32)&&dense(r.vectors)&&r.vectors.length===4&&r.vectors.every(xyz)&&dense(r.trig)&&r.trig.length===8192&&r.trig.every(n=>Number.isInteger(n)&&n>=-32768&&n<=32767)&&dense(r.atan)&&r.atan.length===129&&r.atan.every(n=>Number.isInteger(n)&&n>=0&&n<=3217);
}
const actorKeys=['pointer','xyz','flags','angle','targetAngle','turnRate','previousXYZ','targetXYZ','elapsed','stepSpeed'];
const placementKeys=['pointer','mode','angle','maxX','maxZ','minX','minZ'];
const controllerKeys=['slot','pointer','flags','threshold','descriptor','attachment','fallbackActor','placement','actor'];
const validActor=a=>exact(a,actorKeys)&&pointer(a.pointer)&&[a.xyz,a.previousXYZ,a.targetXYZ].every(xyz)&&u32(a.flags)&&u32(a.elapsed)&&[a.angle,a.targetAngle,a.turnRate,a.stepSpeed].every(i32)&&a.angle>=0&&a.angle<=25736&&a.targetAngle>=-25736&&a.targetAngle<=25736&&a.turnRate>=0&&a.stepSpeed>=0;
function validController(c){
 return exact(c,controllerKeys)&&Number.isInteger(c.slot)&&c.slot>=0&&c.slot<32&&pointer(c.pointer)&&u32(c.flags)&&u32(c.threshold)&&pointer(c.descriptor)&&c.attachment===0&&c.fallbackActor===0&&exact(c.placement,placementKeys)&&(c.placement.pointer===0||pointer(c.placement.pointer))&&Number.isInteger(c.placement.mode)&&c.placement.mode>=0&&c.placement.mode<=255&&Number.isInteger(c.placement.angle)&&c.placement.angle>=-32768&&c.placement.angle<=32767&&[c.placement.maxX,c.placement.maxZ,c.placement.minX,c.placement.minZ].every(i32)&&exact(c.actor,actorKeys)&&pointer(c.actor.pointer)&&[c.actor.xyz,c.actor.previousXYZ,c.actor.targetXYZ].every(xyz)&&u32(c.actor.flags)&&u32(c.actor.elapsed)&&[c.actor.angle,c.actor.targetAngle,c.actor.turnRate,c.actor.stepSpeed].every(i32)&&c.actor.angle>=0&&c.actor.angle<=25736&&c.actor.targetAngle>=-25736&&c.actor.targetAngle<=25736&&c.actor.turnRate>=0&&c.actor.stepSpeed>=0;
}
function aliasFree(controllers){
 const ranges=[];
 for(const c of controllers)for(const [pointer,size] of [[c.pointer,0x20],[c.descriptor,0x20],[c.placement.pointer,0x78],[c.actor.pointer,0x98]]){
  if(!pointer)continue;if(pointer+size>0x02400000)return false;
  if(ranges.some(([a,n])=>pointer<a+n&&a<pointer+size))return false;
  ranges.push([pointer,size]);
 }
 return true;
}
export function npcDirectionCandidates(position,placement,resources){
 if(!xyz(position)||!exact(placement,placementKeys)||![7,8].includes(placement.mode)||!resourceValid(resources))return {resolved:false,reason:'Typed original geometry and mode7/8 ROM resources required'};
 if(placement.minX>placement.maxX||placement.minZ>placement.maxZ)return {resolved:false,reason:'Unordered native bounds unsupported'};
 const vectors=resources.vectors.map(v=>v.slice());
 if(placement.mode===8){
  const index=(((Math.trunc((placement.angle<<16)/resources.fullAngle))&65535)>>>4)*2;
  const sx=Math.abs(resources.trig[index]),cz=Math.abs(resources.trig[index+1]);
  const [q,h,t]=resources.angleLimits,positive=placement.angle<q||(placement.angle>h&&placement.angle<t);
  vectors[0][0]=vectors[1][0]=sx;vectors[2][0]=vectors[3][0]=-sx;
  vectors[0][2]=vectors[1][2]=positive?cz:-cz;vectors[2][2]=vectors[3][2]=positive?-cz:cz;
 }
 // Candidate inclusion uses ORIGINAL X/Z; only the target base is clamped.
 const [x,,z]=position,conditions=[x<placement.maxX,z<placement.maxZ,x>placement.minX,z>placement.minZ],indices=[];
 for(let i=0;i<4;i++)if(conditions[i])indices.push(i);
 const base=[Math.max(placement.minX,Math.min(x,placement.maxX)),position[1],Math.max(placement.minZ,Math.min(z,placement.maxZ))];
 return {resolved:indices.length>0,reason:indices.length?'ordered native candidates':'empty native list unsupported',indices,vectors:indices.map(i=>vectors[i]),base};
}
export function advanceNpcActor(before,clock,resources){
 if(!validActor(before)||!exact(clock,['sourceFrame','delta','scaledDelta','phase'])||![clock.sourceFrame,clock.delta,clock.scaledDelta,clock.phase].every(u32)||clock.phase>65535||!resourceValid(resources))return {resolved:false,reason:'Strict actor/clock/resource contract required'};
 if((before.flags&0x30)!==0)return {resolved:false,reason:'Special actor0203cf5c branch unsupported'};
 const a=structuredClone(before),flagsBefore=a.flags;
 if(a.flags&1){
  const d=distance(a.targetXYZ,a.xyz);
  if(a.stepSpeed<d){const scale=fixedDiv(a.stepSpeed,d),v=a.targetXYZ.map((n,i)=>(n-a.xyz[i])|0);a.xyz=a.xyz.map((n,i)=>add(n,fixedMul(v[i],scale)));}
  else {a.xyz=a.targetXYZ.slice();a.flags=(a.flags&0xfffffffe)>>>0;}
 }
 let diff=(a.targetAngle-a.angle)|0;
 if(a.angle<a.targetAngle){if(diff>resources.positiveHalf)diff=(diff-resources.fullAngle)|0;}
 else if(a.targetAngle<a.angle&&diff<resources.negativeHalf)diff=add(diff,resources.fullAngle);
 const rate=Math.imul(a.turnRate,clock.phase);
 if(rate<0)return {resolved:false,reason:'Wrapped negative turn increment unsupported'};
 if(diff>0){a.angle=diff<rate?a.targetAngle:add(a.angle,rate);a.flags=(a.flags|2)>>>0;}
 else if(diff<0){a.angle=-diff<rate?a.targetAngle:(a.angle-rate)|0;a.flags=(a.flags|2)>>>0;}
 else a.flags=(a.flags&0xfffffffd)>>>0;
 a.angle=wrapAngle(a.angle,resources.fullAngle);a.previousXYZ=a.xyz.slice();
 const flagsAtWriter=a.flags;
 a.elapsed=flagsAtWriter&1?0:(a.elapsed+clock.scaledDelta)>>>0;
 return {resolved:true,actor:a,flagsBefore,flagsAtWriter,elapsedOperation:flagsAtWriter&1?'zero':'add'};
}
function setTarget(a,target,r){
 const d=distance(target,a.xyz);if(d===0)return {changed:false};
 a.targetXYZ=target.slice();a.flags=(a.flags|1)>>>0;
 if(!(a.flags&4)){
  const scale=fixedDiv(4096,d),v=target.map((n,i)=>(n-a.xyz[i])|0),normalized=v.map(n=>fixedMul(n,scale));
  // 0203d314 MVN r2,#0x7f; 0203d320 CMP lowByte,r2; ADDCS.
  // r2 is UINT32 0xffffff80: a low byte never produces carry. Do not
  // misread the decompiler's unsigned comparison as nearest-256 rounding.
  const angle=atanXZ(normalized[0],normalized[2],r);a.targetAngle=angle&0xffffff00;
 }
 return {changed:true};
}
function nextRandom(seed){const after=(Math.imul(seed,1103515245)+12345)>>>0;return {seedBefore:seed,seedAfter:after,random:(after>>>16)&32767};}
/** A conditional controller projection. It never certifies a world lower bound. */
export function projectNpcATContinuation(origin,clockStream,resources,{expectedEpoch}={}){
 const no=reason=>({resolved:false,reason,conditionalConsumed:0,provedMinimumAT:0,bootProof:false,worldResolved:false,draws:[],invocations:[]});
 if(!exact(origin,['schema','epoch','originFrame','seed','globalMode','controllers'])||origin.schema!=='dq9-npc-origin-v1'||typeof origin.epoch!=='string'||!origin.epoch||origin.epoch!==expectedEpoch||!u32(origin.originFrame)||!u32(origin.seed)||!Number.isInteger(origin.globalMode)||origin.globalMode< -128||origin.globalMode>127||!dense(origin.controllers)||!origin.controllers.length||origin.controllers.some(c=>!validController(c)))return no('Original origin/epoch/controller bindings incomplete');
 if(!aliasFree(origin.controllers)||new Set(origin.controllers.map(c=>c.slot)).size!==origin.controllers.length||origin.controllers.some((c,i)=>i>0&&c.slot<=origin.controllers[i-1].slot))return no('Duplicate, alias, or unordered native slot bindings');
 if(!exact(clockStream,['schema','originFrame','ticks'])||clockStream.schema!=='work5-external-clock-v1'||clockStream.originFrame!==origin.originFrame||!dense(clockStream.ticks)||!resourceValid(resources))return no('Explicit upstream clock stream and ROM resources required');
 let previous=origin.originFrame-1;
 for(const t of clockStream.ticks){if(!exact(t,['sourceFrame','delta','scaledDelta','phase'])||![t.sourceFrame,t.delta,t.scaledDelta,t.phase].every(u32)||t.sourceFrame<=previous||t.phase>65535)return no('Clock stream contains future-state fields, discontinuity, or unsupported widths');previous=t.sourceFrame;}
 const controllers=structuredClone(origin.controllers),draws=[],invocations=[],frames=[];let seed=origin.seed,currentFrame=origin.originFrame;
 const finish=(resolved,reason,boundary=null)=>({schema:'dq9-npc-continuation-v1',resolved,reason,epoch:origin.epoch,originFrame:origin.originFrame,seedBefore:origin.seed,seedAfter:seed,conditionalConsumed:draws.length,provedMinimumAT:0,bootProof:false,worldResolved:false,boundary,draws,invocations,frames,controllers,conditions:['complete ordinary slot invocations at supplied clocks','global mode unchanged','no external controller/placement/actor setters','no other AT consumer or seed setter within this epoch'],scope:'NPC0203e21c/02041128/0203cd50 projected fields; animation/presentation fields are outside this state'});
 try{
  for(const clock of clockStream.ticks){
   currentFrame=clock.sourceFrame;
   for(const c of controllers){
    if(c.flags&0x8000)continue;
    const thresholdBefore=c.threshold,m=advanceNpcActor(c.actor,clock,resources);
    if(!m.resolved)return finish(false,m.reason,{sourceFrame:clock.sourceFrame,controller:c.pointer,pc:0x0203cd50});
    c.actor=m.actor;const a=c.actor,p=c.placement;
    const invocation={sourceFrame:clock.sourceFrame,controller:c.pointer,actor:a.pointer,thresholdBefore,flagsBefore:m.flagsBefore,flagsAtWriter:m.flagsAtWriter,elapsed:a.elapsed,elapsedOperation:m.elapsedOperation,xyz:a.xyz.slice(),angle:a.angle,comparisonReached:false,branch:null,drawStart:draws.length};
    invocations.push(invocation);
    if(origin.globalMode===4||(c.flags&0x20001)||p.pointer===0||p.mode===0||(a.flags&1))invocation.branch='upstream-skip';
    else {
     invocation.comparisonReached=true;
     if(a.elapsed<=c.threshold)invocation.branch='threshold-skip';
     else {
      invocation.branch='due';
      if(![7,8].includes(p.mode))return finish(false,'Due mode9/10 or unknown mode unsupported',{sourceFrame:clock.sourceFrame,controller:c.pointer,pc:0x020411d8});
      const candidates=npcDirectionCandidates(a.xyz,p,resources);
      if(!candidates.resolved)return finish(false,candidates.reason,{sourceFrame:clock.sourceFrame,controller:c.pointer,pc:0x02041630});
      const random=nextRandom(seed),ordinal=random.random%candidates.indices.length,vector=candidates.vectors[ordinal],target=candidates.base.map((n,i)=>add(n,vector[i]));
      seed=random.seedAfter;
      const direction={sourceFrame:clock.sourceFrame,controller:c.pointer,actor:a.pointer,consumer:'direction',callPC:0x02041630,pc:0x02003c30,returnPC:0x02003c54,lr:0x02041634,...random,candidateIndices:candidates.indices,candidateVectors:candidates.vectors,candidateCount:candidates.indices.length,ordinal,selectedIndex:candidates.indices[ordinal],targetXYZ:target,xyz:a.xyz.slice(),stepSpeed:a.stepSpeed,elapsed:a.elapsed,threshold:c.threshold,flags:a.flags};
      draws.push(direction);setTarget(a,target,resources);
      direction.actorFlagsAfterTarget=a.flags;direction.actorTargetAfter=a.targetXYZ.slice();direction.targetAngleAfter=a.targetAngle;
      if(c.flags&8)c.threshold=0;
      else {
       const reset=nextRandom(seed);seed=reset.seedAfter;c.threshold=reset.random%2000+2000;
       draws.push({sourceFrame:clock.sourceFrame,controller:c.pointer,actor:a.pointer,consumer:'threshold-reset',callPC:0x02041220,pc:0x02003c30,returnPC:0x02003c54,lr:0x02041224,...reset,threshold:c.threshold,elapsed:a.elapsed,flags:a.flags});
      }
     }
    }
    c.flags=(c.flags&0xfffdffff)>>>0;invocation.thresholdAfter=c.threshold;invocation.drawEnd=draws.length;
   }
   frames.push({sourceFrame:clock.sourceFrame,seed,controllers:controllers.map(c=>({controller:c.pointer,controllerFlags:c.flags,threshold:c.threshold,actor:c.actor.pointer,...structuredClone(c.actor),pointer:undefined}))});
  }
  return finish(true,'Provided ordinary NPC schedule and original state resolved');
 }catch(e){return finish(false,e.message,{sourceFrame:currentFrame,pc:null});}
}
