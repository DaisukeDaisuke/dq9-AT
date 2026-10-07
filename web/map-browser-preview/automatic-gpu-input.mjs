/* SPDX-License-Identifier: GPL-2.0-or-later
 * Adapter for one already selected automatic background, never a new search.
 */
import {automaticBillboardScenes} from './automatic-billboard-scene.mjs';
import {applyAutomaticMaterialEnvironment} from './automatic-material-environment.mjs?v=native-body-20261006-0212';
import {prepareInitialMode1IntegerCompute} from './prepare-initial-integer-compute.mjs?v=source-reuse-interruption-20261007-0204';
import {createSourcePreparationCache} from './integer/source-preparation-cache.mjs?v=automatic-playback-source-cache-20261006-1100';

export function automaticGpuBinding(result, frameEvidence) {
 const s=result.selected;
 return {frame:frameEvidence,mapCandidates:result.diagnostics?.locatedCandidates??[],selected:s?{recordKey:s.record.key,mapId:s.record.mapId,descriptor:s.reference.path,point:s.point,phase:s.row.phase,backend:s.row.backend}:null,mapIdentityCertified:false,currentEnvironmentCertified:false,minimumProvenATCalls:0};
}
export function prepareAutomaticGpuInput({project,rom,result}, dependencies={}) {
 const s=result.selected;
 if(!s)return {ready:false,reason:'自動探索は描画可能な背景を取得できませんでした。地図・座標候補と各背景の未対応理由を保持しています。',backgroundCandidates:result.diagnostics?.backgroundCandidates??[]};
 if(s.row.phase)return {ready:false,reason:'選択済み背景には画面効果の位相候補があります。このGPU経路は画面効果のpolygonをまだ扱えないため、効果なしへ勝手に置換しません。'};
 const sourceCache=(dependencies.createCache??createSourcePreparationCache)(project);
 const active=(dependencies.activeScene??((p,r,a,c)=>applyAutomaticMaterialEnvironment(p,r,automaticBillboardScenes(p,a,c.viewFx))))(sourceCache.project,s.record,s.scene.automatic,s.camera);
 if(active.environment?.mode===2)return {ready:false,reason:'選択済み地図の環境mode '+active.environment?.mode+' は現在の時間・selectorが未解決です。既存mode2 GPU描画にはROM slot仮説が必要ですが、動画時刻をゲーム時刻へ置換したりslot 0を固定採用したりしません。'};
 if(!active.environmentApplied)return {ready:false,reason:'ROM材質環境が未解決: '+(active.environment?.unresolved??[]).join('; ')};
 if(!s.integer?.ready)return {ready:false,reason:'同じ背景候補のCPU整数経路が未対応: '+(s.integer?.reason??'unknown')};
 const job=(dependencies.prepare??prepareInitialMode1IntegerCompute)(sourceCache.project,rom,s.record,active,s.camera,{applyFog:true});
 job.evidence.automaticSourceCache={...sourceCache.stats};
 return {ready:true,job,cpu:s.integer,scope:'Same selected source mode1 hypothesis; no extra position, time, slot, phase or model hypotheses.'};
}
export function compareAutomaticGpuPixels(cpu,gpu) {
 if(cpu.width!==gpu.width||cpu.height!==gpu.height||cpu.rgba.length!==gpu.rgba.length)throw Error('CPU/GPU画像の寸法が一致しません');
 const different=[0,0,0,0];let pixels=0;const first=[];
 for(let p=0;p<cpu.rgba.length/4;p++){let differs=false;for(let c=0;c<4;c++)if(cpu.rgba[p*4+c]!==gpu.rgba[p*4+c]){different[c]++;differs=true;}if(differs){pixels++;if(first.length<16)first.push({x:p%cpu.width,y:Math.floor(p/cpu.width),cpu:Array.from(cpu.rgba.subarray(p*4,p*4+4)),gpu:Array.from(gpu.rgba.subarray(p*4,p*4+4))});}}
 return {equal:pixels===0,differentPixels:pixels,differentRGBA:different,first,scope:'RGBA display bytes only. This is not 8-field parity, video/native parity, or an all-input proof.'};
}
