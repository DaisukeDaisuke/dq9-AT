// Durable production boundary. Debug truth is never a retained search parameter.
// ROM-derived geometry, video evidence and conditional search parameters remain
// permitted. Do not use the word "native" alone to reject ROM computations.
export const PRODUCTION_AT_INPUT_NOTICE='DST・メモリはデバッグ専用。本番入力は映像・ROM・総当たり削減用の保持パラメータのみ。メモリから得た正解を保持パラメータとして本番へ渡すことも禁止。';
const debugCommands=new Set(['replay','boot-trace','npc-continuation','npc-continuation-files']);
const debugEvents=new Set(['verified-boot-exec-prefix','map-entry-observation','npc-continuation-observation']);
const debugSchemas=new Set(['native-entry-execution-v1','native-DST-WRAM-origin-v1','source-bound-native-entry-replay-input-v1','dq9-at-observed-exec-series','dq9-nonspawn-actual-pairs','dq9-npc-replay-v1','dq9-npc-origin-v1','work5-external-clock-v1','work8-entry-observation-v1']);
const memoryIdentityKeys=new Set(['dstSHA256','dstSha256','mainRAMSHA256','originRAMSHA256','endRAMSHA256','originRamSha256','ramSha256','ramSHA256','ramHashes']);
const prohibited=detail=>{const error=Error(PRODUCTION_AT_INPUT_NOTICE+' '+detail);error.name='ProductionATInputPolicyError';throw error;};
// Inspect structured provenance, never filenames or a free-form "native" word.
// This cannot detect a human secretly retyping a RAM value without provenance;
// such relabelling is forbidden by the notice, not falsely claimed detectable.
export function assertProductionATInput(value){
 const stack=[value],seen=new WeakSet();
 while(stack.length){const row=stack.pop();if(!row||typeof row!=='object'||ArrayBuffer.isView(row)||row instanceof ArrayBuffer||seen.has(row))continue;seen.add(row);
  if(row.debugOnly===true||row.productionInputAllowed===false)prohibited('デバッグ結果は本番へ引き継げません。');
  if(debugSchemas.has(row.schema)||debugSchemas.has(row.format)||debugEvents.has(row.kind)||row.origin==='source-bound-native-local-window'||row.frameBasis==='resumed-emulator-frame-counter')prohibited('実測native trace・runtime snapshotは本番では受け付けません。');
  for(const key of Object.keys(row)){if(memoryIdentityKeys.has(key))prohibited('DST・RAM由来の識別情報を含む入力は本番では受け付けません。');const child=row[key];if(child&&typeof child==='object')stack.push(child);}
 }
 return value;
}
export function assertProductionATCommand(message){if(debugCommands.has(message?.type))prohibited('このtrace/snapshot操作は本番では使用できません。');return assertProductionATInput(message);}
