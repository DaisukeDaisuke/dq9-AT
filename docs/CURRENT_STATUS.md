# DQ9 AT 現在のチェックポイント

更新: 2026-10-02 JST（2026-10-01 UTC）。ワークスペース復旧後の状態を記録する。過去の計測値、現在実行できた検査、未検証の接続を区別する。

## 目標と完成条件

目標は、観測と根拠からAT状態の候補を維持・同定し、メタル系の連続ポップに向けて人間へ移動を案内し、次の観測で継続更新すること。既知initial seedを使う追跡、条件付き探索、ROM由来再現、映像認識はその手段であり、必要なら交換できる。

各機能の成功だけでは完成としない。観測の出自、同一個体の重複、未探索区間、未知の消費、map/位置の別候補を保ったまま、AT候補→未来比較→実行可能な移動案内→再観測がつながることが必要。

## ソースと復旧境界

- 復旧元: `adc4c9aca5928496c31752a7fa49fddde13e9e92`。動画EOFからの明示的・中止可能な巻き戻し修正まで含む
- 最新push済みソース: `6be287bb1d37ac986fe41df61f0b80cedc477ea1`。自動map座標候補をplayer trajectory/exportへ渡す6ファイルの修正。exact-SHAのCI build/deploy成功（[run36888596374](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36888596374)）。配信成功は実ROM/動画の動作確認とは別
- 2026-10-01 15:35 UTCのワークスペース置換で、未公開のcreator最終編集、private runtime入力、実行中の研究用capture、ブラウザ状態を失った。残った説明から推測して「復旧・再検証済み」とはしない
- ソース、解析ツール、保存データは復旧。エミュレータは7件全ての元asset hashが変更していないlockと一致し、ROMなしnative smoke（shared memory、4 workers）は通過。Ghidraは合成ARM/Thumb確認まで通過。これはDQ9実ROM再現の成功ではない
- 2026-10-02 07:42 JST（2026-10-01 22:42 UTC）にROM、動画4本、チェックポイントを復旧。`dq9_new2.nds`（268,435,456 bytes）のSHA-256は `3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7` と一致。新しい実ROM観測と実動画検証を再開した。旧raw RAM・runtime・観測captureは未復旧で、復旧したチェックポイントをそれらの代替証拠にしない

この文書にはROM、保存データ、private入力、RAM、映像、抽出ゲームアセットを含めない。配布済みソース・解析メタデータと私有の再実行入力を混同しない。

## 実装済みの範囲と、まだ越えていない境界

### 1. Map・位置候補

静的map/graph/area/table採掘、ROMフォントによる名前候補、map画像との登録、マーカーからの座標候補、獲得済み画像だけを比較する軽量追跡がある。map別名、未比較画像、marker/party slot、登録peak、固定表示anchorを保持する。

`6be287b`では、同じcaptureの自動取得・追跡結果がplayer sampleの完了前に合流し、`partyCoordinates`としてtrajectory/exportと座標panelへ渡る。manual replyの順序、同一frame再取得、失敗/取消、古いreply、可変オブジェクト共有を扱う。これは欠けていた配線の修正であり、座標式の新規確定や唯一のmap/leader選択ではない。

新しい実映像での位置精度は未測定。固定minimap anchorを物理位置に変換せず、画像候補を確定したlive座標に昇格しない。

根拠: [MAP_TRACKING_FAST_PATH.md](MAP_TRACKING_FAST_PATH.md)、[VIDEO_CAPTURE_IDENTITY.md](VIDEO_CAPTURE_IDENTITY.md)、[player-capture.mjs](../web/player-capture.mjs)、[player-position.mjs](../web/player-position.mjs)、[video-panel.mjs](../web/video-panel.mjs)

### 2. Monsterの候補領域・分類・動画観測

既存の高速分類器に、`shrine-blue-v1`限定のCPU ROI候補と任意DINO patch補完を接続済み。補完と動画observerの対応範囲は既定のshrine 4モデルであり、全map認識ではない。分類器はrank/unknownを返し、校正済みの敵判定ではない。動画のopt-in observerは1実行中推論＋最新snapshotのみを保持し、最大4件の過去crop/rankを表示する。手動開始、取消、seek/source/ROM変更、EOF等を扱う。

過去の限定計測ではCPUが18対象中11、補完後14をcoverし、別の選択済み窓は6中2→4だった。一方、negativeにも最大8候補が出る。動画observerの事後30crop監査はbodyあり5、背景/UI23、曖昧2。これらは既知・反復閲覧データの開発記録であり、汎用精度やfreshな独立評価ではない。

最初の実ブラウザ動画runは動き、EOFまで停止した。EOF後の再開不具合を`adc4c9`で修正し、復旧後のCPU/WASM実ブラウザで自然EOF→Start一回の巻き戻し・分類再開→明示Stopを再確認した。rankはunknownを残し、出生・native個体ID・世界位置・AT消費を確定しない。追加のjoint detector学習は現在の前提にしない。

根拠: [MONSTER_POSITION_PROPOSALS_20261001.md](MONSTER_POSITION_PROPOSALS_20261001.md)、[MONSTER_DENSE_SUPPLEMENT_20261001.md](MONSTER_DENSE_SUPPLEMENT_20261001.md)、[MONSTER_VIDEO_OBSERVER_20261001.md](MONSTER_VIDEO_OBSERVER_20261001.md)

### 3. AT候補探索と条件付き再現

