// User-requested comparison policy for the sealed shrine only. This is not a
// reconstruction of quest flags: both complete-effect states are hypotheses.
import {compareMapBackground} from './map-video-residual.mjs?v=shrine-beam-20261008-a9738d0c';
export const retainedBackgroundInputs=Symbol('retained-background-source-inputs');
export function beamComparisonScene(record,active,disabled=['R','B']){
 if(!/^ふういんのほこら(?:[\s　]|$)/u.test(record?.name??''))return null;
 const removed=[];
 const scenes=active.scenes.map(scene=>({...scene,instances:scene.instances.filter(instance=>{
  const placement=scene.sourcePlacements.find(p=>p.id===instance.id),model=scene.sourceModels.find(m=>m.id===placement?.modelId);
  // Source resource identity, not a screen mask or assumed native flag meaning.
  // Scope is deliberately the two supplied shrine ray-effect resources.
  const resource=/^D04M02[RB]1\.nsbmd$/i.test(instance.modelName);
  const rays=[...new Set(instance.draws.map(d=>d.textureBinding?.material?.name).filter(n=>/ray\d/i.test(n??'')))];
  if(!resource||rays.length<2||!disabled.includes(instance.modelName.match(/([RB])1\.nsbmd$/i)[1].toUpperCase()))return true;
  removed.push({archive:scene.archiveName,stream:scene.streamName,instanceId:instance.id,model:instance.modelName,modelFlags:model?.nativeFlags,placementFlags:placement?.nativeFlags,rayMaterials:rays,modelCallOffset:model?.callOffset,placementCallOffset:placement?.callOffset});return false;
 })}));
 return removed.length?{active:{...active,scenes},removed}:null;
}
export function compareBeamAlternatives(images,video,alignment,states){
 const comparisons=images.map(image=>compareMapBackground(image,video,{applyTranslation:true,fixedAlignment:alignment}));
 let count=0;const error=images.map(()=>0);for(let i=0;i<256*192;i++)if(comparisons.every(c=>c.validMask[i])){count++;for(let k=0;k<images.length;k++)for(let c=0;c<3;c++)error[k]+=Math.abs(comparisons[k].alignedBackground[i*4+c]-video.rgba[i*4+c]);}
 const best=Math.min(...error),winners=count?error.flatMap((e,i)=>e===best?[i]:[]):[];
 return {comparisons,selected:winners[0]??null,winners,evidence:{kind:'sealed-shrine-post-angle-beam-comparison-v1',states,commonKnownPixels:count,rgbAbsoluteError:error,selectedState:winners.length?states[winners[0]]:null,tied:winners.length>1,tiedStates:winners.map(i=>states[i]),metric:'RGB absolute error on identical common-known pixels',fixedAlignment:{dx:alignment.applied.dx,dy:alignment.applied.dy},cameraAndMaterialInputsUnchanged:true,currentBeamStateCertified:false,minimumProvenATCalls:0}};
}
export async function resolveConditionalBeamBackground({record,image,comparison,video,renderer,isCurrent}){
 const inputs=image?.[retainedBackgroundInputs];if(!inputs)return null;
 const all=beamComparisonScene(record,inputs.active);if(!all)return null;
 const images=[image],states=['red-on-blue-on'];
 for(const [disabled,state] of [[['R'],'red-off-blue-on'],[['B'],'red-on-blue-off'],[['R','B'],'red-off-blue-off']]){
  const filtered=beamComparisonScene(record,inputs.active,disabled);if(!filtered)continue;
  const candidate=await renderer.render({...inputs,active:filtered.active,isCurrent});
  if(!candidate.ready)return {ready:false,evidence:{kind:'sealed-shrine-post-angle-beam-comparison-v1',reason:candidate.reason,failedState:state,removed:all.removed,currentBeamStateCertified:false}};
  images.push(candidate);states.push(state);
 }
 for(let i=0;i<images.length;i++)images[i]={...images[i],postAngleFixedAlignment:comparison.alignment,diagnostics:{...images[i].diagnostics,beamVisibilityHypothesis:{state:states[i],removed:all.removed,currentBeamStateCertified:false}}};
 const result=compareBeamAlternatives(images,video,comparison.alignment,states);
 return {...result,ready:result.selected!==null,images,evidence:{...result.evidence,removed:all.removed}};
}
export function applyBoundBeamHypothesis(record,active,hypothesis){
 if(hypothesis==null)return active;
 const states={'red-on-blue-on':[],'red-off-blue-on':['R'],'red-on-blue-off':['B'],'red-off-blue-off':['R','B']},disabled=states[hypothesis.state];
 if(!disabled||hypothesis.currentBeamStateCertified!==false)throw Error('Explicit conditional shrine beam state required');
 const all=beamComparisonScene(record,active);
 if(!all||JSON.stringify(all.removed)!==JSON.stringify(hypothesis.removed))throw Error('Shrine beam source identity differs');
 return disabled.length?beamComparisonScene(record,active,disabled).active:active;
}
