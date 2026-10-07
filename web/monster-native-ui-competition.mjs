import {retainConditionalUiCompetition} from './conditional-ui-competition.mjs';
import {sameSourcePixelComparison} from './native-pixel-comparison-binding.mjs?v=native-scene-link-20261007-0354';
// Do not transplant a scaled-fit winner into a different native objective.
// All originally admitted source-UI explanations remain; a missing branch
// binding is unresolved competition, never a UI win or a rejected native model.
export function compareNativeUiCompetition({modelId,sourceBranches,legacyPrediction,appearanceFrame,originalResidualId}){
 const original=legacyPrediction?.conditionalMonsterPrediction??legacyPrediction,alternatives=legacyPrediction?.conditionalNonEnemyAlternatives??[];
 if(!modelId||!alternatives.length)return null;
 const checked=retainConditionalUiCompetition(original,alternatives,{sourcePixelSHA256:appearanceFrame.fullRGBA_SHA256,originalResidualId,romSHA256:appearanceFrame.romSHA256}),rejected=new Set((checked?.nonEnemyCompetitionDecision?.rejectedComparisons??[]).map(r=>r.index)),admitted=alternatives.map((value,index)=>({value,index})).filter(r=>!rejected.has(r.index));
 if(!admitted.length)return null;
 const branches=sourceBranches.map(branch=>{
  const fit=branch.candidates.find(c=>c.modelId===modelId)?.best?.fit,s=fit?.originalProposalSupport;
  return{branchId:branch.branchId,alternatives:admitted.map(({value:c,index})=>{
   const ui=c.best,own=ui?.originalProposalSupport,comparable=s?.ready===true&&s.knownPixels===s.componentPixels&&s.originalResidualId===originalResidualId&&s.sourcePixelSHA256===appearanceFrame.fullRGBA_SHA256&&sameSourcePixelComparison(fit.comparisonBinding,c.comparison?.pixelBinding)&&s.componentPixels===own?.componentPixels&&s.knownPixels===own?.knownPixels&&s.backgroundSSE===own?.backgroundSSE&&/^[a-f0-9]{64}$/.test(s.originalComponentMaskSHA256??'')&&s.originalComponentMaskSHA256===own.originalComponentMaskSHA256;
   if(!comparable)return{index,status:'unresolved-background-or-component-binding',nativeModelRetained:true,uiAlternativeRetained:true,uiVictoryClaimed:false};
   const nativeBetter=fit.pixelErrorReduction>ui.pixelErrorReduction&&s.pixelErrorReduction>own.pixelErrorReduction,uiBetter=ui.pixelErrorReduction>fit.pixelErrorReduction&&own.pixelErrorReduction>s.pixelErrorReduction;
   return{index,status:nativeBetter?'native-strictly-better-in-both-objectives':uiBetter?'ui-strictly-better-in-both-objectives':'unresolved-tied-or-crossed-objectives',nativeFullGain:fit.pixelErrorReduction,nativeOriginalGain:s.pixelErrorReduction,uiFullGain:ui.pixelErrorReduction,uiOriginalGain:own.pixelErrorReduction,nativeModelRetained:true,uiAlternativeRetained:true,uiVictoryClaimed:uiBetter};
  })};
 });
 const resolved=branches.length>0&&branches.every(b=>b.alternatives.every(c=>c.status==='native-strictly-better-in-both-objectives'));
 return{kind:'conditional-source-native-ui-competition-v1',bindingDeferred:!resolved,originalResidualId,sourcePixelSHA256:appearanceFrame.fullRGBA_SHA256,romSHA256:appearanceFrame.romSHA256,admittedAlternativeIndices:admitted.map(r=>r.index),branches,nativeModelRetained:true,nativeSpecificUiComparisonComplete:branches.every(b=>b.alternatives.every(c=>c.status!=='unresolved-background-or-component-binding')),allComparisonsPreferNative:resolved,monsterExcluded:false,uiCertified:false,absenceCertified:false,minimumProvenATCalls:0};
}
