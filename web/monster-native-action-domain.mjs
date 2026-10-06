// Additional conditional ordinary-field actions. The caller must finish every
// original native job before reading these rules or decoding these clips.
import {readFieldAnimationRules,deriveFieldAnimationRequest} from './monster-field-animation-state.mjs?v=native-action-domain-20261006-1723';
import {readNSBCA} from './monster-animation.mjs?v=stored-pivot-source-20261006-0800';
export function readNativeConditionalActionRules(sdk){
 const rules=readFieldAnimationRules(sdk),requests=new Map();
 // Every prior-transition entry in the guarded source mode-2 row is retained.
 for(let transition=0;transition<rules.transitions[2].length;transition++){
  const r=deriveFieldAnimationRequest(rules,{mode:2,transition,postureByte:0,registrySlot:0});
  if(!r.requested)continue;
  if(r.selected<=0)throw Error('Conditional action depends on unresolved posture selection');
  for(const request of r.requests){
   const key=JSON.stringify([request.name,request.flags,r.selected]);
   if(!requests.has(key))requests.set(key,{clip:request.name+'.nsbca',sourceMode:2,sourceSelected:r.selected,sourceFlags:request.flags,priorTransitions:[],currentActionKnown:false,componentLookupResolved:false,assumptions:['Conditional source mode 2 and listed prior transition','Named component lookup succeeds; resource presence alone does not establish a live binding','Stored integer phase is a proposal, not the current animation phase']});
   requests.get(key).priorTransitions.push(transition);
  }
 }
 return {kind:'conditional-source-field-mode2-domain',sourceEvidence:rules.evidence,requests:[...requests.values()],currentActionKnown:false};
}
export function prepareNativeConditionalActionSource(source,domain){
 const list=[],animations=new Map(),unsupported=[],ordinaryClips=new Set(source.list.map(p=>p.clip));
 for(const condition of domain.requests){
  if(ordinaryClips.has(condition.clip))continue;
  try{
   const resource=source.asset.animations.find(a=>a.name===condition.clip);
   if(!resource)throw Error('Conditional source action clip missing; component lookup remains unknown');
   const animation=readNSBCA(resource.bytes);animations.set(condition.clip,animation);
   for(let frame=0;frame<animation.numFrames;frame++)list.push({clip:condition.clip,frame,actionCondition:condition});
  }catch(error){unsupported.push({scope:'conditional-source-action',clip:condition.clip,actionCondition:condition,reason:error.message});}
 }
 return {...source,list,animations,unsupported,actionDomain:domain};
}
