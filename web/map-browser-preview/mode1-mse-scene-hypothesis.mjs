// Preserve the exact hypothesis used by a successful CPU source background.
// Absence of this metadata is not an omitted-effect or constructor-state claim.
const clone=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function captureMode1MseSceneHypothesis(diagnostics){
 try{const e=diagnostics?.screenEffect;if(diagnostics?.backend!=='source-integer-static-mode1'||!e?.plan?.request)return null;
 return{kind:'conditional-mode1-MSE-background-hypothesis-v1',effectPlan:clone(e.plan),requestedPhase:clone(e.requestedPhase),applied:e.applied,gatesEvaluated:e.gatesEvaluated,currentPhaseProven:false,currentEnableFadeOffsetsObserved:false,unknownAlternatives:['Different enabled/paused/fade state','Different accumulated offsets, reload epoch or external mutation','Other actors/UI/effect submissions and live destination state']};}catch{return null;}
}
export function validateMode1MseSceneHypothesis(h,plan){
 if(h?.kind!=='conditional-mode1-MSE-background-hypothesis-v1'||h.currentPhaseProven!==false||h.currentEnableFadeOffsetsObserved!==false||!Array.isArray(h.unknownAlternatives))throw Error('Explicit conditional mode1 MSE hypothesis required');
 if(!plan?.ready||!plan.request?.present||!same(h.effectPlan,plan))throw Error('Mode1 MSE source request differs');
 if(!Object.hasOwn(h,'requestedPhase')||!Object.hasOwn(h,'applied'))throw Error('Mode1 MSE phase binding absent');
 const omitted=h.requestedPhase===null,constructor=h.requestedPhase?.kind==='source-constructor'&&Object.keys(h.requestedPhase).length===1;
 if(!omitted&&!constructor)throw Error('Mode1 MSE dynamic offsets/alpha/enable state outside bound omitted/constructor subset');
 if(h.applied!==!omitted||h.gatesEvaluated!==false)throw Error('Mode1 MSE render assumptions differ');
 return{omitted,constructor};
}