既知seedからの追跡、証明済み下限と仮説の分離、手入力table/speciesの条件付き探索、known-origin/terminal-index探索がある。予算停止・未探索suffix・別経路を残す。目視やrankだけで下限を増やさない。

ROMのgraph/table/terrainと明示的runtime・trajectoryを使うscheduler/creator/actor継続も実装済みだが、条件付きの対応範囲で停止する。現在のF06経路は134 calls / `0xa46fab4f`、条件付きhero XYZ `[-16220,9420,-137818]`、node24/table20/species88の選択まで。timer1019でcreator結果の前に止まる。候補地点は生成後接地位置ではなく、観測/live座標は未確定。

別の歴史的shrine継続は343 calls、controller return1812までの完成prefixを記録する。134と343は異なる経路・入力の境界であり、現在の到達点の大小比較に使わない。後続1814 captureの部分controllerを完成frameとして進めない。

失われた未公開creator研究にはsource-carriedな生成射影の報告があるが、最終parser/allocation/heap/scale変更をすべて再検査した証拠はない。公開実装の停止境界を越えた完成物として扱わず、復旧したROMとSAVから元条件を再構成・照合する。

根拠: [AT_TRACKING.md](AT_TRACKING.md)、[CONDITIONAL_AT_SEARCH.md](CONDITIONAL_AT_SEARCH.md)、[TERMINAL_INDEX_SEARCH.md](TERMINAL_INDEX_SEARCH.md)、[FIRST_SPAWN_REPLAY.md](mining/FIRST_SPAWN_REPLAY.md)、[f06-continuation.mjs](../web/f06-continuation.mjs)

### 4. AT同定・ナビまでの未接続部分

- 映像のrank/trackを、実際の種抽選と同一lifetimeに根拠付きで結び付けること。同じ個体の反復観測を別抽選にしない
- 観測間の未知消費・map遷移・既存個体・失敗生成等を残して、現在映像までAT候補を進めること
- 対応creator/scheduler以降の未対応branchと、視点/表示pipelineを含む照合。現在の部分再現を全world/frame再現としない
- 自位置候補とAT候補を使った未来比較、通行可能な人間の移動案内、実行後の再計画。敵graphを人間用walkmeshとみなさない

特にshrineの4種を全て候補に残すrank一覧は、table30の32768 weighted出力全域を覆うため、それだけではATを区別しない。復旧後、既存[enc.json](../web/data/enc.json)と本番[monsterForRandom](../web/at-core.mjs)で全32768入力を列挙し、4種で全件を覆い未解決0であることを再確認した。分類の順位改善とAT情報量の増加は別に確認する。

## 検証台帳

- 復旧後に実行済み: `6be287b`のcapture403 checks、range UI12、registration147、marker modes60、既存aggregate `scripts/build.sh` exit0。source/synthetic/Node検査の通過であり、fresh ROM/video精度の検証ではない
- 置換前の報告: `adc4c9`のpage167/controller24とaggregate、正確なSHAの2 workflow成功。実ブラウザEOF再開は復旧後のCPU/WASM経路で確認済み
- 公開文書に残る過去の実ROM採掘: 151 graphs / 3934 nodes / 6044 edges、26/47-node RAM照合、160 AT updates / 95整数戻り値 / 16生成入力。再取得した新しい測定とは呼ばない
- 失われた私有captureを必要とするcreator、native↔表示個体対応、実動画精度は再現未完了。テスト件数を代わりの証拠にしない

ソース確認の入口: [build.sh](../scripts/build.sh)、[check-video-panel-capture.mjs](../scripts/check-video-panel-capture.mjs)、[test-f06-hero-motion.mjs](../scripts/test-f06-hero-motion.mjs)、[test-monster-video-observer.mjs](../scripts/test-monster-video-observer.mjs)。ハッシュ固定のWASMやemulatorアセットのguardは緩めない。

## 次の小さいチェックポイント

1. **復旧した実入力で既存接続を再検証**: 復旧ROMと動画で新しい再現・検査を実行。動画observerのEOF→Start/Stop、player自動座標→同captureのtrajectory/exportを実ブラウザで再検査。WebGPU adapter取得不可を確認。CPU/WASMの実分類、自然EOFからStart一回で巻き戻し再開、明示Stopを実ブラウザで確認済み。自位置精度・AT候補更新は引き続き未検証。起動、backend、入力版、出力、未検証点を分けて残す
2. **creatorの停止境界を1つ進める**: 元の到達経路と必要runtimeを再取得し、resource identity、allocation/link、template/component、地形/scaleの根拠を確保。scheduler/creator return直後までを照合し、その後の同pass hero/bodyとは分けて完成判定する
3. **観測がATを絞る最小例を通す**: 元capture時刻とlifetimeの重複を保った少数観測で、条件付き候補が何によって減ったかを示す。背景rank、既存個体、unknownも残す。方法は固定しない
4. **移動案内へ接続**: 自位置とATの残存候補で未来を比較し、実行可能性が確認できた移動だけを案内。再観測で予測との差と候補更新を記録する

各チェックポイントの保存内容は、使用したsource SHA、入力の所在/版（private入力は非公開）、実行方法、期待/実際、停止理由、次に必要な入力。再開時に説明だけで完了扱いせず、得られた証拠の範囲をここへ追記する。

復元日報: [2026-10-02](DAILY_REPORT_RECONSTRUCTED_20261002.md)
