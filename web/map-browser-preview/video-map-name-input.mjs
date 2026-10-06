// Existing ROM-font matcher -> same-frame map candidates; no name injected by caller.
import {mineRuntimeFonts} from '../font-core.mjs';
import {detectMapNameROI} from '../map-name-roi.mjs';
import {mapCandidatesFromAkinator} from '../map-disambiguation.mjs';
import {upperVideoROI} from './video-player-map-input.mjs?v=map-input-owned-preparation-20261006-1408';
import {sampleGameplayFrame} from './map-video-residual.mjs?v=camera-loss-evidence-20261006-1205';
const fontCache=new WeakMap();
export const MAP_NAME_OPTIONS=Object.freeze({autoThreshold:true,threshold:220,scales:[.95,1,1.05],charCount:16,maxMilliseconds:10000});
export async function deriveVideoMapNames({sourceImage,layout,frameEvidence,romSHA256,project,records,matchText}){
 if(!/^[0-9a-f]{64}$/.test(romSHA256??''))throw Error('投入ROMのSHA256が必要です');
 if(!frameEvidence?.fullRGBA_SHA256)throw Error('固定フレームの画素識別情報が必要です');
 const upperROI=upperVideoROI(sourceImage.width,sourceImage.height,layout),upper=sampleGameplayFrame(sourceImage,upperROI),panel=detectMapNameROI({width:256,height:192,data:upper.rgba});
 const base={kind:'same-frame-ROM-map-name-candidates',frameEvidence,romSHA256,upperROI,panel,minimumProvenATCalls:0,mapIdentityKnown:false,unsearchedTextPossible:true};
 if(!panel.resolved)return{...base,status:'name-panel-unresolved',nameCandidates:{mapIds:[],names:[],provenance:[]},maps:[],fontResult:null};
 if(!fontCache.has(project))fontCache.set(project,mineRuntimeFonts(project.nfs));const fonts=fontCache.get(project),p=panel.pixels,data=new Uint8ClampedArray(p.w*p.h*4);
 for(let y=0;y<p.h;y++)data.set(upper.rgba.subarray(((p.y+y)*256+p.x)*4,((p.y+y)*256+p.x+p.w)*4),y*p.w*4);
 const fontResult=await matchText({width:p.w,height:p.h,data},{glyphsBySize:fonts.glyphsBySize,options:{...MAP_NAME_OPTIONS,scales:[...MAP_NAME_OPTIONS.scales]}});
 const nameCandidates=mapCandidatesFromAkinator({...fontResult,cpuOneFrame:true},records),ids=new Set(nameCandidates.mapIds),maps=records.filter(r=>ids.has(r.mapId)).map(r=>({key:r.key,mapId:r.mapId,name:r.name,displayLabel:r.displayLabel,fieldCode:r.fieldCode,minimapCandidates:r.minimapCandidates,source:r.source,unresolved:r.unresolved}));
 return{...base,status:maps.length?'map-candidate-set':'font-name-join-unresolved',fonts:fonts.summary,options:MAP_NAME_OPTIONS,fontResult,nameCandidates,maps,scope:'Current pixels nominate exact-name catalog alternatives. All aliases and unsearched font/name hypotheses remain unknown. No other frame inherits this map set and no current map is certified.'};
}
