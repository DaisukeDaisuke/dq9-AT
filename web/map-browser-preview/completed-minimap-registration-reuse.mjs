import {MapPositionMatcher} from '../map-position.mjs?v=registration-timing-20261007-0020';
import {matchVideoMinimapRegistration} from './video-minimap-registration.mjs?v=field-registration-20261006-0913';
const sameBytes=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const complete=result=>result?.kind==='video-map-registration'&&result.search?.planComplete===true&&result.search.budgetExhausted===false&&(!result.fallback||complete(result.fallback.initialRegistration));
const originalMatch=MapPositionMatcher.prototype.match,originalSetReference=MapPositionMatcher.prototype.setReference;
const standardMatcher=matcher=>matcher&&Object.getPrototypeOf(matcher)===MapPositionMatcher.prototype&&matcher.match===originalMatch&&matcher.setReference===originalSetReference;
// One slot inside one frozen-frame probe, never a cross-request cache. Keep an
// owned exact input key, not a hash-only equivalence or mutable evidence alias.
export function createCompletedMinimapRegistrationReuse(){
 let saved=null;
 return({matcher,frame,excluded,mapImage,mapId})=>{
  const supported=standardMatcher(matcher)&&frame.luma===undefined&&frame.rgba?.length===frame.width*frame.height*4&&frame.rgba.length<=128*96*4&&mapImage.rgba?.length===mapImage.width*mapImage.height*4&&mapImage.rgba.length<=2097152*4&&excluded.length<=256&&excluded.every(r=>['x','y','w','h'].every(k=>Number.isFinite(r[k]))),exclusions=supported?JSON.stringify(excluded.map(({x,y,w,h})=>[x,y,w,h])):null;
  const hit=supported&&saved&&saved.matcher===matcher&&saved.exports===matcher.e&&saved.memory===matcher.e.memory&&saved.heapBase===matcher.base&&saved.algorithm===matcher.e.map_registration&&saved.width===mapImage.width&&saved.height===mapImage.height&&saved.frameWidth===frame.width&&saved.frameHeight===frame.height&&saved.exclusions===exclusions&&sameBytes(saved.referenceRGBA,mapImage.rgba)&&sameBytes(saved.frameRGBA,frame.rgba);
  if(hit){
   try{const result=structuredClone(saved.result);const rebind=r=>{r.mapId=mapId;r.descriptor=mapImage.descriptor.path;if(r.fallback)rebind(r.fallback.initialRegistration);};rebind(result);result.sameFrameCompletedSearchReuse={kind:'same-frame-identical-minimap-search',sourceMapId:saved.mapId,sourceDescriptor:saved.descriptor,referenceRGBAIdentical:true,frameRGBAIdentical:true,exclusionsIdentical:true,algorithmIdentical:true,completedSearchOnly:true,maximumMilliseconds:1500,newSearchPerformed:false,searchTimingsReferToOriginalComputation:true,scope:'Owned result of a completed search on the same frozen pixels/reference/exclusions. Only map/descriptor output labels are rebound; map binding, world coordinates and floors are still evaluated independently.'};return result;}catch{/* A failed ownership copy falls back to the original search. */}
  }
  saved=null;const result=matchVideoMinimapRegistration(matcher,frame,{excluded});
  if(supported&&complete(result))try{saved={matcher,exports:matcher.e,memory:matcher.e.memory,heapBase:matcher.base,algorithm:matcher.e.map_registration,width:mapImage.width,height:mapImage.height,referenceRGBA:mapImage.rgba.slice(),frameWidth:frame.width,frameHeight:frame.height,frameRGBA:frame.rgba.slice(),exclusions,result:structuredClone(result),mapId,descriptor:mapImage.descriptor.path};}catch{/* Optional reuse cannot discard a computed result. */}
  return result;
 };
}
