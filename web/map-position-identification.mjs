// Reverse the fixed display relation: observed map texture + approximate marker
// location -> possible map IDs. A nearby physical/outdoor position stays possible.
import {materializePartyMapCandidate} from './party-map-candidates.mjs';
const finite=Number.isFinite;
const grouped=new WeakMap();
function rowsByDescriptor(index){
 if(!index||!Array.isArray(index.rows))throw Error('Map coordinate index required');
 if(!grouped.has(index)){const groups=new Map();for(const row of index.rows){if(!groups.has(row.descriptor))groups.set(row.descriptor,[]);groups.get(row.descriptor).push(row);}grouped.set(index,groups);}
 return grouped.get(index);
}
export function fixedMapIdsNearPoint(index,{descriptor,x,y,bounds,paddingPixels=4}){
 if(typeof descriptor!=='string'||![x,y,paddingPixels].every(finite)||paddingPixels<0||paddingPixels>64)throw Error('Finite image point and 0–64 pixel tolerance required');
 const b=bounds??{left:x,right:x,top:y,bottom:y};
 if(![b.left,b.right,b.top,b.bottom].every(finite)||b.left>b.right||b.top>b.bottom||x<b.left||x>b.right||y<b.top||y>b.bottom)throw Error('Ordered image bounds containing point required');
 const range={left:b.left-paddingPixels,right:b.right+paddingPixels,top:b.top-paddingPixels,bottom:b.bottom+paddingPixels},rows=rowsByDescriptor(index).get(descriptor)||[];
 const candidates=rows.filter(r=>r.kind==='fixed-display-anchor'&&r.imagePoint?.insideImage&&r.imagePoint.x>=range.left&&r.imagePoint.x<=range.right&&r.imagePoint.y>=range.top&&r.imagePoint.y<=range.bottom).map(r=>({mapId:r.mapId,descriptor,mapRecords:structuredClone(r.mapRecords),imagePoint:structuredClone(r.imagePoint),distancePixels:Math.hypot(r.imagePoint.x-x,r.imagePoint.y-y),source:structuredClone(r.source)})).sort((a,b)=>a.distancePixels-b.distancePixels||a.mapId-b.mapId);
 return {descriptor,point:{x,y},range,paddingPixels,candidates,physicalMapIds:rows.filter(r=>r.kind==='physical-xz').map(r=>r.mapId),unknownMapIds:rows.filter(r=>r.kind==='unknown'||(r.kind==='fixed-display-anchor'&&!r.imagePoint?.insideImage)).map(r=>r.mapId),descriptorKnown:rows.length>0,confidenceCalibrated:false,transformVerified:false};
}
/** All descriptor / marker / registration alternatives participate. A display
 * budget is explicit and cannot turn the closest point into a unique answer. */
