import {retainCameraATBackgroundSupport} from './camera-at-background-support.mjs?v=camera-at-20261008-f1a85661';
// Replace, never append, the classification of a retained frame. Clearing before
// taking a new snapshot prevents an old backend's sightings entering exports.
export function replaceResidualTimelineClassification(timeline,frameId,value=null,regionIds=[]){
 if(frameId===null||frameId===undefined)return false;
 return timeline.update(frameId,{nativeBodyWork:value?.nativeBodyWork??null,cameraATBackgroundSupport:retainCameraATBackgroundSupport(value?.source?.background?.backgroundBranchSupport),sightings:value?.sightings??[],associationHints:value?.associationHints??[],unclassifiedRegionIds:value?.unclassifiedRegionIds??[...regionIds],classificationComplete:value?.classificationJob?.complete===true,classificationJob:value?.classificationJob??null});
}
