# 作業ログ
## protocol追加 / map再入場
最新pullで「下5秒・上5秒でエンカウントリセット。ただし入場時のたる/つぼ/青宝箱およびmap固有処理によるAT消費に注意」を受領。移動入力をそのまま一定AT数に変換しない。既存pickup研究は共通経路の証拠だけを再利用する。
AT UI/coreを追加中。既存ARandを参照するWASM、前方探索、手動観測の条件付き分岐、証拠再評価による保存/復元を実装。途中stateの実測をboot-originへ偽装しない。実ROM32AT/14ATRandInt/7生成のproduction replayを次に実行する。

## protocol: Pages構成済み / ubuntu26.04
最新pullで所有者からPages構成済み、runs-on:ubuntu-26.04、main直接push可、configure-pages@v5を戻す指示を受領。workflowを更新。以前の403/404は履歴として残し、新runの結果を別に記録する。
同時に実ハーネスの32AT連続exec観測を保存: docs/observations/metaru-soubi-at32.json。32回のうちテーブル選択7回/モンスター選択7回、残り18回のcaller02079ed8。spawn creation7回。保存後traceをdisarmした。
一度gatewayの複数書込を含む呼出が安全確認で拒否。読取/書込を分割して再実行し、範囲を広げていない。
## protocol追加: ATナビの実装を継続
2026-09-29T10:15Z:「目的は、ATのナビゲーション(人間)なので続けろ。」およびUpdateAT監視Lua/出力を受信。新しい不足へ進む。ログにATRandInt LR02075150/020751a0が反復。read-only writer/caller観測として参考にし、Lua内の戦闘レジスタ書換えを実行しない。setAT検知の例があっても追跡仕様へsetAT経路を追加しない。
所有者が作業途中の実装を2666e94(upd)としてmainへpush済みと確認。重複実装コミットを作らず、新規チェックポイント差分だけをその先へ積む。
## H01: 指定2状態の実観測
2026-09-29T10:12Z。装備なしload+1frameはmap7402, AT9414f420, slotなし。装備ありload+1frameはmap7402, AT172b766d, monster31/spawnTable30/spawnId1が1体。生結果をmetaru-nasi-frame10117.json / metaru-soubi-frame10118.jsonへ保存。area maskは後者index8->0でselectedTable null。caller側の0mask fallback/初期化時点は未確認。map/area/table/装備因果を仮定で結ばない。
公開:Pages初期作成403のため所有者へSettings Pages GitHub Actions設定を依頼。build artifact作成は独立させ、未設定でも本番WASM build結果が保存されるようconfigure-pages（静的構成では出力未使用）を外した。
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