export function identifyMapIdsFromPartyPositions(index,factors,{paddingPixels=4,maxBranches=4096}={}){
 if(factors?.kind!=='factorized-party-map-coordinate-candidates'||!Array.isArray(factors.references)||!Array.isArray(factors.markerCandidates))throw Error('Same-capture factored map and marker observations required');
 if(!Number.isInteger(maxBranches)||maxBranches<1||maxBranches>16384||!finite(paddingPixels)||paddingPixels<0||paddingPixels>64)throw Error('Bounded reverse lookup options required');
 rowsByDescriptor(index);
 const source=factors.candidateSource,sourceIds=Array.isArray(source?.mapIds)?source.mapIds:Array.isArray(source?.provenance)?source.provenance.flatMap(p=>p.mapIds||[]):null,textIds=sourceIds?new Set(sourceIds):null;
 const candidates=new Map(),alternatives=[],unknown=structuredClone(factors.unknownMapHypotheses||[]);let evaluatedBranches=0,invalidBranches=0;
 const totalBranches=factors.references.reduce((n,r)=>n+(r.peaks?.length||0)*factors.markerCandidates.length,0);
 outer:for(let ri=0;ri<factors.references.length;ri++)for(let mi=0;mi<factors.markerCandidates.length;mi++)for(let pi=0;pi<factors.references[ri].peaks.length;pi++){
  if(evaluatedBranches>=maxBranches)break outer;evaluatedBranches++;
  const observation=materializePartyMapCandidate(factors,ri,mi,pi);if(!observation){invalidBranches++;continue;}
  const point=observation.image,near=fixedMapIdsNearPoint(index,{descriptor:observation.descriptor,x:point.x,y:point.y,bounds:point.bounds,paddingPixels});
  const evidence={referenceIndex:ri,markerIndex:mi,peakIndex:pi,markerId:observation.markerId,profileId:observation.profileId,point:near.point,range:near.range,registrationCandidate:observation.registrationCandidate,bestCandidateWithinFontSet:observation.bestCandidateWithinFontSet,registrationScore:observation.registrationScore};
  alternatives.push({...evidence,descriptor:observation.descriptor,fixedMapIds:near.candidates.map(c=>c.mapId),physicalMapIds:near.physicalMapIds,unknownMapIds:near.unknownMapIds,descriptorKnown:near.descriptorKnown});
  for(const c of near.candidates){const key=c.descriptor+'\0'+c.mapId;if(!candidates.has(key))candidates.set(key,{...c,textNominated:textIds?textIds.has(c.mapId):null,supportedByResolvedRegistration:false,evidence:[]});const candidate=candidates.get(key);candidate.distancePixels=Math.min(candidate.distancePixels,c.distancePixels);candidate.supportedByResolvedRegistration||=evidence.registrationCandidate;candidate.evidence.push({...evidence,distancePixels:c.distancePixels});}
 }
 const complete=evaluatedBranches===totalBranches&&invalidBranches===0;
 if(evaluatedBranches<totalBranches)unknown.push({mapId:null,reason:'reverse-position-branch-budget',remainingBranches:totalBranches-evaluatedBranches});
 if(invalidBranches)unknown.push({mapId:null,reason:'invalid-position-branches',count:invalidBranches});
 const list=[...candidates.values()].sort((a,b)=>Number(b.supportedByResolvedRegistration)-Number(a.supportedByResolvedRegistration)||a.distancePixels-b.distancePixels||a.mapId-b.mapId);
 return {kind:'map-ids-from-observed-display-position',stamp:structuredClone(factors.stamp),status:!totalBranches?'position-unavailable':list.length?'fixed-display-map-candidates':'no-fixed-anchor-in-range',candidates:list,alternatives,unknown,evaluatedBranches,totalBranches,complete,paddingPixels,uncertaintyBasis:'Observed component extent plus registration-grid error, expanded by explicit image-pixel tolerance; heuristic, not calibrated coverage',confidenceCalibrated:false,transformVerified:false,currentMapId:null,mapIdentityResolved:false,physicalPositionAlternativesRetained:true,unknownRuntimeContextPossible:true,minimumProvenATCalls:0,automaticATConsumption:false};
}
export function mapPositionCandidateLabel(candidate){
 const labels=[...new Set((candidate.mapRecords||[]).map(r=>[r.name,r.internalLabel].filter(Boolean).join(' / ')).filter(Boolean))],codes=[...new Set((candidate.mapRecords||[]).map(r=>r.fieldCode).filter(Boolean))];
 return `${labels.join('・')||'名称未対応'} · map ${candidate.mapId}${codes.length?' ('+codes.join('/')+')':''}`;
}
export function appendMapPositionIdentification(host,result,{limit=24,document:doc=globalThis.document}={}){
 const heading=doc.createElement('p');
 if(!result){heading.textContent='地図の点 → 建物などの map ID候補: 座標対応を利用できません';host.append(heading);return;}
 heading.textContent=`地図の点 → 建物などの map ID候補: ${result.candidates.length}件 · 追加許容 ±${result.paddingPixels}px（未校正）${result.complete?'':' · 未評価の位置候補あり'}`;host.append(heading);
 for(const c of result.candidates.slice(0,limit)){const line=doc.createElement('div');line.textContent=`${mapPositionCandidateLabel(c)} · 点との差 ${c.distancePixels.toFixed(1)}px · ${c.supportedByResolvedRegistration?'画像位置候補の範囲内':'弱い画像位置候補の範囲内'} · ${c.descriptor}`;host.append(line);}
 if(result.candidates.length>limit){const more=doc.createElement('p');more.textContent=`ほか ${result.candidates.length-limit}件は観測ログに保持`;host.append(more);}
 const physical=[...new Set(result.alternatives.flatMap(a=>a.physicalMapIds))],note=doc.createElement('p');
 note.textContent=(result.candidates.length?'同じ位置の別建物・階層IDを残します。':result.status==='position-unavailable'?'点または地図の位置候補を待っています。':'誤差範囲に対応する固定表示点がありません。最寄りの建物へ決めつけません。')+(physical.length?` 同じ点を物理座標として表示する map ${physical.join('/')} も候補です。`:'')+' 地図画像・点の本人・表示モードは未確定です。';host.append(note);
}
