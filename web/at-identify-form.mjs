import {compileExperiment} from './at-observation-compiler.mjs';
import {prepare,cancelCheckpoint} from './at-identify-engine.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};
function number(value,label,min,max){const s=String(value??'').trim();need(/^(0|[1-9]\d*)$/.test(s),`${label}: 10進の整数を入力してください`);const n=Number(s);need(Number.isSafeInteger(n)&&n>=min&&n<=max,`${label}: ${min}〜${max} の範囲です`);return n;}
function ids(value,label){const s=String(value??'').trim();if(!s)return [];const a=s.split(/[\s,、]+/).map(x=>number(x,label,0,65535));need(a.length<=32,`${label}: 候補は32個までです`);return [...new Set(a)];}
export const syntheticExample=()=>({synthetic:true,ordered:true,rows:[{label:'合成例 A',tables:'30',species:'31',gapMode:'unknown',gapMin:'',gapMax:'',gapProvenance:''},{label:'合成例 B',tables:'30',species:'31',gapMode:'range',gapMin:'1',gapMax:'3',gapProvenance:'動作確認用の合成仮定。映像の証拠ではない'}],domainMode:'interval',domainFirst:'0',domainLast:'65535',domainProvenance:'動作確認用の合成範囲',maxStates:'100000',maxMs:'2000',chunkStates:'4096'});
export function buildFormRequest(form,tables){
 need(Array.isArray(form.rows)&&form.rows.length>=1&&form.rows.length<=8,'観測は1〜8行で入力してください');
 const sightings=[],events=[],edges=[],bindings={},observationEdges=[];
 for(let i=0;i<form.rows.length;i++){
  const row=form.rows[i],sid=`s${i+1}`,eid=`event${i+1}`;
  const tableIds=ids(row.tables,`観測${i+1}の表ID`),species=ids(row.species,`観測${i+1}の種ID`);
  sightings.push({id:sid,label:String(row.label??'').slice(0,160),source:form.synthetic?'synthetic':'manual-entry',birthCertified:false});
  events.push({id:eid,operation:'weighted-species',stateBoundary:'immediately-after-draw',tableSpeciesAlternatives:tableIds.flatMap(tableId=>species.map(monsterId=>({tableId,monsterId}))),evidence:{status:form.synthetic?'synthetic-test-only':'unverified-user-hypothesis',sightingId:sid}});
  bindings[sid]=eid;
  observationEdges.push({from:eid,toSighting:sid,callsAfterEvent:{min:'0',max:null},provenance:'抽選から目視までの消費数は未確定'});
  if(i&&form.ordered){
   need(['unknown','range'].includes(row.gapMode),'消費間隔の選択が不正です');
   let gap=null,provenance='消費間隔不明。時間差から有限上限を推定しない';
   if(row.gapMode==='range'){
    const min=number(row.gapMin,`観測${i+1}までの最小消費`,1,Number.MAX_SAFE_INTEGER),max=number(row.gapMax,`観測${i+1}までの最大消費`,1,Number.MAX_SAFE_INTEGER);need(max>=min,'最大消費は最小消費以上にしてください');provenance=String(row.gapProvenance??'').trim();need(provenance,'有限の消費間隔には根拠・仮定を記入してください');gap={min:String(min),max:String(max)};
   }
   edges.push({from:`event${i}`,to:eid,callsBetweenPostStates:gap,provenance});
  }
 }
 const alternatives=[{id:'unresolved-association',description:'既存個体・再出現・同一個体の再観測。出生と観測の対応が不明'},{id:'unresolved-label-origin',description:'種の誤認、表の不足、別の生成経路など。網羅性未保証'}];
 const experiment=compileExperiment({sightings,associationAlternatives:alternatives,hypotheses:[{id:'conditional-chain',association:'各行を別の自然生成抽選に対応させた条件付き仮説',events,edges,sightingEventBindings:bindings,observationEdges,assumptions:[form.synthetic?'合成例。実測結果ではない':'手入力した種・表候補を仮定', '各観測に自然生成の種抽選を仮定。出生の証明はない',form.ordered?'行順を抽選順と仮定':'抽選順不明。目視順から補完しない','イベントから観測までの未知の消費は伝播していない']},...alternatives.map(a=>({id:a.id,association:a.description,events:[],edges:[],assumptions:[a.description]}))],coverage:{associationEnumerationComplete:false,eventHypothesesComplete:false}},{tables});
 let domain;if(form.domainMode==='all')domain={kind:'all-output-classes'};else{need(form.domainMode==='interval','探索範囲を選択してください');const first=number(form.domainFirst,'範囲の先頭',0,2147483647),last=number(form.domainLast,'範囲の末尾',0,2147483647);need(last>=first,'範囲の末尾は先頭以上にしてください');const provenance=String(form.domainProvenance??'').trim();need(provenance,'有限の探索範囲には根拠・仮定を記入してください');domain={kind:'intervals',intervals:[{first,last}],provenance};}
 const request={experiment,domain,budget:{maxInspectedStates:number(form.maxStates,'計算予算（状態数）',0,2147483648),maxWallTimeMs:number(form.maxMs,'計算予算（ms）',0,600000),chunkStates:number(form.chunkStates,'チャンク状態数',1,1000000)}};
 prepare(request);return request;
}
// Cancellation covers both resource loading and the real Worker lifetime.
export function createSearchController({loadResources,startSearch,onState=()=>{}}){
 let epoch=0,job=null,abort=null;
 const cancel=()=>{epoch++;abort?.abort();abort=null;if(job){const retained=job.checkpoint();job.cancel();job=null;onState({phase:'cancelled',checkpoint:cancelCheckpoint(retained)});}else onState({phase:'cancelled',checkpoint:null});};
 const run=async form=>{
  const snapshot=structuredClone(form);epoch++;const mine=epoch;abort?.abort();job?.cancel();job=null;abort=new AbortController();onState({phase:'loading',checkpoint:null});
  try{
   const resources=await loadResources(abort.signal);if(mine!==epoch)return null;
   const request=buildFormRequest(snapshot,resources.tables);job=startSearch(request,{wasmBytes:resources.wasmBytes,onProgress:checkpoint=>{if(mine===epoch)onState({phase:'running',checkpoint});}});onState({phase:'running',checkpoint:job.checkpoint()});
   const result=await job.result;if(mine!==epoch)return null;job=null;abort=null;onState({phase:result.status,checkpoint:result});return result;
  }catch(error){if(mine!==epoch)return null;job?.cancel();job=null;abort=null;onState({phase:'failed',checkpoint:null,error:String(error?.message??error)});return null;}
 };
 return{run,cancel};
}
