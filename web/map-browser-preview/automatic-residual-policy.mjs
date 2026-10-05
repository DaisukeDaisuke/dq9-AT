// Eligibility for ordinary automatic/bulk comparison, not a noise or absence test.
// The display's minimumPixels remains independent. Raw diagnostic APIs stay raw.
export function captureAutomaticResidualPolicy({maximumSmallWidth=3,maximumSmallHeight=3}={}){
 if(![maximumSmallWidth,maximumSmallHeight].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=256))throw Error('小片の幅・高さは0〜256の整数です');
 return Object.freeze({schema:'automatic-residual-size-policy-v1',maximumSmallWidth,maximumSmallHeight,bothDimensionsRequired:true,preserveFrameAndUnavailableBoundaries:true,minimumPixelsApplied:false});
}
export function automaticResidualPolicyKey(policy){return JSON.stringify(captureAutomaticResidualPolicy(policy));}
export function selectAutomaticResiduals(regions,policy,limit=32){
 policy=captureAutomaticResidualPolicy(policy);
 if(!Number.isSafeInteger(limit)||limit<0)throw Error('Region limit must be a nonnegative integer');
 const eligible=[],held=[];
 for(const r of regions){
  // Only positively annotated interior regions can be held. Missing boundary
  // evidence cannot establish interior status, including for one-pixel crops.
  const interior=r.boundaryRetained===false&&r.frameBoundaryPixels===0&&r.unavailableBoundaryPixels===0;
  const small=Number.isFinite(r.roi?.w)&&r.roi.w>0&&Number.isFinite(r.roi?.h)&&r.roi.h>0&&r.roi.w<=policy.maximumSmallWidth&&r.roi.h<=policy.maximumSmallHeight;
  (interior&&small?held:eligible).push(r.id);
 }
 return Object.freeze({policy,requestedRegionIds:Object.freeze(eligible.slice(0,limit)),heldRegionIds:Object.freeze(held),budgetDeferredRegionIds:Object.freeze(eligible.slice(limit)),rawRegionIds:Object.freeze(regions.map(r=>r.id)),noiseCertified:false,absenceCertified:false,birthCertified:false,minimumProvenATCalls:0});
}
export function withAutomaticResidualSelection(value,selection){
 if(!selection)return value;
 return {...value,automaticResidualSelection:selection,classificationJob:{...value.classificationJob,automaticResidualSelection:selection}};
}
