import {markerColorCandidates} from './player-position.mjs';
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
const validate=frame=>{if(frame?.width!==256||frame?.height!==192||frame?.rgba?.length!==256*192*4)throw Error('Native256x192 upper-screen RGBA required');};
/** Current source HUD stripes, not fixed colors for party members2–4.
 * Slot/color association is evidence only: party identity and count remain unknown.
 */
export function calibratePartyHUD(frame){
 validate(frame);const{rgba}=frame,profiles=[],rejected=[];
 for(let slot=0;slot<4;slot++){
  const stripes=[[],[]];for(let y=181;y<=188;y++)for(let k=0;k<3;k++)for(const[side,x]of[[0,slot*64+3+k],[1,slot*64+58+k]])stripes[side].push([...rgba.subarray((y*256+x)*4,(y*256+x)*4+3)]);
  const centers=stripes.map(p=>[0,1,2].map(c=>median(p.map(v=>v[c])))),measuredRGB=[0,1,2].map(c=>median(stripes.flat().map(v=>v[c]))),agreement=Math.max(...centers[0].map((v,c)=>Math.abs(v-centers[1][c]))),consistent=stripes.flat().filter(v=>v.every((n,c)=>Math.abs(n-measuredRGB[c])<=24)).length/48;
  let dark=0,brightBorder=0;for(let y=181;y<=188;y++){for(let x=slot*64+12;x<slot*64+52;x++){const k=(y*256+x)*4;dark+=Number(Math.max(...rgba.subarray(k,k+3))<110);}for(const x of[slot*64+1,slot*64+62]){const k=(y*256+x)*4;brightBorder+=Number(Math.min(...rgba.subarray(k,k+3))>120);}}
  const evidence={agreement,consistent,darkFraction:dark/320,borderFraction:brightBorder/16},reason=agreement>24?'left-right-colors-disagree':consistent<.70?'unstable-stripe-color':dark/320<.55?'party-panel-not-dark':brightBorder/16<.5?'party-border-unconfirmed':Math.max(...measuredRGB)<35?'stripe-too-dark':null;
  if(reason){rejected.push({slot:slot+1,reason,measuredRGB,evidence});continue;}
  profiles.push({id:slot===0?'nominal-first-gray-hypothesis':'current-HUD-slot-'+(slot+1),slot:slot+1,rgb:slot===0?[66,66,66]:measuredRGB,measuredRGB,evidence,identity:'unverified-slot-color-association',colorBasis:slot===0?'nominal-first-gray-with-codec-tolerance':'same-frame-left-and-right-HUD-stripes'});
 }
 if(!profiles.some(p=>p.slot===1))profiles.unshift({id:'nominal-first-gray-hypothesis',slot:1,rgb:[66,66,66],identity:'unverified-first-player-color-hypothesis',colorBasis:'nominal-gray-fallback-no-HUD-confirmation'});
 return {profiles,rejected,status:rejected.length===0?'source-stripes-calibrated':profiles.length>1?'source-stripes-partial':'source-stripes-unavailable',partyCountKnown:false,slotAssociationProven:false,confidenceCalibrated:false};
}
function overlap(a,b){const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return w*h/Math.min(a.w*a.h,b.w*b.h);}
/** Compact source-colored components with dark-outline support; never force1–4.
 * Black blending reduces brightness in captured marker fills. Chroma ratios for
 * colored followers tolerate that; nominal gray keeps its narrow RGB comparison.
 */
export function calibratedPartyMarkerCandidates(frame){
 validate(frame);const calibration=calibratePartyHUD(frame),rawCandidates=[],rejectedCandidates=[];
 for(const profile of calibration.profiles){
  const max=Math.max(...profile.rgb),min=Math.min(...profile.rgb),saturated=(max-min)/max>.4,masked=new Uint8Array(frame.rgba.length);
  profile.matchModel=profile.slot===1?{kind:'nominal-gray-RGB',tolerance:12}:saturated?{kind:'source-chroma-with-dark-blend',minimumValueRatio:.48,maximumValueRatio:1.16,normalizedChannelTolerance:.13}:{kind:'source-neutral-with-dark-blend',minimumValueRatio:.75,maximumValueRatio:1.15,normalizedChannelTolerance:.13};
  for(let i=0;i<256*192;i++){const k=i*4,rgb=[frame.rgba[k],frame.rgba[k+1],frame.rgba[k+2]],v=Math.max(...rgb),norm=v>0?Math.max(...rgb.map((c,j)=>Math.abs(c/v-profile.rgb[j]/max))):1,on=profile.slot===1?rgb.every((c,j)=>Math.abs(c-profile.rgb[j])<=12):saturated?(v>=max*.48&&v<=Math.min(255,max*1.16)&&norm<=.13):(v>=max*.75&&v<=Math.min(255,max*1.15)&&norm<=.13);masked[k]=masked[k+1]=masked[k+2]=on&&frame.rgba[k+3]>0?255:0;masked[k+3]=255;}
  const result=markerColorCandidates({...frame,rgba:masked},{id:profile.id,rgb:[255,255,255],tolerance:0,minimumPixels:saturated?2:3,maximumPixels:30,maximumExtent:8,excluded:[{x:0,y:0,w:256,h:20},{x:0,y:172,w:256,h:20}]});
  for(const c of result.candidates){let dark=0,total=0;const b=c.bounds,darkLimit=Math.min(140,Math.max(75,max*.65));for(let y=Math.max(0,b.y-2);y<Math.min(192,b.y+b.h+2);y++)for(let x=Math.max(0,b.x-2);x<Math.min(256,b.x+b.w+2);x++){if(x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h)continue;const k=(y*256+x)*4;dark+=Number(Math.max(...frame.rgba.subarray(k,k+3))<darkLimit);total++;}
   const candidate={...c,id:profile.id+':'+c.id,profileId:profile.id,profileIds:[profile.id],slotColorCandidates:[profile.slot],slotAssociationProven:false,identity:'unverified-party-colored-marker',shapeEvidence:{darkBorderFraction:dark/total,darkLimit,compactExtent:true},overlapPossible:true};
   if(dark/total<.12)rejectedCandidates.push({...candidate,reason:'dark-outline-not-supported'});else rawCandidates.push(candidate);
  }
 }
 // Same physical component can match several currently equal HUD colors. Keep
 // those slot alternatives together rather than counting duplicate profiles as people.
 const candidates=[];for(const c of rawCandidates){const prior=candidates.find(p=>Math.hypot(p.x-c.x,p.y-c.y)<=1&&overlap(p.bounds,c.bounds)>=.7);if(prior){prior.profileIds=[...new Set([...prior.profileIds,...c.profileIds])];prior.slotColorCandidates=[...new Set([...prior.slotColorCandidates,...c.slotColorCandidates])];prior.profileId='current-HUD-slots-'+prior.slotColorCandidates.join('/');prior.colorProfileAmbiguous=true;}else candidates.push(c);}
 return {frame:{width:256,height:192},profileId:'same-frame-party-HUD-calibration',calibration,candidates,rejectedCandidates,rawCandidateCount:rawCandidates.length,resolvedIdentity:false,partyCountKnown:false,slotAssociationProven:false,overlapPossible:true,confidenceCalibrated:false};
}
