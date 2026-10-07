import{prepareNativeBodyDestination,packNativeMapTranslucentFragments}from'../monster-native-scene-composition.mjs?v=footprint-rgb-20261006-2328';
import{readNaturalBodyMseOrder}from'../monster-native-mse-order.mjs?v=native-yaw-mse-20261006-2101';
import{readArm9Overlay}from'./rom-overlay.mjs';
import{captureMode1MseSceneHypothesis,validateMode1MseSceneHypothesis}from'./mode1-mse-scene-hypothesis.mjs?v=native-scene-link-20261007-0354';
export function prepareMode1NativeBodyDestination({project,rom,rgb,inventory,translucent,compositeInputs,participants,controls,diagnostics}){
 const hypothesis=captureMode1MseSceneHypothesis(diagnostics),selection=validateMode1MseSceneHypothesis(hypothesis,diagnostics.screenEffect.plan),order=readNaturalBodyMseOrder({sdk:project.sdk,fieldOverlay:readArm9Overlay(rom,17)}),mapIds=new Set(translucent.polygons.map(p=>p.index)),mapParticipants=participants.filter(p=>mapIds.has(p.index)),effectParticipants=participants.filter(p=>!mapIds.has(p.index));
 const effectSources=new Map(compositeInputs.polygons.filter(p=>!mapIds.has(p.index)).map(p=>[p.index,p]));
 if(selection.omitted&&(effectParticipants.length||effectSources.size))throw Error('Omitted-effect hypothesis contains effect geometry');
 if(selection.constructor&&(!effectSources.size||effectParticipants.length!==effectSources.size))throw Error('Constructor effect geometry is incomplete');
 const effect=effectParticipants.map(p=>{const s=effectSources.get(p.index),a=s?.materialEvidence?.polygonAttribute;if(!s||![1,6].includes(s.translucentInput?.texture?.format)||!Number.isInteger(a)||(a>>>4&3)!==0||(a>>>16&31)!==31||(a&0x4800))throw Error('MSE source polygon outside retained constructor alpha-texture subset');return{...p,attribute:a};});
 const postActorEffect={kind:'conditional-source-post-actor-MSE-v1',hypothesis,sourceOrder:order,fragments:packNativeMapTranslucentFragments(effect,rgb.plane),currentPhaseProven:false,currentEnableFadeOffsetsObserved:false};
 const result=prepareNativeBodyDestination({rgb,inventory,translucent,participants:mapParticipants,controls,screenEffectPlan:diagnostics.screenEffect.plan,sourceOrder:order.ordinary,postActorEffect});if(result.mapFragments.retainedBytes+postActorEffect.fragments.retainedBytes>16*1024*1024)throw Error('Combined source map/MSE fragment destination exceeds bounded16MiB subset');return result;
}
