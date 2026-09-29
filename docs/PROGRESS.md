# 作業ログ
## C06 本番WASM・特殊パック追加後
2026-09-29T10:06Z: scripts/run-map-mining.mjs実ROM実行成功。1010構造レコード、283配置、268OBG+150PAC=418画像、画像/合成エラー0、438レコードに通常配置候補。採掘・全画像描画約1327.819ms（ローカルNode実行、ROM読込時間を含まない）。D04M02とmapt_001を画像として目視確認。ブラウザUI操作確認とは区別する。
GitHub認証はCodespaceの非login shellにはなく、通常login shell bash -lcでは既存認証が利用できることを確認。秘密値は取得・転送していない。Pagesサイトは未作成（GET404）。
## 追加通信（約10分ごとpull）
2026-09-29T10:03Z: protocol.txtより「chrome-devtoolsを今は有効化できないので、データマイニングとビルド確認、GitHub Actionsでのデプロイに専念」を受領。ブラウザ操作環境を新設せず、既存本番WASM実行とActions配信へ集中する。
## 2026-09-29 P0先行
- 開始: protocol.txtを読取。既存staged protocolと.ideaは保持。
- C01: NitroFS/GP2/typed call-streamを既存実装から再利用。許可済enc.json、map-name CSV、monster CSV、rand.jsをコピー。mapname/encounter表は再採掘していない。
- C02/C03: 実ROMからminimap.gp2の283 BMMP配置/268 OBG画像、minimapt.gp2の150PACを検出。maplist9は1010構造レコード。268 OBGは全て4bpp、ヘッダから求めた長さと実データ長が一致。
- G01/G02: Ghidraで実在関数を名前解決しbatch_decompile。BMMP opcode ABIとOBG loader、tile placementの単位を確定（静的）。例示のoverlay関数は触っていない。
- protocol pull追加受信: enc_jp.luaを読め、永続スクリプト可。元ファイルをscripts/enc_jp.reference.luaへコピー。モンスター48slots、spawn instance/table/coords、location->area-mask->time-filtered-table経路を確認。GUI投影係数は実測正解として採用しない。
- H01: metaru_nasi.dstを停止中に再ロード。map context 020fb11cの先頭u16=7402、直前map=7401、parent=7400。1frame進めてframe10117で停止。これは起動からのAT下限証明ではない。
- C04/C05: Worker採掘、map/descriptor/asset検索、出典/未確定areaの表示、JSON/CSV/PNG/元asset保存UIと実WASM tile compositorを実装。実行結果はdocs/observations/actual-map-wasm.jsonに保存する。
- C07: 専用Codespaceでclang18とlld18を用意しscripts/build.sh実行。ROM/stateは転送していない。
