import assert from 'node:assert/strict';
import {matchVideoMinimapRegistration} from '../web/map-browser-preview/video-minimap-registration.mjs';
import {deriveVideoPlayerMapInput} from '../web/map-browser-preview/video-player-map-input.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=v=>{assert(v);checks++;};
const frame={width:128,height:96},excluded=[{x:0,y:0,w:128,h:10}],failure={resolved:false,best:{dx:4,dy:38,score:.39},margin:.11,candidates:[{dx:4,dy:38,score:.39}],search:{budgetExhausted:false,evaluatedTranslations:1431,planComplete:true}},success={resolved:true,best:{dx:-23,dy:-33,score:.85},margin:.28,candidates:[{dx:-23,dy:-33,score:.85}],search:{budgetExhausted:false,evaluatedTranslations:43617,planComplete:true}},timeout={...success,resolved:false,search:{budgetExhausted:true,budgetReason:'time-budget',planComplete:false}},calls=[];
function run(results){calls.length=0;let index=0;return matchVideoMinimapRegistration({match(image,options){eq(image,frame);calls.push(options);return results[index++];}},frame,{excluded});}
const recovered=run([failure,success]);eq(calls.length,2);eq(calls[0],{scales:[.5],excluded,maxMilliseconds:1500});eq(calls[1].denseTranslation,true);eq(calls[1].scales,[.5]);eq(calls[1].excluded,excluded);ok(calls[1].maxMilliseconds>=0&&calls[1].maxMilliseconds<=1500);eq(recovered.resolved,true);eq(recovered.best,success.best);eq(recovered.search,success.search);eq(recovered.fallback.initialRegistration,failure);eq(recovered.fallback.sharedMaximumMilliseconds,1500);
const accepted=run([success]);eq(calls.length,1);eq(accepted,success);
const exhausted=run([timeout]);eq(calls.length,1);eq(exhausted,timeout);
const denseTimeout=run([failure,timeout]);eq(denseTimeout.resolved,false);eq(denseTimeout.search,timeout.search);eq(denseTimeout.fallback.initialRegistration,failure);
const unresolved=run([failure,failure]);eq(unresolved.resolved,false);eq(unresolved.fallback.initialRegistration,failure);eq(unresolved.best,failure.best);
// The production same-frame route calls the helper and does not turn registration
// into marker identity or position evidence when the synthetic screen is blank.
let derivedCalls=0;const sourceImage={width:512,height:192,rgba:new Uint8Array(512*192*4)},mapImage={width:64,height:64,rgba:new Uint8Array(64*64*4),originPixel:[0,0],descriptor:{path:'synthetic.bmmp',worldToMapScale:2,groups:[]}};
const derived=deriveVideoPlayerMapInput({sourceImage,layout:'ds-horizontal',mapImage,mapId:1,matcher:{setReference(image){eq(image.descriptor,'synthetic.bmmp');},match(_frame,options){derivedCalls++;return options.denseTranslation?success:failure;}},floors:{instances:[],unsupported:[]},frameEvidence:{fullRGBA_SHA256:'synthetic'}});
eq(derivedCalls,2);eq(derived.registration.fallback.initialRegistration,failure);eq(derived.status,'marker-unobserved');eq(derived.primaryCandidate,null);eq(derived.worldPositionKnown,false);eq(derived.playerIdentityProven,false);eq(derived.minimumProvenATCalls,0);
console.log(JSON.stringify({passed:true,checks,scope:'Synthetic orchestration only: unchanged matcher thresholds, same shared 1500ms budget, preserved failed registration, no identity or AT claim'}));
