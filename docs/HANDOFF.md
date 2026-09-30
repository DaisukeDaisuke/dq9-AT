# 次工程への具体的指示

## 2026-09-30 現在の入口
`protocol.txt` → `docs/CONTINUATION_20260930.md` → `PLAN.md` の最新節を読む。Codespaceは指定 **fuzzy-goggles-r4vqvwgrw943p5r9** のみ。以下のP0/H01記述は2026-09-29の履歴であり、別CodespaceやPages設定待ちの指示は現在の作業先ではない。全静的ノード採掘と160消費の本番照合は完了。未完了は全field scheduler・映像自位置/3D認識・起動からの追加下限証明・人間移動最適化。最新根拠は `docs/observations/actual-*.json`、公開状態は `docs/DEPLOYMENT.md` の最新節を参照する。

## 入口
protocol.txtを最初に読む。PLAN.mdで未完了チェックポイントを確認。既存metadataはdocs/mining/map-metadata.json、実ROM本番WASM結果はdocs/observations/actual-map-wasm.json。通常画像268、特殊150、配置283は採掘済みであるため、同じ形式を再マイニングしない。
## P0公開
Codespace potential-fishstick-jjwvw95499j2p665:/workspaces/dq9-AT。GitHub CLIは通常login shell bash -lc内で既存認証を利用できる。初期Pages作成POSTは403。所有者のSettings > Pages > Source:GitHub Actionsを待つ。repo非公開設定を変更しない。準備済workflowはbuildとPages deployを分離。build/artifact成功とdeploy成功を別々に記録し、後者が成功するまでURLを稼働済み扱いしない。
## H01残り
scripts/field-observer.pscript.jsはreadonlyの永続MCP dq9FieldSnapshotを公開する。blocking:trueで呼ぶ。harness dq9-at-map-a7に登録済み。metaru_nasi.dstとmetaru_soubi.dstのload+1frame観測をdocs/observationsへ保存した。
両方map7402/parent7400、装備ありではmonster31/spawnTable30/spawnId1を1体観測。装備なしの+1frameではregion/tableがゼロ・monster slotなし。装備ありのregion index8はmask0で、既存二関数の条件だけではtable選択nullになる。これは呼び出し側fallback未確認のままの結果。map7402->table30と固定せず、FUN_0209db40のcallerでmask0時の経路をROMハーネスとGhidraで観測する。ロード後の初期化・休止画面も切り分ける。観測結果を捨てて都合のよいareaをでっち上げない。
状態ファイルは別時点である。AT値差を装備の効果や消費個数と断定しない。harness frameはレーンの累積カウンタでstate埋込frameではない。
## A01/A02
web/vendor/rand.jsを読み再利用。UpdateATのstate020EEE90はGhidra literalsで確認済み。seedは外部既知入力のみ。snapshotを起動からの下限証明の代用品にしない。boot経路の直前writer/caller実測を揃えて最小消費を証拠化する。未知分は候補集合として保持。未証明分をlower boundへ加算しない。
## V01以降
vendor/nds-font-converter内側nds-font-converter、font_akinator_webgpu.html、BattleArrow/BattleEmulator/public/vision.jsを必要箇所だけ読む。map画像のoriginPixel/scaleと実画面位置を校正する。PACの静的画像と動的宝の地図の探索状態を混同しない。3Dはapicula等既存資産を再利用しROM投入時に生成する。
## 許可・禁止
protocol最終指示はブラウザ操作を行わずデータマイニング/build/Actions公開に集中する。OBSはレイアウト/映像だけ。新規test fixture/suite/mock/CI test、sanitizer、一般QA、無関係refactorを作らない。ゲーム画像は../dq9-at-observationsにだけあり、repo/webに入れない。既存staged protocol.txtと.ideaを保持する。
