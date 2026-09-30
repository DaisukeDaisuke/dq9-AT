# dq9-AT 実装計画

## 現在地（2026-09-30 / dq9at-0930-nodes）
全体目的Xは変更しない。詳細チェックポイントは `docs/CONTINUATION_20260930.md`。以下より後の2026-09-29節は履歴。

- 静的全経路: path.gp2の151/151グラフ、3,934ノード、6,044接続を投入NDSから採掘。26ノードのふういんのほこらと47ノードのエラフィタは実RAMとID・座標・area・接続順まで一致。151 maprecordを結合し859件は未結合/動的として残す。
- area/table: encfldの不足していたmap→table参照のみを取得（210map/287参照）。既存enc.jsonの出現分布は再採掘しない。map20003のarea1/time0→6、area1/time2→4、area2→7を実測表と照合。table276..279は既存データ不足として明示。
- AT: 指定Codespaceで統合WASMをビルド。装備あり32＋装備なし128＝160消費、95ATRandInt、16生成関数入力を本番経路で照合し差0。実際のbranch到達を与えたtable→weightedの16件も一致。フレーム進行・失敗試行・占有状態まで再現したという意味ではない。
- UI: 全経路選択、座標/area/隣接順、JSON/CSV、エリアと時間に従う複数table候補、条件付き2消費の将来メタル候補を接続。メタル5種を既存IDから取得し、名称の(normal)/(通常)で欠落する問題を修正。
- 映像: 既存camera取得とWebGPU scorerを再利用し、ROI選択、上画面プレビュー、ROMフォント生成、マップ名候補、映像観測ログを実装。実ROMで4サイズ2588字形、99名称434テンプレートを生成。GPU/実映像精度は未測定、候補からAT下限を自動加算しない。
- 未完了: 動的グラフ、起動から映像だけで下限を進める証拠、自位置・3D monster認識、field scheduler、通行可能性を持つ人間用ナビ最適化。全ナビ完成とは表示しない。
- 配備: fuzzy-goggles-r4vqvwgrw943p5r9のみ使用。最終ディレクトリ同期・push・公開はR07へ実結果を記録する。


## 現在地（2026-09-29 10:37 UTC / 作業継続中）
- P0採掘: 実ROM1010マップ構造、268通常画像+150特殊画像=418画像、283配置合成を本番WASMで実行、エラー0。静的配置未結合572レコードも欠落させず表示。
- P0公開: commit d9ee0b52b1b3500bef70b224ec327d1b54ee40f4、Actions run36556131763がbuild/deployとも成功。Ubuntu26.04/configure-pages@v5。公開 https://daisukedaisuke.github.io/dq9-AT/ 。HTTPと配布WASMの取得を確認中。以前のPages403/404は解消。
- A01実装: 既存ARand参照+WASM skipahead/前方探索、既知seed入力、証明済み下限と観測条件付き下限の分離、未探索suffix保持、追跡保存/証拠再評価による復元、既存encによる対象weighted乱数位置を実装。初回combinedWASM build・実測replayへ進行中。まだライブナビ完成ではない。
- A02実測: 指定装備ありstateで32連続UpdateAT、14ATRandInt、7生成を保存。18消費はmonster移動先選択02079ed8、7はtable選択、7はmonster選択。途中state起点でありboot下限証明には使わない。docs/observations/metaru-soubi-at32.json。
- N00採掘: map7402の実RAMに26ノードのmonster移動/spawn候補graphを確認。ROM側loaderをGhidraで追跡中。敵graphをそのまま人間用walkmeshと断定しない。
- 次の実作業: combinedWASM本番replay→AT UI公開、ROMから全mapのspawn graph/area/table候補を取得、起動proof producerと位置/方向案内へ接続。カメラ/文字/3D認識は未接続。
- protocol追記: 下5秒→上5秒でstateのencounter reset可能。ただしmap入場時のたる/つぼ/青宝箱/map固有AT消費を無視しない。新規tests/sanitizer/ブラウザ操作は行わない。約10分pull継続。

