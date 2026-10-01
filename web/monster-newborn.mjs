// Source-derived conditional numeric/base-family + state0 projection.
// Visual binding and ordinary invocation are explicit caller preconditions.
const u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const u16=n=>Number.isInteger(n)&&n>=0&&n<=65535;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
export function stepNewbornState0(kernel,before,context){
 const no=reason=>({resolved:false,reason,fullMonsterStepResolved:false,worldStepResolved:false});
 if(context?.tickReached!==true||context.globalWord!==0||!u16(context.managerMapId)||context.managerMapId!==before?.mapId||(context.managerMapId>=41101&&context.managerMapId<=41505))return no('ordinary current-map raw-position tick required');
 if(before.state!==0||before.previousState!==1||before.activeElapsed!==0||![before.stateTimer,before.updateCounter,before.currentSeed].every(u32))return no('initial state0 timer/AT scope required');
 if(before.header!==35||before.actorFlags!==4||![0,128].includes(before.e0)||before.angle!==before.targetAngle||before.speed!==0||before.gravity!==0||before.verticalVelocity!==0||before.verticalLimit!==0||before.verticalCounter!==0||before.c1!==0||before.c2!==0||before.delayWord!==0||before.correctionSpeed!==0||before.cooldownByte!==0||before.animationEventIndex!==65535)return no('newborn stationary motion/correction guard unresolved');
 const components=context.animationComponents;
 if(context.visualBindingValidated!==true||components?.complete!==true||!dense(components.records)||!components.records.length||components.records.some(c=>!c||c.typeWord!==1))return no('source-bound visual projection precondition required');
 const family=before.movementModeFamily??[before.movementByte];
 if(!dense(family))return no('dense movement-mode family required');
 if((before.movementByte!==undefined&&!family.includes(before.movementByte))||!dense(family)||!family.length||new Set(family).size!==family.length||family.some(mode=>mode!==0&&mode!==5))return no('only closed0/5 mode family supported');
 const variants=[];for(const mode of family){const result=kernel.kinematicPrefix({...before,movementByte:mode},context.clock,{reached:true});if(!result.resolved)return no(result.reason);variants.push(result.kinematic);}
 const values=s=>JSON.stringify([s.xyz,s.angle,s.speed,s.gravity,s.verticalVelocity,s.verticalCounter]);if(variants.some(s=>values(s)!==values(variants[0])))return no('mode family motion not equivalent');
 const next={...variants[0],stateTimer:(before.stateTimer+context.clock.scaledDelta)>>>0,updateCounter:(before.updateCounter+1)>>>0};
 for(const field of ['movementByte','previousMovementByte','animationFlags','animationStatus','animationTransition','animationFrame','animationResource','animationClassPointer'])delete next[field];
 next.movementModeFamily=[0,5];const transition=next.stateTimer>1000;
 if(transition)Object.assign(next,{state:1,previousState:0,stateTimer:0,movementByte:0,previousMovementByte:0,movementModeFamily:[0],turnRate:808,speed:0,targetSpeed:0,field17a:0,actorFlags:(before.actorFlags&~128)>>>0});
 return {resolved:true,nextState:next,atConsumed:0,nextATSeed:before.currentSeed,transition,scope:'conditional ordinary state0 motion/handler projection',motionFSMProjectionResolved:true,exactVisualModeTiming:false,fullMonsterStepResolved:false,worldStepResolved:false};
}
