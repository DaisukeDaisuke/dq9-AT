// Frame-local lazy source destination reconstruction. No final-RGB inversion,
// transport parameters, camera search, state search or persistent pixel cache.
import {loadAutomaticScene} from './map-browser-preview/automatic-scene.mjs';
import {prepareMode2InverseModel,renderMode2InverseSourceAsync} from './map-browser-preview/mode2-inverse-render.mjs';
import {bindNativeBodyDestination} from './monster-native-scene-composition.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};
export function createNativeBodyDestinationProvider({project,rom,record,branch,frame,assertCurrent=()=>{}}){
 frame=structuredClone(frame);branch={recordKey:branch.recordKey,viewFx:branch.viewFx.slice(),projectionFx:branch.projectionFx.slice(),alignment:{...branch.alignment},sourceEnvironment:structuredClone(branch.sourceEnvironment),backgroundRGBA:branch.backgroundRGBA.slice(),validMask:branch.validMask.slice()};
 let pending=null;
 return async({assertCurrent:check=assertCurrent}={})=>{
  check();if(!pending)pending=(async()=>{
   need(branch.sourceEnvironment?.mode2Inputs&&branch.sourceEnvironment.fogApplied===true,'Source scene destination currently admits explicit frozen mode2 only; retained mode1/MSE alternatives remain unknown');
   need(frame.recordKey===record.key&&branch.recordKey===record.key,'Source scene destination record differs');
   const camera={viewFx:branch.viewFx,projectionFx:branch.projectionFx},automatic=loadAutomaticScene(project,record),model=prepareMode2InverseModel(project,record),image=await renderMode2InverseSourceAsync({project,rom,record,automatic,camera,model,inputs:branch.sourceEnvironment.mode2Inputs,retainBodyDestination:true,isCurrent:()=>{check();return true;}});
   check();need(image.ready&&image.bodyDestination,'Source scene destination reconstruction unavailable');
   const destination=bindNativeBodyDestination(image.bodyDestination,{frame,camera,alignment:branch.alignment,reconstructedRGBA:image.rgba,backgroundRGBA:branch.backgroundRGBA,validMask:branch.validMask});
   return destination;
  })().catch(error=>{if(error.name==='AbortError')pending=null;throw error;});const value=await pending;check();return value;
 };
}
