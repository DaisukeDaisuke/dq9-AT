// Read-only comparison of explicitly materialized event states. Nothing here
// restores a session, proves a boot origin, or advances the ledger.
import {parseSeed} from './at-core.mjs';
export const CANDIDATE_FORECAST_KEY='dq9-at-candidate-forecast-v1';
export const CANDIDATE_FORECAST_BUDGET={maxEvaluations:50000,maxWallTimeMs:1500,chunkEvaluations:256};
const need=(v,m)=>{if(!v)throw Error(m);};
const uint32=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff;
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function index(v){need(typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v),'候補indexは正確な10進文字列が必要です');const n=BigInt(v);need(n<=0xffffffffffffffffn,'候補indexがuint64範囲外です');return n;}
export function readCandidateResult(raw){
 const r=structuredClone(raw);
 need(r?.schema==='bounded-at-terminal-index-identification-v1','既知initial seed方式の結果JSONが必要です。low31の表示サンプルは全候補の代わりに使えません');
 need(r.origin?.kind==='initial-state-before-draw-1'&&uint32(r.origin.initialSeed),'候補のinitial seed起点が不正です');
 need(r.domain?.kind==='known-origin-terminal-indices'&&r.domain.origin?.initialSeed===r.origin.initialSeed,'候補の探索範囲と起点seedが一致しません');
 const first=index(r.domain.first),last=index(r.domain.last);need(first>=1n&&last>=first&&last-first<2147483648n,'候補の宣言範囲が不正です');
 need(Array.isArray(r.branches)&&r.branches.length>0,'候補の枝情報がありません');
 let total=0;const ids=new Set();
 for(const b of r.branches){
  need(typeof b.branchId==='string'&&!ids.has(b.branchId),'候補の枝IDが不正または重複です');ids.add(b.branchId);
  const m=b.candidateMaterialization;
  need(m?.format==='uint32-relative-index-offsets-and-full-states','完全な候補状態レコードがありません');
  need(Array.isArray(m.indexOffsets)||m.indexOffsets instanceof Uint32Array,'候補index配列がありません');
  need(Array.isArray(m.states32)||m.states32 instanceof Uint32Array,'候補状態配列がありません');
  need(Number.isSafeInteger(m.materializedCount)&&m.materializedCount>=0&&m.materializedCount===m.indexOffsets.length&&m.materializedCount===m.states32.length,'候補状態レコード数が一致しません');
  const base=index(m.baseTerminalIndex);need(base===first,'候補レコードの基準indexが一致しません');
  let previous=-1;for(let i=0;i<m.materializedCount;i++){const off=m.indexOffsets[i];need(uint32(off)&&off>previous&&base+BigInt(off)<=last&&uint32(m.states32[i]),'候補状態レコードが不正または重複です');previous=off;}
  need(b.candidateIndicesFound===null||/^(0|[1-9][0-9]*)$/.test(b.candidateIndicesFound),'候補件数が不正です');
  need(b.candidateIndicesFound===null||BigInt(b.candidateIndicesFound)>=BigInt(m.materializedCount),'発見件数より保存済み候補が多い結果です');
  need(Array.isArray(b.unsearchedIndexIntervals)&&Array.isArray(b.searchedIndexIntervals),'未探索範囲がありません');
  total+=m.materializedCount;need(total<=100000,'元の識別器の候補保存上限100000件を超えています');
 }
 return r;
}
export function verifyCandidateAssociation(result,session){
 const r=readCandidateResult(result),form=r.inputForm,source=form?.sessionContext;
 need(session?.format==='dq9-at-session'&&session.origin==='external-known-seed-from-boot','候補の元になった追跡セッションを復元してください（自動復元はしません）');
 need(source?.format==='dq9-at-session-identification-source-v1','保存観測に結び付いた結果が必要です。手入力だけの結果は追跡セッションへ結び付けません');
 need(parseSeed(session.initialSeed)===r.origin.initialSeed&&parseSeed(source.initialSeed)===r.origin.initialSeed&&parseSeed(form.initialSeed)===r.origin.initialSeed,'候補と追跡セッションのinitial seedが一致しません');
 need(source.origin===session.origin&&source.createdAt&&source.createdAt===session.createdAt,'候補の元セッションが一致しません');
 const selected=source.selectedObservationIds;
 need(Array.isArray(selected)&&selected.length>0&&new Set(selected).size===selected.length,'候補の選択観測IDが不正です');
 const rows=form.rows?.filter(row=>row.sourceObservation);
 need(rows?.length===form.rows.length&&canonical(rows.map(row=>row.sightingId))===canonical(selected),'候補の観測対応が変更されています');
 for(const row of rows){
  const saved=row.sourceObservation,actual=session.events?.[saved.eventIndex];
  need(actual?.kind==='monster-observation'&&actual.id===row.sightingId&&saved.event?.id===row.sightingId&&canonical(actual)===canonical(saved.event),`保存観測 ${row.sightingId} が追跡セッションと一致しません`);
 }
 for(const b of r.branches)if(b.candidateMaterialization.materializedCount){need(b.eventBoundaryId===rows.at(-1).eventId,'候補の最終抽選と選択観測の対応が一致しません');for(const row of rows)need(b.sightingEventBindings?.[row.sightingId]===row.eventId,'候補の観測→抽選対応が一致しません');}
 return{initialSeed:r.origin.initialSeed,createdAt:source.createdAt,observationIds:[...selected],sourceContext:structuredClone(source)};
}
export function candidateCoverage(result){
 return result.branches.map(b=>({branchId:b.branchId,status:b.status,eventBoundaryId:b.eventBoundaryId??null,candidateIndicesFound:b.candidateIndicesFound,materializedCount:b.candidateMaterialization.materializedCount,searchCompleteWithinDomain:b.searchCompleteWithinDomain===true,allFoundCandidatesMaterialized:b.candidateIndicesFound!==null&&BigInt(b.candidateIndicesFound)===BigInt(b.candidateMaterialization.materializedCount),unsearchedIndexIntervals:structuredClone(b.unsearchedIndexIntervals),outsidePriorPossible:b.outsidePriorPossible!==false,predicateExact:b.predicateExact===true,reason:b.reason??null}));
}
export async function compareCandidateTails(raw,{context,gap,targetIds,window=50000,budget=CANDIDATE_FORECAST_BUDGET},kernel,fieldKernel,tables,{cancelled=()=>false,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),now=()=>performance.now()}={}){
 const r=readCandidateResult(raw),coverage=candidateCoverage(r);
 need(context?.resolved&&context.mapId!==null&&context.graphKey&&context.source==='manual-ROM-node-selection-not-live-observation'&&Array.isArray(context.rows)&&context.rows.length&&context.areaMasks?.length&&context.timeValues?.length,'ROMから読み込んだ現在のmap・node/area・時間を選択してください。保存map IDだけでは再構築しません');
 need(Array.isArray(targetIds)&&targetIds.length&&targetIds.every(n=>Number.isInteger(n)&&n>=0&&n<=65535),'対象monsterを選択してください');
 need(Number.isInteger(window)&&window>=2&&window<=1000000,'比較窓は2..1000000 drawです');
 need(budget&&Number.isInteger(budget.maxEvaluations)&&budget.maxEvaluations>=1&&budget.maxEvaluations<=50000&&Number.isFinite(budget.maxWallTimeMs)&&budget.maxWallTimeMs>0&&budget.maxWallTimeMs<=1500&&Number.isInteger(budget.chunkEvaluations)&&budget.chunkEvaluations>=1&&budget.chunkEvaluations<=256,'比較の計算予算が不正です');
 const out={format:'dq9-candidate-natural-tail-comparison-v1',status:'unresolved',origin:structuredClone(r.origin),sourceObservations:structuredClone(r.inputForm?.sessionContext??null),identificationInputForm:structuredClone(r.inputForm??null),context:structuredClone(context),gap:structuredClone(gap??null),targetIds:[...targetIds],window,budget:{...budget},coverage,evaluations:0,fullyComparedOffsets:0,partialOffset:null,rows:[],allCandidatePossibilitiesCovered:false,currentATRecovered:false,ledgerChanged:false,frameTimingKnown:false,interpretation:'最終抽選候補から明記した消費区間を進めた参照点を使い、さらに指定draw先でtable→weightedに到達した場合だけの比較。時間・経路・生成成功の保証ではない。未探索・未保存・別の出生対応・範囲外は残る。'};
 // Unknown is not silently interpreted as zero, even if no candidate exists.
 if(gap?.kind!=='bounded'){out.reason='最終抽選→比較参照点の消費数は不明です。有限範囲と根拠・仮定が必要です';return out;}
 need(Number.isInteger(gap.min)&&Number.isInteger(gap.max)&&gap.min>=0&&gap.max>=gap.min&&gap.max<=1000000&&typeof gap.provenance==='string'&&gap.provenance.trim(),'消費区間は0..1000000の有限範囲と根拠・仮定が必要です');
 const scenarios=[];for(const areaMask of [...new Set(context.areaMasks)])for(const timeValue of [...new Set(context.timeValues)])scenarios.push({areaMask,timeValue,tableIds:fieldKernel.tableCandidates(context.rows,timeValue,areaMask).map(row=>row.tableId)});
 out.scenarios=scenarios;
 const candidates=[],start=now(),targets=new Set(targetIds);
 out.materializedCandidates=coverage.reduce((count,b)=>count+b.materializedCount,0);
 out.stateVerification={verified:0,total:out.materializedCandidates,complete:false};
 // State/index verification is part of the same wall-time budget, and yields
 // before a large saved result can block cancellation or other worker inputs.
 for(const b of r.branches){const m=b.candidateMaterialization;for(let i=0;i<m.materializedCount;i++){
  if(cancelled()||now()-start>=budget.maxWallTimeMs){out.status=cancelled()?'cancelled':'budget-stopped';out.reason='候補stateの検証中に中止または時間予算へ到達。未検証候補を除外せず、tail比較は未実施です';return out;}
  const terminalIndex=BigInt(m.baseTerminalIndex)+BigInt(m.indexOffsets[i]);need(kernel.seedAt(r.origin.initialSeed,terminalIndex)===m.states32[i],'保存された候補stateとinitial seed/indexが一致しません');candidates.push({branchId:b.branchId,eventBoundaryId:b.eventBoundaryId,terminalIndex:String(terminalIndex),state32:m.states32[i]});out.stateVerification.verified++;
  if(out.stateVerification.verified%budget.chunkEvaluations===0)await yieldTask();
 }}
 out.stateVerification.complete=true;
 if(!candidates.length){out.reason='比較できる完全な候補レコードがありません。0候補での全体棄却や別枝の除外はしません';return out;}
 const paths=BigInt(candidates.length)*BigInt(gap.max-gap.min+1)*BigInt(scenarios.length);out.pathsPerOffset=String(paths);out.requestedEvaluations=String(paths*BigInt(window-1));
 for(let offset=1;offset<window;offset++){
  const row={offset,weightedOffset:offset+1,evaluatedPaths:0,targetPaths:0,unresolvedPaths:0,outcomes:[],complete:false,agreement:'partial'};const outcomes=new Map();
  outer:for(const candidate of candidates)for(let consumed=gap.min;consumed<=gap.max;consumed++)for(const scenario of scenarios){
   if(cancelled()||out.evaluations>=budget.maxEvaluations||now()-start>=budget.maxWallTimeMs){out.status=cancelled()?'cancelled':'budget-stopped';out.reason=out.status==='cancelled'?'条件が変更されたため中止':'比較予算に到達。未比較の候補・区間・draw先を除外しません';break outer;}
   const absolute=BigInt(candidate.terminalIndex)+BigInt(consumed)+BigInt(offset+1);let tail;
   if(absolute>0xffffffffffffffffn)tail={resolved:false,reason:'uint64-index-overflow'};
   else tail=fieldKernel.naturalTail({seed:candidate.state32,position:BigInt(consumed)+BigInt(offset-1),rows:context.rows,timeValue:scenario.timeValue,areaMask:scenario.areaMask,weightedReached:true},tables);
   const monsterId=tail.monster?Number(tail.monster.monsterId):null,target=tail.resolved&&monsterId!==null&&targets.has(monsterId);
   const key=JSON.stringify([tail.resolved,tail.tableId??null,monsterId,tail.reason??null]);
   if(!outcomes.has(key))outcomes.set(key,{resolved:tail.resolved,tableId:tail.tableId??null,monsterId,monsterName:tail.monster?.monsterName??null,reason:tail.reason??null,paths:0});
   outcomes.get(key).paths++;row.evaluatedPaths++;out.evaluations++;if(target)row.targetPaths++;if(!tail.resolved)row.unresolvedPaths++;
   if(out.evaluations%budget.chunkEvaluations===0)await yieldTask();
  }
  row.outcomes=[...outcomes.values()];row.complete=BigInt(row.evaluatedPaths)===paths;
  if(row.complete){out.fullyComparedOffsets++;row.agreement=row.unresolvedPaths?'unresolved':row.outcomes.length===1?'same-outcome':'different-outcomes';}
  else out.partialOffset=offset;
  out.rows.push(row);if(!row.complete)return out;
 }
 out.status='complete-materialized-subset';out.reason='保存済み候補×明記した消費範囲×現在のarea/timeの比較窓を処理しました。候補全体の確定ではありません';return out;
}