更新: 2026-09-29 / 担当 isolation dq9-at-map-20260929-a7
## X
既知initial AT seedから証明可能な下限と候補集合を維持し、全map/areaと映像を統合して人間へメタル系連続ポップの移動を案内する。今回の先行成果はNDS投入でmapメタデータ・上画面マップを採掘できるWebアプリ。未実装の追跡・認識・最速性を完了と表示しない。
## 優先度とチェックポイント
|ID|優先|完了条件|成果物|状態|
|---|---|---|---|---|
|C00|P0|protocolを読み、既存変更を維持して作業範囲を確定|PLAN.md, DECISIONS.md|完了|
|C01|P0|必要な既存parser/CSV/JSONの所在と形式を確認・コピー|docs/ASSETS.md, web/data, web/vendor|完了|
|C02|P0|投入ROMのFNT/FATからmap関連ファイルを列挙し由来を保存|scripts/inspect-rom.mjs, docs/mining|完了|
|C03|P0|GP2内の上画面map構成・画像形式を特定|docs/mining/MAP_FORMAT.md, PAC_FORMAT.md|完了: OBG/BMMP/PAC|
|C04|P0|全map構造の一覧・検索・未確定area・元ROMパスをHTML表示|web/index.html, web/app.mjs|実装済。protocol指示でブラウザ操作確認は未実施|
|C05|P0|選択map画像を投入ROMから展開・描画・保存できる|web/map-core.mjs, WASM|418画像/283合成は実ROM確認済。ブラウザ保存操作は未確認|
|C06|P0|実ROMで本番マイニング/WASMを実行し成功/非対応件数を保存|docs/observations/actual-map-wasm.json|完了:1010構造、418画像、283合成、失敗0。通常配置未結合572構造を保持|
|C07a|P0|Codespaceへソースだけ転送してWASM build|scripts/build.sh|完了:clang18/lld18、1606bytes|
|C07b|P0|GitHubへ実装push、Actions buildとartifact作成|.github/workflows/pages.yml|着手|
|C07c|P0|GitHub Pages公開、HTTP/wasm取得確認|docs/DEPLOYMENT.md|完了:run36556131763成功、HTTP200と配布WASM取得/Module生成確認|
|G01|P0並行|Ghidraでmap resource/area table選択の入口・正式関数名を取得|docs/ghidra|完了:現在のmap/area採掘範囲|
|G02|P0並行|不足関数をbatch_decompileし生の結果と解釈を分離保存|docs/ghidra|完了:static根拠を実測と分離|
|H01|P1|ふういんのほこら1Fの装備なし/ありを既存ハーネスで観測、map/area/ATを記録|scripts/field-observer.pscript.js, docs/observations|着手:永続読取handler実行済。area/tableの有効値は未確認|
|A01|P1|既存rand.jsを再利用し既知initial seedと証明ログ/候補集合を実装|AT core|未着手|
|A02|P1|起動からmap移動までのAT最小消費証拠を実測、未証明分を候補へ保持|AT evidence|未着手|
|V01|P2|既存font converter/vision/WebGPUを統合しmap/areaと自位置を取得|video pipeline|未着手|
|V02|P2|投入ROMからmodel/textureを取得し3D monster観測に利用|monster recognition|未着手|
|N01|P3|候補集合で未来比較、上画面に人間向け移動案内、継続更新|navigator|未着手|
## 実行規律
protocol.txtは利用者所有のpull通信。作業中約10分ごと・build/公開前・終了前に再読し、変更をdocs/PROGRESS.mdへ記録する。上書きしない。観測/決定/未解決を逐次ファイル保存し、コンテキストだけに置かない。
enc.json/map-id-names.csv/monster CSVを再マイニングしない。既存parserを確認して再利用。ROM/state/ゲーム画像/font/modelを公開物へ入れない。公開はweb成果物と許可済metadataのみ。
OBS MCPはレイアウト/映像確認専用。ROM実測は既存DeSmuMEハーネス。Ghidra静的読解と実測を混同しない。例示関数FUN_overlay_d_03__0217d3b8は解析しない。
新規unit/integration/regression等テスト基盤、sanitizer、一般品質保証、無関係refactorを作らない。必要確認は実ROM/既存WebAssembly/既存ハーネスの実行による。


## C3 03:07 UTC — protocol-driven next checkpoints

Interim: docs/INTERIM_C3_20260930.md. Prior pending merge/push is complete (bb46573/Actions36660635552). New clock/scheduler/candidate code is local pending final folder synchronization. Actual257AT/163integer/19creation and501scheduler/24clock matches recorded.

- P0 continuation: preserve proven lower bound and candidate uncertainty across all map transitions; explicitly account for NPC, pots/barrels, entry initialization and unknown consumers instead of assuming0 or resetting.
- P1 analysis: reuse relevant LocalAI/fountain knowledge; observe UpdateAT callers and distinguish proven common logic from pickup-only assumptions.
- P1 navigation: measured upper-map localization and map/area state; do not equate the monster graph with human walkability.
- P0 delivery: synchronize entire source directories and build outputs with fuzzy-goggles-r4vqvwgrw943p5r9 before final push; preserve histories.

Single-map reproduction and writing this plan are checkpoints, not completion of X. No new tests or generalQA are added.


## C3 consolidated checkpoint (2026-09-30)

Actual execution: 303 AT updates / 175 ATRandInt returns / 25 creation entries, mismatch0. Scheduler501 complete calls/4053rows, actual elapsed writer24pairs; nonspawn paired writer replay results are in actual-world-consumer-replay.json. Actual map registration also saved, image coordinates only.

Implemented: production timer/control scheduler, elapsed clamp/division, ordered nonspawn initialization arithmetic, multi-table observation union, explicit unresolved-consumer intervals across map contexts, candidate/save-restore, dedicated upper-map registration worker. Existing map mining remains151graphs3934nodes6044connections/418images283compositions. Reused enc.json/CSV unchanged.

P0: final source snapshot/directory parity and Codespace main push; build only fuzzy-goggles-r4vqvwgrw943p5r9. Existing prior-stage publish bb46573 already succeeded; new-stage publication must be verified separately.
P1 next evidence gap: autonomously enumerate actual NPC/container/map-entry consumers and their ordering rather than treating event-input replay as an autonomous world simulator. Stornway container loot has NOT been measured; pickup materialization is not automatically pot/barrel loot.
P1 navigation: player-arrow detection + image/world transform and human passability, 3D monster matching, complete boot evidence capture; currently image registration/candidates do not guarantee earliest navigation. Keep all-map lower-bound continuity and open tail, no map resets.

Complete navigator X remains unfinished; this checkpoint is not a claim of all-map/frame/boot/vision completion.


## C3 live protocol update at03:34 UTC
User supplied root sennto.dst, immediately before entering enemy-free Stornway town exterior. Read immediately before planned push; source parity correctly detected only protocol.txt changed. Publication of source02 is held while incorporating this new direct all-map consumer observation, then a fresh whole-folder snapshot will be synchronized. Source02 build/replay succeeded but is not a completed publish. Do not misclassify this live user update as transfer corruption.
