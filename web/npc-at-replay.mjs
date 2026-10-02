// Browser/Worker entrypoint for a known-origin conditional projection.
// Static ROM resources and dynamic origin remain separate. No ATSession access.
import {ACTOR_ROM_SHA256} from './actor-rom-mining.mjs';
import {projectNpcATContinuation} from './npc-at-continuation.mjs';

const need=(condition,message)=>{if(!condition)throw Error(message);};
export function createNpcReplayInput(origin,clocks,mined){
 need(mined?.schema==='dq9-actor-rom-mining-v1'&&mined.staticOnly===true,'ROMのみから抽出したactor-rom-data.jsonが必要です');
 need(mined.rom?.sha256===ACTOR_ROM_SHA256&&mined.rom.gameCode==='YDQJ'&&mined.rom.revision===0,'対応する日本語版ROMの抽出データではありません');
 need(origin?.schema==='dq9-npc-origin-v1'&&typeof origin.epoch==='string'&&origin.epoch.length>0,'開始状態origin.jsonが必要です');
 need(clocks?.schema==='work5-external-clock-v1'&&clocks.originFrame===origin.originFrame,'開始frameが一致する外部時計列が必要です');
 return {format:'dq9-npc-replay-v1',origin,clocks,rom:{sha256:mined.rom.sha256,gameCode:mined.rom.gameCode,revision:mined.rom.revision},resources:mined.predictionResources,expectedEpoch:origin.epoch};
}

export function replayNpcContinuation(input){
 need(input?.format==='dq9-npc-replay-v1','NPC継続replay形式ではありません');
 need(input.rom?.sha256===ACTOR_ROM_SHA256&&input.rom.gameCode==='YDQJ'&&input.rom.revision===0,'NPC継続replayのROM bindingが不一致です');
 const result=projectNpcATContinuation(input.origin,input.clocks,input.resources,{expectedEpoch:input.expectedEpoch});
 return {...result,sourceRomSha256:input.rom.sha256,sessionUnchanged:true,originHistoryProven:false,
  interpretation:'開始snapshotと外部時計列に条件付けた通常NPC継続予測。開始以前、他consumer、全世界のAT位置は未証明。'};
}

export async function replayNpcFiles(files){
 const specifications=[['origin',2*1024**2],['clocks',32*1024**2],['romData',256*1024**2]];
 const values=[];
 for(const [key,limit]of specifications){
  const file=files?.[key];need(file&&typeof file.text==='function'&&file.size>0&&file.size<=limit,`${key}のJSONファイルが必要です（上限${limit/1024**2}MiB）`);
  values.push(JSON.parse(await file.text()));
 }
 return replayNpcContinuation(createNpcReplayInput(...values));
}
