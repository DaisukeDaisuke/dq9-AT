# DQ9 AT / 映像認識 日報 2026-10-06

## 00:30 JST — native背景・身体描画の接続と動画隣接フレーム

目標は全マップの動画再生中に、ROMに基づくモンスター種類の識別結果をAT探索へ接続すること。以下は局所実測と実装checkpointであり、全自動化完成ではない。

### 実ブラウザ

- 公開runtime e17f6f47で1ninnの227.250秒を通常の動画入力から自動比較。542残差を保持、既存3×3両寸法条件で451小断片を比較対象から外し、32領域を比較した。閾値・予算は変更していない。
- 領域196、箱(148,51,12,10)は条件付きメタルスライム候補1件。元動画画像の目視でも同じ箱に灰色の身体がある。gainは120595。種別・出生・AT消費の証明とは扱わない。
- この固定画像のRGBA SHA256は02e32a3df8cc09ff403c455734e0e7233a0af1d2db4b60d9bd714a0a11dadaa4。以前の227.000秒/領域239、227.012秒/領域233とは別の入力として保存した。
- 比較位置ずれ(-4,14)px、44856画素を比較、4296画素は未描画・半透明・画像外。RGB平均差13.659。霧位相と現行カメラの確定は残る。

### S04背景描画の実装

- 同名地図の固定表示点を主人公の実座標へ変換せず、S04の独立した未位置確定候補として保持する経路を実装。物理F02だけを同名地図の唯一候補としてキャッシュしない。
- ROM由来type4カメラ、分岐した床面、短い実パレット、初期clear色とalpha、透明fragmentのunknown扱いを接続中。既存成功入力・未対応の拒否を保存。
- S04のclip後の水平退化polygonが全体描画を拒否する問題を最小修正。nativeの通常edge walkで0 samplesになる条件を再現し、pose変更や閾値緩和はしていない。
- この修正はsource比較121入力、synthetic48 checksで確認。既存S04成功5候補のRGBA・mask・統計・診断は不変。D09の25 fragments、D04の26 polygon結果も保持した。
- 冷間処理の旧約390秒の全surface最終描画を標準経路にはせず、source-depth基底再利用と有限予算の経路へ変更中。実動画隣接入力では複数の通過背景が残るため、単一カメラ確定へ丸めない。

### モンスター身体

- SBC9 NODEMIXのsource整数演算とcache寿命を実装。実ARM96ケース・1799termsで位置12成分と方向9成分が一致。実assetの17命令・45termsでも非cache経路を確認。weight総和255を256へ正規化しない。
- BB/BBYは実ARM768ケースでpacket・matrix・restore/store・進行が一致。呼出し間templateの保持が必要であり、未知のlive flagsやcallback条件を初期値で埋めない。
- 正式状態の同一native drawでz019bの7個のNODEMIX packet、84成分が一致。実GPUの全framebuffer一致ではない。
- 元GXを保つnative身体描画ではF01のモーモン自身の支持が1200.000/1200.017秒の両方で正になった。ただしz000cの支持がより高く、単独の種類確定はできない。半透明の比較条件が不足する候補も保持する。
- 既存1ninn小メタル身体の2入力はnative経路でも正の支持を保持。F04の背景をギズモとする誤候補は、未証明の半透明合成・destination条件があり未解決。

### 継続中

- S04の有限予算経路、複数背景の共通/個別残差を公開経路へ統合し、実ブラウザで再検証する。
- 身体のsource-native支持を候補別に接続する。外観順位、未対応候補、ATのunknown/no-event枝を保持し、正のgainだけで確定しない。
- 霧のreload epochからsource描画stateへの接続と、実動画入場時刻との対応を続ける。歴史動画と正式保存状態のparty人数・実行履歴は異なり、同期を仮定しない。

ROM・SAV・RAM・動画・抽出ゲーム資産はGitに含めていない。公開反映とcheckpointのみのソースは区別して記録する。

### 霧のsource clock

- 実測reload epochから、実際に通過したMSE呼出しの描画前stateへ接続するadapterを追加。新規build後151呼出しのoffsetをROM規則から再構成し、388個の完全なnative frame境界で観測offsetと一致した。停止/未layerの戻りを描画回数に含めない。
- 4呼出しを既存整数描画に渡し、各60 polygons / 98304 fragmentsを処理した。これはrenderer実行確認であり、native framebuffer画素との一致確認ではない。
- 初期保存状態の保持済み61呼出しのphaseは未確定。実動画の復帰最初の可視frameは既にfade途中で、native reset/build/最初のupdateは画面から直接確定できない。動画時刻をnative frame数へ直結していない。

