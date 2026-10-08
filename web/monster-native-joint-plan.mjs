// Binds source post-scaling blend results to exactly one compiled body program.
// Generated inside the consumer: no serialized/raw native-matrix override API.
import {planNativeJointBlend} from './monster-native-joint-blend.mjs?v=source-rate1-curves-20261008-2e3ba48d';
const plans=new WeakMap(),need=(x,m)=>{if(!x)throw Error(m);};
const EMIT_SPANS=[[34321532, 124, 1970301811], [34323760, 300, 1079331160]];
const hash=bytes=>{let h=0x811c9dc5;for(const b of bytes)h=Math.imul(h^b,0x1000193)>>>0;return h;};
export function verifyNativeBodyJointEmitSource(sdk){need(sdk?.read,'Original SDK emitter source required');return{kind:'source-body-joint-emit-v1',spans:EMIT_SPANS.map(([address,length,checksum])=>{const b=sdk.read(address,length);need(b.length===length&&hash(b)===checksum,'Native body joint emitter source mismatch');return{address,length,checksum};})};}
const key=p=>JSON.stringify({modelId:p.modelId,variant:p.variant,model:p.model,nodes:p.nodes,sbc:p.sbc});
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
export function createNativeBodyJointPlan(program,{sdk,source,terms,defaultCallbackBinding}){
 need(program?.kind==='source-original-body-program','Compiled source body program required');
 const emitSource=verifyNativeBodyJointEmitSource(sdk);
 const plan=planNativeJointBlend(source,{nodeInfo:program.nodes,sbc:program.sbc,terms,defaultCallbackBinding}),result=freeze(structuredClone({results:plan.results.map(r=>({offset:r.offset,nodeIndex:r.nodeIndex,parentIndex:r.parentIndex,rule:r.rule,pose:r.pose})),terms:plan.terms,emitSource,scope:plan.scope,liveStateKnown:false})),binding=Object.freeze({kind:'source-bound-post-scaling-body-joints-v1',nodeCount:result.results.length});
 plans.set(binding,{program,programKey:key(program),result});return binding;
}
export function openNativeBodyJointPlan(binding,program){
 const entry=plans.get(binding);need(binding?.kind==='source-bound-post-scaling-body-joints-v1'&&entry&&entry.program===program,'Joint plan belongs to a different or unbound body program');
 need(entry.programKey===key(program),'Body model/SBC changed after joint plan preparation');return entry.result;
}
