# Inactive historical native source

These implementations are preserved as historical source only. They are outside the public web tree, have no production imports and provide no debug UI, switch or normal workflow. Further DST/native-state analysis is stopped. Existing frozen evidence is retained without alteration.

The old `web/` entrypoints unconditionally reject with `DEBUG_ORACLE_ONLY` before inspecting arguments. Do not deploy or connect this directory to production. The code bodies are unchanged apart from comments and relative import relocation.

## 恒久的な実装方針

DST・RAM・ネイティブ時計はデバッグ専用です。本番は動画とROM、および保持された総当たり削減パラメータを用いて推定します。DST等から抽出したseed・actor・poseの正解値を、削減パラメータと称して本番へ渡してはいけません。
既存コードは非稼働の履歴資料としてのみ保存します。