### Git保存と公開状態

- この時点の本番runtimeはe17f6f47。S04新経路、身体native helper、epoch adapterはcheckpoint段階で、本番動作確認済みとは扱わない。
- [背景checkpoint df1a44eb](https://github.com/DaisukeDaisuke/dq9-AT/commit/df1a44eb739a24ba7be421091c7090d04c6e5436)
- [身体matrix helper checkpoint 9154a597](https://github.com/DaisukeDaisuke/dq9-AT/commit/9154a5978395a63c392b3a4a019e895036d58160)
- [霧clock adapter checkpoint ea052076](https://github.com/DaisukeDaisuke/dq9-AT/commit/ea052076e931da8735b8bdda2afdb49a5a26ba93)
- [霧解析注釈](https://github.com/DaisukeDaisuke/dqix-functions/blob/89c15a7b03451362bca24ddca22f6366abc0337f/analysis/fog-observed-clock-20261005/epoch-render-clock-91b69fdb.md)
- 非公開headlessソースはdots-toolsのe3cdbfb8まで通常更新し、remote反映を確認。

## 02:18 JST — S04実ブラウザ一致、地図由来の誤った種類/AT接続の修正

### 公開済み経路の実測

- b68507b9でS04/type4/床/clear/clip修正を統合、a48d51f8で霧情報欠落をunknownに保持、ef76cd44で方向別キャッシュを修正。いずれも通常更新しremoteとPages成功を確認。
- クラウドブラウザで正式な長尺動画を2355秒へ移動し、ROMと動画以外に地図・XYZ・モデル・JSONを手入力せず自動照合した。背景はS04、ずれ(0,0)、43090画素比較/6062不明、RGB平均差8.203。元画像hashは前節の失敗入力から変えていない。
- 通過背景はyaw0/45/315の異なる3画像。最小残差のプレビューを表示するが、3枝と共通残差を保持し、単一の現行カメラ確定にはしていない。
- 次の実フレームで地図全体テンプレートを再利用したことは時系列記録で確認。文字からの地図探索を毎回やり直す条件を修正した。
- 一方、各方向が単一cacheを消し合う実装のため、方向を回るたび冷間探索へ戻っていた。方向・recordごとに独立保持へ修正。同じ固定画素を使う3方向のNode実測はcold61.951秒、warm6.943秒。これは動く動画全体や実GPUの速度保証ではない。
- 実再生の記録は欠測と保持上限によるevictionを含む。連続区間全体を検証済みとはせず、ブラウザの一時停止/DOM操作timeoutも未解決事項として保持した。

### 誤候補と地図由来の整合性

- S04の青い操作矢印付近をバブルスライム、足元/階段断片をみならいあくまとする旧条件付き予測を実ブラウザで確認した。入力を保持して原因を分けた。
- これらの旧body fitはS04背景に対して評価した一方、種類のencounter-table由来はF02だけだった。異なる地図の根拠を結合していたため、同じ背景枝とencounter originが対応するか検査するguardを追加。
- 旧順位・fit・species aliases・地図候補は削除しない。結び付かない予測をunboundとして保持し、種類の共同支持やAT検索には使わない。F02の未探索枝や未知のscripted spawnの可能性は否定しない。
- 保存済みS04の2旧予測からのAT検索は0件に。対応するF01モーモン/D04メタルの条件付き予測と既存WASM探索結果は維持した。low31条件付き件数は824115200/134152192、unknown/no-eventは無制約、AT証明下限は0のまま。
- located-onlyのmapCandidatesを別用途へ変えず、固定表示点・通過背景の地図仮説を別fieldとして既存timeline/entry/replay/ATへ運ぶ。3個のS04枝を落とさない。

### 身体比較と実行制御

- 元GX・source scale・source pose・枝ごとのcamera/backgroundを使うnative支持比較を、既存の外観比較後に追加。候補順位やgainだけで種類を確定しない。
- 全選択領域を1つの有限jobで扱い、未試行・半透明destination未対応・他のspawn routeを明示する。既存DINO bestPoseはsource poseの初期候補に使うが、参照サムネイルのpitchをゲームカメラへ代入しない。
- mode1/2のactor-owned fogを接続。実1ninn227.250のメタル自身の支持は+19998を保持。S04の旧2誤候補は3camera枝で試行範囲の自身gainが負だったが、未試行姿勢があるため不在や候補全体の否定にはしない。
- optional native応答待ち期限がDINOと共用するworker/cacheを破棄しないよう修正。遅延配信、古いcancel、ROM交換、通常の前進再生を区別。1500ms/128提案は協調的な処理目安で、同期処理の時間上限を保証しない。
- workerへ送るS04背景metadataは6.30MBから0.819MBへ必要項目だけ投影。全枝の画素・mask・fog入力・originsは保持し、元の詳しい記録は変更しない。実F01/S04の比較結果は投影前後で一致。

### CPU描画が操作を塞ぐ区間

- mode1と、同名候補F02のmode2に既存source polygon境界で処理を譲る経路を追加。元の同期APIを同じgenerator本体の比較基準として残す。
- 親の統合stageでも3個のS04 camera出力とF02のlight0/light1/保存済みforward出力を比較。画素・depth・mask・診断が完全一致し、計算中にevent loopが進むことを確認。
- F02は旧同期呼出し約2.5–2.8秒に対し、統合版の測定区間最大約90–103ms、S04は約120–143msだった。Nodeでの観測であり、全処理の高速化やブラウザの応答時間上限ではない。
- 旧jobがyield中に新しいframe/ROMへ置き換わるケースも、旧jobはAbortErrorとなり新結果・共有cacheを壊さなかった。

### 保留と公開確認

- この節のnative-body/整合性guard/協調処理の統合版は、公開後にブラウザでも確認する。上記の統合stage検証を公開ブラウザ成功へ拡張しない。
- 診断用WebGPU rasterは別checkpointに保存。CPU fallbackとhost契約は検証したが、WGSL実コンパイル・device dispatch・速度は未検証なので、本番有効化には含めていない。対象は保存計測の0.762秒部分で、主な再投影10.30秒をGPU化したとは扱わない。
- 全マップの種類識別、F04の背景誤候補、半透明actor合成、動画の入場時刻と霧epochの同期、出生/AT消費の特定は継続中。

## 02:53 JST — 統合版の公開ブラウザ確認

- main `df40cb04`、Pages run `37348015351` の成功後、クラウドブラウザで `native-body-20261006-0212` を確認。正式ROM・動画をUIから読み込み、以下を自動解析した。時刻への移動は同一入力の再検証用で、地図・XYZ・モデル・JSONは入力していない。
- 長尺2355秒：前回と同じゲーム画素hash、S04の43090比較/6062不明、平均差8.203を保持。旧region127/281のgain28747/4750は保持し、別地図由来の共同種類予測だけがunboundになった。AT証明下限0。
- 長尺1200秒：同じ画素で268残差/22比較、モーモンの既存条件付き予測とgain642158を保持。追加native比較の参照姿勢先頭1提案は−820076。網羅した姿勢の正支持と混同せず、有限subsetの負値を真の身体の排除に使っていない。
- 1ninn227.250秒：542残差/32比較、メタルの既存条件付き予測とgain120595を保持。ただし公開ブラウザのnative側は予算切れで当該候補0提案だった。前進した227.279秒でも0提案。Node単独の+19998をこの公開実行で得たとは扱わない。後方候補の処理公平性を追跡中。
- この短い再生では2観測/95欠測区間を保持した。pause操作のCDP待ちが期限切れになり、実際には235.727秒で停止していた。全フレーム処理や操作応答時間の保証はできていない。
- 長尺4200秒：ゲーム画素は旧固定入力と同一。現在のsource床/カメラ候補では48705比較/447不明、平均差12.557、ずれ(−1,+1)、49残差/10比較。ギズモの条件付き予測は3件。うちregion25は映像の灰色の物体を含むため、旧7件の背景誤候補と同一の失敗とは扱わない。種類・身体の確定は未完。旧背景と旧7失敗も固定のまま保存した。
- sourceの±25 XYZ lifetime条件は366合成nativeケースと12正式状態観測で一致したが、旧F04の104個のsource配置は範囲内で、誤候補修正にならなかった。追加metadataの[ソースcheckpoint](https://github.com/DaisukeDaisuke/dq9-AT/commit/657669d6201a7765a82857dbeb6e33a71281c066)のみ保存し、本番の候補排除には導入していない。

半透明身体のsource destination/order、予算内の公平な比較、霧の実動画同期、全マップの種類識別からAT確定までの接続は継続中。上記の個別検証を全自動化の完成とは認定しない。
