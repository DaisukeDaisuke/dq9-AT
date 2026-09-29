# dq9-AT 実装計画
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
|C07c|P0|GitHub Pages公開、HTTP/wasm取得確認|docs/DEPLOYMENT.md|初期Pages作成APIが403。所有者のPages設定が必要|
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
