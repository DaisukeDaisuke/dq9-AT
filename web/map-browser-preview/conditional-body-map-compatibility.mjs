import {encounterModelCandidates} from './encounter-model-candidates.mjs?v=enc-motion-at-20261006-1156';
import {mapHypothesisFrameKey} from './map-hypothesis-provenance.mjs?v=native-body-20261006-0212';
const copy=x=>structuredClone(x);
// The old silhouette fit uses the SELECTED background's pixels, not every
// passing camera/map branch. A different branch cannot supply that fit's origin.
export function selectedBodyBackground({videoEvidence,backgroundEvidence}={}){
 const v=videoEvidence,b=backgroundEvidence;
 if(!v?.fullRGBA_SHA256||!Number.isInteger(b?.mapId)||typeof b.recordKey!=='string')return null;
 const a=b.automaticSearch,rows=a?.backgroundCandidates??[],i=a?.selectedIndex??b.backgroundBranchSupport?.selectedPreviewRowIndex,r=Number.isInteger(i)?rows[i]:null;
 if(r&&(r.mapId!==b.mapId||r.recordKey!==b.recordKey))return null;
 const sourceFrame=a?.inputFrame??b.backgroundBranchSupport?.frame;
 if(sourceFrame&&mapHypothesisFrameKey(sourceFrame)!==mapHypothesisFrameKey(v))return null;
 return {kind:'selected-background-body-fit-binding',frameKey:mapHypothesisFrameKey(v),mapId:b.mapId,recordKey:b.recordKey,branchId:Number.isInteger(i)?'background-row-'+i:'selected-background',branchIdScope:'within-frozen-frame-only',romSHA256:b.romSHA256??null,mapIdentityCertified:false};
}
function branchRows(backgroundEvidence,mapProvenance){
 const rows=backgroundEvidence?.automaticSearch?.backgroundCandidates;
 if(Array.isArray(rows))return rows.map((r,i)=>({branchId:'background-row-'+i,mapId:r.mapId,recordKey:r.recordKey,accepted:r.accepted===true,state:r.state??null,unsupported:r.unsupported??null}));
 return (mapProvenance?.backgroundCandidates??[]).map(r=>({branchId:r.branchId,mapId:r.mapId,recordKey:r.recordKey,accepted:r.accepted,state:r.state,unsupported:r.unsupported}));
}
export function conditionalBodyMapCompatibility({modelId,plan,bodyBackground=null,backgroundEvidence=null,mapProvenance=null,speciesCandidates=null}={}){
 const model=plan?.models?.find(m=>m.modelId===modelId),origins=model?.origins??[],knownOrigins=origins.filter(o=>Number.isInteger(o.mapId)&&Number.isInteger(o.tableId));
 const matchingOrigins=bodyBackground?knownOrigins.filter(o=>o.mapId===bodyBackground.mapId):[],encounterCandidates=encounterModelCandidates(plan,modelId,{mapId:bodyBackground?.mapId??null,speciesCandidates}),jointlySupported=Boolean(bodyBackground&&matchingOrigins.length&&encounterCandidates.tableSpeciesAlternatives.length);
 const status=!bodyBackground?'body-background-unbound':!knownOrigins.length?'encounter-origin-unresolved':!matchingOrigins.length?'encounter-origin-mismatch':jointlySupported?'compatible-encounter-origin':'encounter-species-origin-unresolved';
 return {schema:'conditional-body-map-compatibility-v1',status,modelId:modelId??null,jointlySupported,bodyBackground:copy(bodyBackground),originMapIds:[...new Set(knownOrigins.map(o=>o.mapId))],matchingOrigins:copy(matchingOrigins),matchingSpeciesOrigins:copy(encounterCandidates.origins),tableSpeciesAlternatives:copy(encounterCandidates.tableSpeciesAlternatives),encounterSpeciesCandidates:copy(encounterCandidates.speciesCandidates),unresolvedSpeciesOrigins:copy(encounterCandidates.unresolvedOrigins),origins:copy(origins),branches:branchRows(backgroundEvidence,mapProvenance).map(r=>({...r,usedByBodyFit:Boolean(bodyBackground&&(r.branchId===bodyBackground.branchId||bodyBackground.kind==='uniform-passing-map-body-fit-binding'&&r.accepted&&r.mapId===bodyBackground.mapId)),matchesEncounterOrigin:knownOrigins.some(o=>o.mapId===r.mapId),jointSupportClaimed:jointlySupported&&r.branchId===bodyBackground.branchId})),otherSpawnRoutesUnknown:true,unsearchedMapAlternativesRetained:true,modelExcluded:false,absenceCertified:false,noEventPossible:true,mapIdentityCertified:false,minimumProvenATCalls:0,scope:'Only compatibility of the body-fit background map with this model encounter origin. A mismatch defers the joint species/table prediction, not the model or map. Failed/unsearched maps and scripted/other spawn routes remain unknown.'};
}
export function bindConditionalBodyPrediction(prediction,{plan,videoEvidence,backgroundEvidence}={}){
 const proposalDeferred=prediction?.proposalSupportDecision?.bindingDeferred===true,modelId=prediction?.modelId??prediction?.unboundModelId??(proposalDeferred?prediction.proposalSupportDecision.unattributedModelId:null);
 if(!modelId)return prediction;
 const modelSpeciesCandidates=copy(prediction.modelSpeciesCandidates??(prediction.speciesCandidates?.length?prediction.speciesCandidates:prediction.unboundSpeciesCandidates??prediction.proposalSupportDecision?.unattributedSpeciesCandidates??[]));
 const mapCompatibility=conditionalBodyMapCompatibility({modelId,plan,bodyBackground:selectedBodyBackground({videoEvidence,backgroundEvidence}),backgroundEvidence,speciesCandidates:modelSpeciesCandidates});
 // Map compatibility remains visible for an unbound proposal, but cannot
 // restore a species/table binding that lacks its own residual support.
 if(proposalDeferred)return {...prediction,modelId:null,speciesCandidates:[],modelSpeciesCandidates,tableSpeciesAlternatives:[],mapCompatibility,proposalSupportDecision:{...prediction.proposalSupportDecision,mapCompatibleSpeciesCandidates:copy(mapCompatibility.encounterSpeciesCandidates),mapCompatibleTableSpeciesAlternatives:copy(mapCompatibility.tableSpeciesAlternatives)}};
 if(mapCompatibility.jointlySupported)return {...prediction,speciesCandidates:copy(mapCompatibility.encounterSpeciesCandidates),modelSpeciesCandidates,tableSpeciesAlternatives:copy(mapCompatibility.tableSpeciesAlternatives),mapCompatibility};
 return {...prediction,modelId:null,speciesCandidates:[],modelSpeciesCandidates,tableSpeciesAlternatives:[],unboundModelId:modelId,unboundSpeciesCandidates:copy(prediction.speciesCandidates?.length?prediction.speciesCandidates:prediction.unboundSpeciesCandidates??[]),mapCompatibility,decisionBasis:prediction.decisionBasis+' Joint species prediction deferred: body-background and encounter-origin map compatibility is '+mapCompatibility.status+'. Original appearance/body agreement, all model alternatives and unknown spawn routes are retained.'};
}
export function sightingBodyMapCompatibility(bundle,sighting,plan,mapProvenance){
 const prediction=sighting.conditionalBodyPrediction,modelId=prediction?.modelId??prediction?.unboundModelId;
 if(!modelId)return conditionalBodyMapCompatibility({plan,mapProvenance});
 const stored=prediction.mapCompatibility?.bodyBackground;
 let bodyBackground=stored?.frameKey===sighting.frameKey?stored:null,backgroundEvidence=null;
 const hasCurrentBinding=mapHypothesisFrameKey(bundle.source?.video)===sighting.frameKey&&Boolean(bundle.source?.background);
 if(!bodyBackground&&hasCurrentBinding){backgroundEvidence=bundle.source.background;bodyBackground=selectedBodyBackground({videoEvidence:bundle.source.video,backgroundEvidence});}
 if(!bodyBackground&&!hasCurrentBinding&&mapProvenance?.frame?.frameKey===sighting.frameKey){const passing=mapProvenance.survivingBackgroundCandidates??[],keys=new Set(passing.map(b=>JSON.stringify([b.recordKey,b.mapId])));if(passing.length&&keys.size===1&&Number.isInteger(passing[0].mapId))bodyBackground={kind:'uniform-passing-map-body-fit-binding',frameKey:sighting.frameKey,mapId:passing[0].mapId,recordKey:passing[0].recordKey,branchId:null,branchIdScope:'within-frozen-frame-only',mapIdentityCertified:false};}
 return conditionalBodyMapCompatibility({modelId,plan,bodyBackground,backgroundEvidence,mapProvenance,speciesCandidates:prediction.speciesCandidates?.length?prediction.speciesCandidates:prediction.unboundSpeciesCandidates??[]});
}
