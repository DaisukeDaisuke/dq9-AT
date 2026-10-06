// DST・RAM・ネイティブ時計はデバッグ専用です。本番は動画とROM、および保持された総当たり削減パラメータを用いて推定します。DST等から抽出したseed・actor・poseの正解値を、削減パラメータと称して本番へ渡してはいけません。
// Compatibility tombstone. DST/RAM/native-clock truth is a debug oracle only.
// Production must derive scene evidence from ROM/video and search unresolved AT.
// The preserved implementation lives outside the public web tree in
// debug/native-oracles/. No runtime switch, argument, or URL enables it here.
function unavailable(entrypoint) {
  const error = new Error(entrypoint + ': DEBUG_ORACLE_ONLY. '+"DST・RAM・ネイティブ時計はデバッグ専用です。本番は動画とROM、および保持された総当たり削減パラメータを用いて推定します。DST等から抽出したseed・actor・poseの正解値を、削減パラメータと称して本番へ渡してはいけません。");
  error.name = 'DebugOracleOnlyError';
  error.code = 'DEBUG_ORACLE_ONLY';
  error.entrypoint = entrypoint;
  throw error;
}
export async function nativeEntryInputSequenceHash() { return unavailable('nativeEntryInputSequenceHash'); }
export async function readNativeEntryDSTOrigin() { return unavailable('readNativeEntryDSTOrigin'); }
export async function createNativeEntryReplayProducer() { return unavailable('createNativeEntryReplayProducer'); }
