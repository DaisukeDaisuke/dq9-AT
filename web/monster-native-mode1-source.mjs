import{applyBoundBeamHypothesis}from'./map-browser-preview/conditional-beam-background.mjs?v=shrine-beam-20261008-a9738d0c';
import{loadAutomaticScene}from'./map-browser-preview/automatic-scene.mjs';
import{automaticBillboardScenes}from'./map-browser-preview/automatic-billboard-scene.mjs';
import{applyAutomaticMaterialEnvironment,readMode1OrdinaryHypotheses,applyMode1OrdinaryHypothesis}from'./map-browser-preview/automatic-material-environment.mjs?v=native-body-20261006-0212';
import{readRomMapScreenEffectPlan}from'./map-browser-preview/rom-map-screen-effect-plan.mjs';
import{validateMode1MseSceneHypothesis}from'./map-browser-preview/mode1-mse-scene-hypothesis.mjs?v=native-scene-link-20261007-0354';
import{readFrozenMonsterMode1Fog}from'./monster-source-mode1-fog.mjs?v=native-body-20261006-0212';
const need=(v,m)=>{if(!v)throw Error(m);},plain=v=>ArrayBuffer.isView(v)?Array.from(v):Array.isArray(v)?v.map(plain):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,plain(v[k])])):v,same=(a,b)=>JSON.stringify(plain(a))===JSON.stringify(plain(b));
export function prepareBoundMode1NativeScene({project,rom,record,branch,frame}){
 const supplied=branch.sourceEnvironment;need(supplied?.mode2Inputs==null&&supplied?.fogApplied===true,'Explicit mode1 source environment required');
 const fog=readFrozenMonsterMode1Fog({project,record,inputs:{profile:'conditional-ROM-initial-ordinary-mode1',fogWriterEnabled:true,sourceEnvironment:supplied},frame,backgroundFrame:frame}),automatic=automaticBillboardScenes(project,loadAutomaticScene(project,record),branch.viewFx),plan=readRomMapScreenEffectPlan(project,automatic.plan);validateMode1MseSceneHypothesis(supplied.mode1Scene,plan);
 let active;if(supplied.mode1){const domain=readMode1OrdinaryHypotheses(project,record,automatic),matches=domain.hypotheses.filter(e=>same(e.discreteOrdinaryHypothesis,supplied.mode1));need(domain.ready&&matches.length===1,'Retained mode1 material hypothesis differs from source');active=applyMode1OrdinaryHypothesis(project,record,automatic,matches[0]);}else active=applyAutomaticMaterialEnvironment(project,record,automatic);
 need(active.environmentApplied&&active.environment?.mode===1,'Source mode1 material reconstruction unavailable');need(same(active.environment.fogParameters,fog.parameters),'Mode1 background and actor source fog differs');
 active=applyBoundBeamHypothesis(record,active,supplied.beamVisibilityHypothesis);
 return{active,camera:{viewFx:branch.viewFx,projectionFx:branch.projectionFx},phase:structuredClone(supplied.mode1Scene.requestedPhase),fog};
}
