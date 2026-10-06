## 2026-10-06 13:19 JST — 誤りの明記と用途の訂正

DST・メモリから取り出したseedや内部状態をreplayへ渡す実装を、本番の映像認識・ATナビ完成に向けた進捗として扱ったのは、dotの間違いでした。ユーザーが本番入力を変更したのではありません。

「マップ入場時のAT消費にはDSTが必要では」という発言は、「マップ入場時に発生するAT消費をデバッグするためにDSTが必要」という意味でした。dotがその用途を確認せず、本番向けの入力経路へ広げたことが逸脱の原因です。DSTによるデバッグの一致は、映像からモンスターやAT状態を自動特定できた証拠にはなりません。

本来の目的は、映像からマップ・視点を特定してROMから背景を描画し、映像差分からモンスター枠を特定、enc.jsonによる分類・移動追跡の観測をAT総当たりに渡すコードの実装です。本番ではDST・メモリ由来の正解を受け付けず、その値を「保持パラメータ」と呼び換えて使うこともしません。

一時的な概念実証・テストでの手動入力は許可されていますが、本番の全自動化とは区別します。過去のDST実測値はデバッグ記録として保持し、本番の完成実績には数えません。禁止と用途の区別は日報だけでなく、DST読込コード・入力境界・UIにも残します。

# Scope correction — 2026-10-06 13:06 JST

The native DST/WRAM entry replay and observed-memory clock/pose work below is debugging evidence only. Treating it as progress toward video-driven production identification was incorrect. It does not establish the requested workflow.

Production inputs are video, ROM, and retained parameters that reduce brute-force search. Extracted emulator state, actor identities, camera/pose, RNG seeds or observed AT traces must not be supplied as production truth or disguised as retained parameters. DST/native memory may be used only as a separate debugging oracle.

The intended production pipeline remains: infer map/view from video, render ROM background, identify monster body regions from video differences, classify and track observed monsters, then feed those observations into AT brute-force search. ROM-derived geometry and video-derived conditional hypotheses remain valid. Historical measurements below are retained without upgrading them into production capability.

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

## 03:34 JST — 未到達候補の継続、移動中の位置候補、身体半透明、画素時刻

### native身体比較が同じ先頭だけで終わる問題

- 公開版の実1ninn227.250/227.279秒では128個の領域・モデル対のうち58/60対までで終了し、次回も先頭から始まっていた。真のメタルの対はどちらも未試行だった。
- 同一の固定画素・背景・環境・候補・姿勢ヒントを照合した継続tokenを使い、対/提案のcursorを維持する最小変更を統合。1500ms/128 work unitsは各sliceで維持し、比較レーンを解放後のidle継続でまず全対の初回結果まで進める。新しい外観要求が来れば古い継続を譲り、frame/ROM/epochが違う結果を流用しない。
- 親の統合版で同じ227.250画素を再実行し、55→128対に到達（約1513/1469ms）。127対を描画、1対は明示的な配置不明。メタルの先頭native姿勢は−550266のまま。既存+120595の条件付き予測、順位、旧fit、unknown/AT項目は保持した。
- 固定50/50/28分割は旧一括128提案と、提案・gain・scale・由来・姿勢順序が一致。入力変更13ケース、取消し、古いtoken、新外観優先、保存済みPTS表示などを検証。全対の初回処理は、全姿勢や全cameraの探索完了ではない。

### F04で移動後に背景が途切れる問題

- 旧公開版のcallback表示4205.717秒では、地図登録とslot1 HUDの灰色は確認できていたが、13個の点候補がありprimaryCandidateの一意性で描画前に止まっていた。aggregateのsource-stripes-unavailableはslot2–4についての失敗で、slot1確認まで否定するものではなかった。
- 同じ既存条件を満たす物理座標の候補を、別の有限背景仮説として比較へ渡す。primaryCandidateはnullのまま。13候補を保持し、対応COL2がない12候補も「playerではない」と排除しない。128枝/30秒は枝間で確認し、未試行も記録する。固定表示点を物理XYZへ変換することはない。
- 保存ブラウザのfull/gameplay画素hashに完全一致した独立decodeを統合版で再検証。coldは48705比較/447不明、平均差12.559、1枝通過、約12.28秒。warmは別の通過仮説として保持。既存4200/4200.033の一意経路、固定anchor経路、取消し・有限予算の条件も保持した。公開ブラウザでの修正版確認はこれから。

### callback時刻と実際に固定した画素

- 上記callbackラベル4205.717秒の保存画素は、元動画の4205.733秒decodeとfull/gameplay双方のhashが一致し、4205.717秒decodeとは一致しなかった。旧入力を新しい時刻に書き換えていない。
- 新規captureは保持したVideoFrame自身を同期描画し、その報告timestampを新規画素の時刻に結び付ける。元のcallbackStampは別に保存。VideoFrame不可時のCanvas fallbackは時刻未結合と明記する。地図探索失敗時でも、この区別を記録する。
- 親の統合版で10個の時刻/取消し/close検証と9個の既存色・hash・capture検証を通過。ブラウザの報告timestampを正式動画PTSやAT時刻の確定へ格上げしてはいない。

### sourceに沿った半透明身体の合成

- map-before-natural-actorのsource呼出しをguardし、霧適用前の色・depth・polygon ID・fog flagを再構成。map/actorの半透明をsource順序で合成した後に霧を適用する。最終RGBへの単純なalpha合成や背景depthの借用ではない。
- 元C++pixel/blend関数との1000列/12000fragment比較を親の統合版でも通過。opaqueのモーモン/メタル出力は変更なし。MSE、未対応の所有関係、opaque同depth、未確定のrouteは保留。
- 旧F04の7誤候補のうち4件で試行した自身のgainが負になり、3件は背景不一致画素を含むため不明。現行3件も試行gainは負だが、region25の灰色物体や種類を排除しない。姿勢・配置が不完全な負値を種類判定の閾値に使わない。
- [source順序の解析注釈](https://github.com/DaisukeDaisuke/dqix-functions/blob/7a794d4414ec11396515c350d7867d4716b1246a/analysis/monster-native-composition-20261006/ordinary-map-actor-order-a2154b20.md)。ヘッドレス再現コードは非公開dots-toolsのc9b8070eへ保存・remote確認。ROM/動画/画素/状態は含めていない。

上記は統合版のsource/headless検証。公開後のブラウザ確認、連続処理の欠測、全マップの身体・種類識別、霧の動画同期、AT特定は引き続き未完。

## 04:23 JST — 公開版の到達確認と準備処理の再開

- 3934c859 / Pages37358603383の公開成功後、クラウドブラウザで確認。F04の4205.733秒は旧callback4205.717の保存画素とfull/gameplay hash双方が一致し、48705比較/447不明、平均差12.559で背景が通過した。保持したVideoFrame時刻とcallback時刻を別々に出力できた。
- 1ninnの保持画素時刻227.246秒は、旧ラベル227.250の画素と同一。メタルの旧条件付きgain120595を保持し、公開版でも3sliceで128対の初回結果まで到達。前進した227.279秒も、別の画素・領域・gainのまま3sliceで128対へ到達した。初回native gainは各−550266/−528064で、姿勢全体の否定には使わない。
- 短い再生は2観測/87欠測区間、235.222秒で停止。旧固定結果のPTSを保持して表示・保存できたが、全フレーム処理は未達。
- F01の1200秒も同一画素で旧モーモンgain642158を保持。一方、F04の4205.700/4205.733とF01では、native最初の応答が2000msを超え、追加支持が未取得となった。この失敗を保存した。

原因は、1個の身体提案の途中でsource destinationの準備完了を待ち切る経路。保存したF04で最初の呼出し約3780ms、そのうちdestination再構成約3133msを観測した。期限を延長せず、既存generatorの境界で準備を保持・再開できるよう修正した。

- 1500ms/128 work unitsと2000ms optional waitは変更していない。未完の準備はgainなしのpreparation-pendingとして返し、同じ固定入力の次sliceで続ける。
- 比較済み件数が増えなくても準備stepが進めば続ける。stepも結果も増えない待機は、attemptsだけが増えても停止する。新しい外観要求、異なるframe/ROM、取消しの規則は維持。
- 放棄したiteratorは明示的にcloseする。実4205.700→4205.733の切替後、後者の全初回結果が独立fresh serviceと一致した。
- 親の統合版でも、実保存画素とROMを実client idle schedulerへ渡して4呼出しで65対の初回結果へ到達。約1505/1504/1511/1308ms、準備step5272→13324→14374、結果2→2→28→65。各partialの旧外観・fit・AT情報は同一、取消し0、worker/catalogを維持。これはNodeのworker-message adapter実行で、ブラウザ応答時間の保証ではない。
- 修正版の公開ブラウザ確認はこれから。背景ですでに計算した同一planeの再利用は別の検証中変更であり、この修正にはまだ含めていない。

## 05:16 JST — 同じ背景の二重構成を省略し、符号付きscanlineを修正

- 最終CPU背景描画で得た霧適用前の色・depth・polygon ID等を、その同じ固定frameのnative身体合成へ渡す経路を追加。ROM、地図、camera、alignment、環境、maskと実payloadの一致を検査する。通常の表示・保存には小さな参照だけを残す。新しい要求で古い参照を破棄し、欠落・破損・期限切れ・GPU経路では従来の再開可能なsource再構成へ戻す。
- 実F04の4205.700→4205.733保存入力を統合後のNodeで測定。保持・投影・clone・fingerprint・検証等の追加費用は約150/136ms、回避する重複再構成は約2503/2150ms。同じdestinationの全データと身体raster/state/fitは一致。これはブラウザの再生速度や通信時間の実測ではない。
- 別の補助保持処理が失敗しても既存の背景RGBA/depthを変更しないこと、異なるframeや古い進行中処理のpayloadを採用しないことも確認。従来の準備slice・取消し処理を保持。
- nativeの符号付きrasterWidthが負になる行を、ポリゴン全体の失敗にしていた処理を修正。元C++同様、その行のpixel loopは0回で後続行へ進む。GPU用packingでは非正の幅だけを除外し、uint32へのwrapを防ぐ。
- 保存済み身体出力1693件は不変、従来negative-spanで失敗した69件がscore可能になった。対象reference poseのgainは依然負で、種類を確定・排除しない。元の3個のincoming fragmentはalpha0であり、可視身体3pixelの回復とは呼ばない。共有背景のF04、S04の6出力、他3マップ、および7GPU packing出力の既存成功値も不変。統合後のsynthetic98条件を通過。WebGPU実行は未検証。
- 直前9232e840のPages公開はGitHubのInternal server errorとhosted runner割当失敗で、build step開始前に終了した。公開ブラウザは3934c859のまま。この実装変更で通常の公開を再試行する。公開後の実動画確認はまだ未実施。

全マップでの身体・種類識別、全姿勢の処理、動画と霧/ATの同期、再生中の十分な観測頻度は未完成。元の固定入力・失敗・旧評価は維持している。

## 05:40 JST — 公開F04/F01の初回計算到達と追加配置

### 公開57f3f0aeの実動画確認

- Pages37369127967は05:27 JSTに公開成功。実際のpreview scriptがdestination-reuse-20261006-0501であることをクラウドブラウザで確認した。
- 長時間動画F04の保持PTS4205.733は旧3934c859とfull/gameplay/background hashが一致。既存候補の全順位・body fitも同一。従来はoptional wait切れだったnative65組の初回結果へ3slice、準備2stepで到達した。残りの姿勢域は未探索。
- F01の1200秒も同じ画素で220組の初回結果へ4slice、準備2stepで到達。region58モーモンの従来gain642158を維持し、native初回poseのgainは−820076。負値による種類除外は行わない。
- F04再生前進4205.733→4226.826の保存は87観測だが、背景まで比較できたのは2件。85件は地図名パネル不明。欠測記録128件を保持し、上限超過で133件が保持対象から除外されたため完全記録ではない。この87を身体認識成功数には数えない。
- 前進した4205.767は55組の初回結果まで到達したが、5slice/14374準備stepで再構成経路を通った。保持したsource planesがあっても、後続の背景未解決frameで共有参照が消える経路を再現した。

### sourceから実際に出力された形状に基づく追加配置（統合検証）

- 従来のdecoded形状配置を残し、source GXで実際に出力されたポリゴンの包絡から別配置を後続の自動継続で追加する。透明texelを除いた輪郭や遮蔽まで解いたものではない。新規frame/要求への切替を優先し、既存1500ms/128visit/2000ms optional waitを維持する。
- 初回の全候補応答を待たせず、その後は同じ固定入力が有効な間だけ継続。進捗なし・取消し・期限切れ・source域終了で停止する。比較済みの従来配置と追加配置を別々に保存する。手動の継続入力は不要。
- 親の統合版で実ROMと固定映像を再測定。対象Metalの従来最良+170294を保持し、追加配置で+213841。Mon1200は従来+145076のほうが追加+73351より良く、従来値を保持。現在F04の3対象はすべて負で、region34も従来値が良い。初回結果とdecoded域の最終結果は全て旧版と一致。
- 上記は対象を限定した全domain比較。別の32領域×4モデルの自動client実測では、最初の応答約1.515秒、最初の正gain到達約77.214秒/53slice。その最初の正値+19998は従来配置由来であり、追加配置の成果とはしない。現時点でリアルタイム処理とは呼べない。
- 実source処理中の保持無効化から取消し約66.2ms、遅れた結果の誤配達0。追加配置の失敗で元の候補を破棄せず、初回・既存appearance・AT値を維持する検証も通過。全入力・全姿勢・種同定・AT同定の完成ではない。

### 再生前進中の保持タイミングの修正

- 自動探索が背景候補を得られない場合も、次frame開始で共有の一時参照を消す。外観比較が終わってからnative用入力を作る旧順序では、過去の固定frameが保持していた背景planesを取得し損ねた。
- 外観比較を始める時点で、その固定frameに一致するnative専用背景payloadだけをjob内へsnapshotする最小修正を追加。共有参照の寿命は延ばさず、別frameへの流用もしない。外観・一般の観測保存にはraw planesを追加しない。補助captureの失敗は既存外観結果を止めず、取消しguardは維持。
- 元の再生前進timelineのcamera/環境を使い、再seekで取得した同一hashの動画画素だけを入力として、元の背景hash・alignment・比較値を再現。外観処理の間に背景なしの次探索を挟むと、旧順序では14374準備step、新順序では2stepの採用へ切り替わる。再構成したdestinationと既存外観結果は同一。この修正の公開ブラウザ確認は次の反映後に行う。

## 06:15 JST — 公開した継続処理の実測と重複計算の削減

### 公開edbb318の実動画確認

- Pages37372397316は05:58:42 JSTに公開成功。実際のscript版emitted-continuation-20261006-0545を確認。
- F04の同一4205.733画素で、初回65組の後も自動で23slice/990attemptまで進んだ保存結果を取得。従来の候補順位・body fitは同一。
- 再生前進中の4205.767も旧57f3版とfull画素hashと従来候補評価が一致。以前14374stepの再構成へ戻っていた箇所が、2stepの保持済み背景採用になった。55組の初回結果後も168attemptまで進行。背景なしの後続場面から古い画素結果を流用しない。
- この前進記録は69観測のうち背景比較2件、地図名パネル不明67件。欠測記録128件保持/89件上限超過。全フレーム認識の証明ではない。
- F01の1200秒では、手動のモデル・姿勢指定なしで後続native探索がregion58のモーモンgain+145076へ到達した。従来gain642158を維持。保存時61slice/3889attempt、対象Mon12提案。これは保存時点の結果で、最初の正値までの正確な経過時間を測ったものではない。種類確定・AT加算は0のまま。

### source-exactなCPU再利用（統合検証、公開前）

- 同じモデル・pose・scale・yaw・camera・billboard条件で繰り返す、領域に依存しないsource出力形状の準備だけをbounded LRUへ保持。領域ごとの配置や画素、fit、種類判定は保存しない。各jobは独立した数値配列を受け取り、変異で他jobやcacheを汚染しない。32entry/別枠8MiBの明示的推定上限、超過時は再計算。
- 同一ポリゴンのbinary alpha段階で済ませた整数geometry/depth歩行を、直後のRGB段階が同じ呼出し内で再利用する。frame間のraster cacheではなく、RGBとalphaの算術・全fragmentは保持。共有する2moduleを同時更新し、依存元のcache版も揃える。
- Full Metal requestの連続before/after実測は75.863→55.895秒、別の静かな時間帯で73.643→55.347秒。後者の初回応答は1.507→1.510秒、slice52→42。最初の正gainは同じdecoded+19998で、追加配置側は−18058。まだ再生速度に十分とはいえない。
- F04の固定3領域z038a全domainは45.308→44.497秒。一方、共有負荷のある組では46.759→49.204秒と逆転した。F04や全マップで一律に高速化したとは主張しない。時刻はhost負荷依存のNode実測。
- 全対象domainの初回・最終の科学的結果は旧版と完全一致。401項目のraster/保持形状比較、cache key・独立変異・上限・破棄・取消しの検証を親の統合版でも通過。実source処理中の取消し約33ms、遅い結果の誤配達0。既存候補・姿勢domain・順序・budget・閾値・AT意味付けは変更していない。

## 06:40 JST — 新しいフィールドの実入力とraster処理の削減

### 未使用だった場面での自動処理

- 正式長時間動画の3300秒を公開84747e3へROMと動画だけで入力。エラフィタ地方の2背景候補へ自動接続し、48768比較/384不明、平均差13.075、shift−2,0。247残差中32領域・9モデルの288組を初回比較し、後続42slice/2899attemptまでの証拠を保存した。
- 画面の大きな非プレイヤー形状が複数の残差へ分かれ、部分形状からの候補が競合している。全bodyの中心を部分残差の中心へ置く仮定の限界を調査中。source形状の一部を使う追加仮説ではgainが増えても別候補も強く残るため、それだけを理由に本番の候補数を増やしてはいない。種同定の成功とはしない。
- 西ベクセリア地方の5330秒も自動照合。5名前候補から1背景が通過し、49152比較/不明0、平均差13.200、shift0,0。417残差中29領域を比較した。これも地図・背景・候補生成までの到達で、種類確定ではない。正式動画の新診断入力として別保存し、旧評価や閾値へ遡及適用しない。

### source-exactなraster処理削減（公開前の統合確認）

- 整数平行移動をpixelごとの小さなview生成から行単位コピーへ変更。透明cellを含む全channelを保持する。
- geometry段階で完了した同じpixelのdepthをUV段階で再計算せず再利用。RGBの同じ商の重複計算も1回へまとめた。source整数演算、overflow/対応関係の検査、負幅行、透明fragmentは維持。
- shading内部では実際に参照する全fragment/scanlineを残し、未使用の256×192 coverage/depth planeをポリゴンごとに作らない。従来の公開entryは既定で従来planeを返し、内部の明示指定だけで省略する。fragment重複検査も維持。
- 静かな時間帯のfull Metal requestは51.119→30.856秒。同じ最初のdecoded+19998へ到達し、追加配置側は−18058。実source中の取消し49.678ms、遅延結果の配達0。F04の固定3領域全domainは46.498→42.954秒で初回・最終結果が完全一致。約31秒は依然として動画速度ではない。
- 親の統合版でも401raster/保持形状、470半透明/位置合わせ/error、320既定/fragment-only geometry、98負幅、48退化clipの比較を通過。既存sourcepixel1000列と実ROMの初回128組・legacy保存・変更frame/取消しも確認済み。
- 共有背景への影響も別確認。F04 4205.733の元camera/環境と同一hashの動画画素で、2784source polygon（半透明449）からの画像、destination、全typed plane/packed fragment、残差結果が一致。共有負荷下のrender3.237→2.776秒、準備・render・bind計3.919→3.477秒。この1場面では大きな退行は見られないが、全マップの速度保証ではない。

入力domain、候補順、1500ms/128visit budget、種類/ATの意味付けは変更していない。新しい閾値合わせや固定model規則は追加していない。公開後の実browser確認は別に行う。

## 07:04 JST — 公開版同値確認と継続中のタブクラッシュ

- 611fe57 / Pages37378060474は06:47:04 JSTに公開成功。実際のscript版native-raster-reuse-20261006-0637を確認した。
- 西ベクセリア5330秒のfull画素/background hashが旧847と一致し、比較した全29領域の従来候補順位・body fitも一致。377組の初回native結果後に追加探索が進むことを確認。
- 紫傘・白い胴の画面上の形状に対応するregion371はROI13,97,28,33。マタンゴ/z013bが外観候補1位、従来gain10009308/native6728276で旧結果を維持した。単一場面の候補一致を全入力の種同定やAT加算へ格上げしない。
- その後5330→5341.158秒まで再生しpause。最後に確認できた表示は3観測/55欠測区間、最終観測5339.717で、後続の固定frameを処理中だった。以後DOM/スクリーンショットがタイムアウトし、07:01:45 JSTにクラウドChromiumの実画面でページクラッシュ（エラーコード4）を確認した。メモリ不足や特定コードの原因とはまだ断定しない。
- 同じブラウザの新しい空タブは応答した。既存のクラッシュタブだけを画面操作で閉じ、タブ一覧で確認。コード・ROM・動画・5330固定bundleは保存済み。直前の再生timelineはクラッシュ前にexportできず、未回収として残す。
- クラウド環境の消失は認められない。正式入力を再取得したり、通常復旧をやり直したりはしていない。現在は長いnative継続時の保持データ、snapshot/転送/表示の負荷、取消しを同じ保存入力で切り分けている。独立したROM animation/clock解析は継続中。

## 07:33 JST — 継続照合の重複証拠を値を変えず共有

5330秒の固定入力で55,995件の失敗記録を残したまま、同一内容の記録だけをジョブ内で共有する最小修正。候補・順序・スコア・閾値・処理予算を変更しない。ハッシュ一致だけでは共有せず、構造と値を厳密比較する。

実測：100スライス分のネイティブ結果のV8直列化サイズ11,775,477→2,586,812 bytes。観測への付加後は20,053,479→12,553,419、タイムライン付加後は32,951,227→17,951,725 bytes。全JSON値・順序・表示は同一。最終キャッシュ更新済みコードで親側も再測定。実Worker/MessagePortで10,000訪問超の別測定ではGC後メインヒープ約209→108 MB。

親側で同一サービス全経過JSONの前後一致、19個の厳密共有条件、添付所有権分離、23継続、10既存表示保持、12スケジュール、後続処理・中断・バックエンド条件を確認。最初のハーネス実行は出力先引数の指定漏れで失敗し、指定後に一致確認。

未検証：先のChromiumエラー4の原因確定・解消、実ブラウザの長時間継続。Node結果のみで解消とは判定しない。元のクラッシュと全失敗を保持。

アニメーションの明示2クリップ合成は別checkpointブランチa60d88bに保存。12最終関節・24中間コールと一致、297シナリオ／3,996ノード呼出し／14,463検査。3300秒映像の実際のクリップ・位相・合成状態は未確定で本番未接続。

## 08:01 JST — 保存フレームの回転復元を元命令へ一致

現行コードで再現した17固定ケース・19ノードの誤差について、ROMのsampled pivot分岐だけに必要な第3軸の固定小数点正規化を追加。パーサーは元データのpivotビットを保持し、既存の正規化関数を再利用。定数回転・basis回転・他のチャンネル・姿勢探索範囲は変更しない。

実測：元の17失敗と既存3対照の計20ケース・228ノード・360原ARMチャンネル検査が一致。19変更は各成分1FX12単位で、他の数値とプレビュー用行列は不変。既存パーサー129検査、保存フレームの入力制約11検査通過。親側が最終キャッシュ更新後にも元ARMを再実行して確認。実動画の固定メタル入力で128組の初回照合結果・旧順位・身体fit・未確定項目・AT項目も旧版と一致。

パーサーと利用側を同時更新し、関連23webファイルのモジュール版を更新。新しいWorkerで読み直すため旧パーサーオブジェクトと旧ネイティブ姿勢キャッシュを混在させない。既存の浮動小数点プレビュー値は変わらない。fractional／blendの本番選択は追加していない。3300秒の身体回復や全入力対応は未検証。

### 前のメモリ修正の実ブラウザ確認

62022版の5330秒は映像画素・背景残差・全旧順位と身体fitが611版と一致。再生後5330.033秒も169組の初回照合が進行し、後続3フレームは背景未解決として保持。途中で検証タブが一覧から消失し、この試行の長時間連続性は認定しない。クラッシュ画面は観測していない。

その後5339.717秒へ独立に移動して再検証。11分20秒以上の固定フレーム継続で285スライス・24,049完了訪問・416組の初回照合、背景準備2段階を確認。112,904,650bytesの全証拠JSONを保存し、停止後もページ応答を確認。保存時点まで新たなクラッシュは観測されなかった。停止後は比較入力が消えるため比較記録の追加保存はできなかったが、身体比較bundleは保存済み。

これは停止前の元forward状態とは異なる背景条件の固定フレーム測定であり、元のエラー4の原因確定・恒久解消やリアルタイム連続動画処理の完成とはしない。

## 08:10 JST — モジュール版更新に伴う既存検査の読み込み修正

e05e06の公開buildは既存feature integration検査で停止。検査側が「./monster-animation.mjs」という完全一致で模擬データ読取を差し替えていたため、版付きURLを実パーサーへ渡してしまい、1byteの模擬入力が未対応となった（16テンプレート想定に対し4）。同じ失敗をローカル再現した。

期待値・入力・検査内容・本番コードは変えず、模擬読取の対象を判定する箇所だけquery部分を除いて照合。既存89検査が通過。公開反映は再buildの完了確認待ち。

同時に3300秒の既存残差99・z067a/z007bについて、現行の保存姿勢／固定4方向／床候補の条件付き全域を再実測。303／288候補で最良gainは1,341,630／1,871,260、従来結果と同じ。微小回転誤差の訂正だけで身体枠問題が解決したとはしない。モデル・部位対応・生状態の未確定は保持。

## 08:44 JST — 最新待機フレームとROM身体範囲を接続

新しい実動画5306.500秒の東ベクセリア（map20005）を自動処理。63残差のうち21領域・5モデルを比較。大きな青白い飛行体の残差55では外観先頭z018c（ガチャコッコ候補）の旧身体fitが−1,128,703、ネイティブ試行が+3,836,418。ネイティブの色所有範囲(179,91,50,55)は独立残差(177,88,53,59)に近いが、姿勢と画素は完全一致しない。他モデルの正値も残る。青い操作矢印と主人公を含む残差51は5モデルすべて負値。上のピンクの対象は残差17/31に分割され、それぞれテンツク候補となるが2個体とは認定しない。

実装1：ネイティブの試行結果に、幾何学上の投影範囲・ラスタ被覆範囲・最後に身体が色を書いた範囲を別々に保持。背景と合成した最終画像のalphaを身体マスク扱いしない。例：残差55の別候補z068aは最終画像の足跡919画素に対し、最終身体色所有は25画素のみ。後から背景が混ざる以前の身体寄与を、この所有範囲だけで完全把握したとはしない。

既存の完了フレーム表示に、外観先頭候補の試行内正値がある場合だけ水色N枠を追加。元の黄色残差枠と全順位・旧条件付き予測を残す。枠は同じ動画時刻／ROM／地図／画素hashで拘束した条件付きネイティブ試行の範囲であり、敵認定・身体全体・個体数・AT証明ではない。背景合成による寄与の取りこぼしがあり得る範囲には*を付ける。

実装2：実再生5306.5→5357.187秒では15場面を観測し、後続の背景比較済みフレーム3件が先行種類比較のbusyにより失われ、停止映像への種類比較が自動再開しなかった。自動動画のレーンだけ、実行中1件と最新待機1件に限定して保持するよう修正。古い待機は明示的な未比較のまま残し、停止・seek・ROM・方針変更時は破棄。後続処理の同時実行や候補削減はしない。待機に入れた時点でそのフレームのネイティブ背景を所有し、後の検索で一時保存が入れ替わっても別フレームへ混ぜない。

親側検証：20個の実保存最良試行のスコア/SSE/画素数と既存添付結果が、新extent項目を除いて一致。15所有権条件・7フレーム同一性条件・表示の既存予測数保持を確認。実際のmountedコードの制御試験で、元の最新フレーム消失を再現し、修正後に5356.167の待機処理が自動開始することを確認（画素と分類応答は合成）。実保存の1,407,188byte背景引継ぎも全入力一致。既存継続23・表示保持10・スケジュール12等が通過。最終cache更新後も主要検証を再実行。

未検証：修正版による実ブラウザ再生・全フレーム処理・全マップ認識・身体や種類の確定。欠測128件保持／363件は保持上限により詳細未保持の旧結果、負値、曖昧な候補、AT下限0を保持。閾値合わせ・領域結合・確定個体数の追加はしていない。


## 09:23 JST: code backup and pause/resume discontinuity telemetry

- Full current web source: all 373 files matched GitHub blob hashes at eb44154. Complete repository at a413a966 retains all prior files and adds the full unintegrated diagnostic module, baseline and harness; dots-tools 5f3c0104 preserves six historical observer V3 source variants without replacing newer work6. All 69 locally restored tool files have verified remote blob/archive/snapshot coverage. External submodules remain references.
- The real eb44154 pause/resume run recorded a backward-time reset at callback PTS 5311.3, presentedFrames 289. The preceding clock value was not exported, so the cause is unknown.
- Diagnostic-only file-video-input change now preserves exact previous/incoming clocks, source epochs/segments, callback registration/cancellation IDs, paused/running/seeking state and bounded lifecycle history in source.inputDiscontinuity. No tolerance, FPS assumption, timestamp correction or reset behavior change.
- Existing controlled comparison harness: 15 checks passed independently after restoring repository-relative imports. Synthetic cancelled callbacks are distinguishable but are not evidence Chromium delivered one in the real run.
- Real forward run eventually finished the latest eligible 5355.817 frame, map7401, with 15 sightings; exact BODY/CMP full-pixel hashes match. No actual queued-latest transition was observed, so this does not prove that branch engaged. Map7400 no encfld group remains a failed/unsupported frame, not absence.
- The transient browser approval-capacity failure was resolved; final BODY/CMP/timeline were exported and the old comparison stopped. No cloud-environment reset was inferred.
- Telemetry deployed-browser verification and reset-cause determination remain pending at this checkpoint.

### 09:29 JST: publication harness compatibility repair

The first telemetry build d457d81 failed in the existing check-video-panel-capture.mjs loader before executing the relevant cases: pathToFileURL(resolve(..., spec)) encoded the browser cache query as part of the filesystem name. Local reproduction matched ERR_MODULE_NOT_FOUND. Loading through new URL(spec, directoryURL), while retaining both exact and canonical fixture lookup keys, restored all 417 existing checks. No fixture inputs or assertions were weakened. A build-script comment documents the URL-loading requirement; no workflow configuration was changed. The next full Pages build remains to be verified.

The next build 056d387 passed the repaired capture harness, then found the same cache-version assumption in the existing map-recognize shell import assertion. Its comparison now removes the cache query while retaining the exact two expected module paths; 50 existing checks pass. Local execution also passed the preceding suites, but cannot establish a full production build because the checked-in map WASM is a build-time placeholder lacking map_registration; the CI-generated WASM must be verified by the next complete build.


## 10:08 JST: lossless body-support and observation handoff improvements

### Implemented
- Native body extent validation and summary now share their source-mask scans. Existing comparison-first and malformed-mask failure precedence is preserved. No proposal, score, source raster, pose, root, model order or certification rule changes.
- Compact native body support now reaches event-evidence derivation, observation compilation, prepared jobs and a separately owned controller companion. Original sighting/frame/model/branch/proposal identities and negative/unsupported alternatives remain. Shared model IDs or overlapping boxes do not merge actors or certify an actor count.
- The new tracking-only companion is separated before the existing UI AT snapshot fingerprint. Every prior automatic event field remains hashed. Actual UI observationRevision, request, stored-checkpoint lookup and retry retain the original checkpoint identity on the fixed input. No broad hash exemption or AT constraint is added.
- Observation publication composes the current timeline before one ownership clone instead of cloning an old timeline that is immediately discarded. Only the four inspected producer paths opt in to the unaliased-envelope contract; generic calls preserve the old alias behavior. Full timeline download serializes synchronously without the redundant pre-serialization graph clone. Existing evidence and eviction counters remain available.

### Measured independently
- 208 + 88 saved real-ROM proposals: exact pixels, scores, extents and unchanged input buffers. Extent-only alternating measurements over 20 repetitions:3.895→1.864s and1.353→0.752s. Instrumented mask visits:36,569,088→22,413,312 and12,976,128→8,650,752. These are extent-helper results, not full-video throughput. An earlier short whole-service sample was slower after the change; no universal end-to-end speedup is claimed.
- Existing extent contracts and baseline equality checks pass. Current20-case source replay,31 tracking propagation guards, compiled AT request/gates/groups, and actual controller checkpoint lookup/retry checks pass. The105 native alternatives remain105 alternatives, not105 actors.
- The saved three-frame/69-sighting timeline still exports exactly23,939,054 bytes with SHA256 cddad96c395b765e089a078841312a7b1d0cd84309c75bfa96ad18be27d0c53e. Its pre-serialization clone is eliminated.
- Saved BODY + later timeline publication uses one clone instead of two; measured reconstructed clone input13,968,863→13,783,119 bytes. A separate structural replay containing the saved prior history measures19,594,867→13,783,119 bytes. That structural case is not the unrecovered live crash snapshot. Parsed JSON loses live object aliases; these are Node reconstructed-graph measurements, not Chromium heap or crash-cause proof.
- Live producer/transform identity checks establish the explicit fast-path envelope contract. Generic alias fallback, returned-copy isolation, latest-pending, seek/stop/policy/ROM cancellation and exact downloaded JSON pass.

### Browser evidence and remaining limits
- Runtime37357aa completed the original5306.5 frame with the same full pixel hash,21 sightings and original raw regions. First pause/resume retained source epoch2/segment1 without a backward-time reset; the three-frame timeline was saved.
- Second pause/resume was observed paused at5324.089227 seconds, but its timeline export was not recovered. Own-cloud Chromium then displayed error code9. The cause is unknown. The user reported recovery by reloading; a subsequent own-cloud screenshot and tab reattachment confirmed the initial page was responsive again. No environment loss was observed.
- Earlier tab disappearance without a crash screen remains an interruption, not a confirmed crash. The diagnostic timestamp patch remains available, but this run did not recover the old backward-time cause.
- These new resource reductions do not establish that error9 is fixed. Combined deployment and real-browser recheck remain pending at this source checkpoint. Body identity, fragmented-body association, all-input recognition, current AT state and proven AT progress remain unconfirmed.

The full source and reusable replay drivers are backed up in the allowed repositories; game input/evidence assets remain outside Git.

## 2026-10-06 11:05 JST — Playback activation, pause evidence and source preparation reuse

### Implemented and locally checked
- The continuous-observation button now calls video.play in the user gesture. Native video playback activates the same observation pipeline. Late ROM/video readiness preserves that intent; explicit Stop/Cancel clears it. Both preview entry points share the activation hook. Thirteen mounted activation checks and nine existing lifecycle/ownership checks pass on the combined source.
- Two actual pause/resume exports from runtime c5eb10c establish fresh registered RVFC callbacks with PTS 5312.817→5312.800 and 5319.050→5319.033 while presentedFrames advances by one. This is not evidence of a cancelled callback. The opt-in fix holds only a callback satisfying the recorded pause-boundary/previous-observed-interval conditions, records it as unobserved, and waits for catch-up. It neither retimestamps nor assumes an FPS/tolerance. Continued regression and explicit seeking still reset. Both real sequences and existing default/opt-in clock checks pass. Error9 cause remains unknown.
- Four coordinated modules now reuse source preparation only under the existing cache lifetime and exact source-byte/identity guards. Completion, error and cancellation dispose the cache. The 8MiB snapshot/alpha admission bound is not a total-heap bound. Mutation, state variants and lifetime checks pass.

### Measured, with unchanged scientific outputs
- Independent source reconstruction replay: 2168.860→1049.238ms; archive opens156→1. The final cache-revision replay takes1130.930ms and preserves the entire image/destination outputs. RGBA SHA256: 1e742270569960ac11ce129673c3fa9cd3fc164f6c338f35bba288aa65547703. Destination SHA256: 20cb4294c8c2b38ef7ced6693eeeabaa13df3ad1a6e385340d855981112c6c91.
- Fixed105-job first sweep:4896.564→3024.928ms. Mode1 60-job control:837.549→831.690ms. These bounded Node samples are not a universal/browser speed guarantee. Earlier slower control measurements remain in the source report.
- Existing pixels, candidate order, scores, thresholds, fixed failures and AT proof boundaries are unchanged. No ROM, video, save, RAM or extracted game assets are included in this commit.

### Still unverified / continuing
- This checkpoint has passed combined local checks; deployed one-button playback still requires real-browser verification.
- Playback activation does not establish correct automatic identification of every necessary factor. Automatic map-entry interval and located-position filtering is being connected separately; native FirstSpawnReplay dependencies and current AT state remain unresolved. No all-input automation completion is claimed. Proven minimum AT remains0.


## 2026-10-06 11:20 JST — Automatic conditional entry/position filtering

- Playback observations now execute a source-bound conditional replay-input join using the already detected entry signals, map alternatives and located positions. Normal playback requires no added seconds, map, model, JSON, seed or index fields. Advanced explicit-chain controls remain separate.
- On the retained36-frame timeline,39 combinations produce7 compatible branches and32 map-incompatible combinations. On the retained15-frame timeline,98 produce33 compatible branches,63 map mismatches and2 targets earlier than the selected conditional entry window. These exclusions concern selected assumptions only. The broad unknown branch remains and native loader entry may precede the observed signal.
-57 binding/filter/cancellation/retention checks pass. Twenty saved native-best outputs remain exact. Actual baseline/patched UI observation identity, AT request, saved-checkpoint lookup and retry are identical on both BODY and BODY-plus-timeline inputs. Normal-flow advanced manual options are called zero times.
- Parent independently reran the combined post-cache validation script successfully: mounted activation, real tracking handoff, pause and prior clock behavior remain intact. Exactly3 implementation files and2 cache-only parents changed.
- Native loader/actor state, source update clocks and intervening AT consumers are still missing for native FirstSpawnReplay. This change computes conditional inputs; it does not execute that native replay or recover current AT. Proven lower bound remains0.

### Actual browser check of the preceding activation source
- Pages run37402925863 succeeded for9eaca6f. Own-cloud browser loaded the exact automatic-playback-source-cache-20261006-1100 module. With only the formal ROM and video selected, one start-button click began playback and observation. No map/model/seconds/layout value was entered; the supported1920x1080 layout was recognized automatically.
- The native video started at its decoder-reported2.514 seconds, not a manually requested timestamp. At48.781 seconds the UI showed1304 analyzed callbacks. The exported bounded timeline retains128 frames and honestly reports1176 frame evictions; this is not full-video coverage or1304 recognized enemies. Map/name remained unresolved in this early segment.
- After explicit observation Stop, pressing the video's play control alone switched observation back ON and reached3077 analyzed callbacks at116.527 seconds. This establishes activation, not end-to-end recognition. The screenshot at116 seconds shows a black map-screen area; the system did not invent a map.
- No claim is made that error9 is fixed. The conditional-entry integration still requires deployed-browser verification.

## 2026-10-06 11:59 JST — Exact encounter pairs, movement candidates and AT preparation

### Implemented
- Existing enc.json rows now retain map/group/table/species relationships through shared-model classification and automatic AT input. The old Cartesian product could pair table30 with raw model alias297 although that table only supplied alias3. The conditional pair is now(30,3); raw aliases/rankings and unknown/player/background alternatives remain. No table/CSV was re-mined, no area/time branch was silently selected.
- Same-source native body roots now produce executable predecessor candidates across camera/player movement. The actual retained1ninn observations at134.612→170.312 seconds yield16 predecessor relations/22 native hypothesis pairs; each of8 later sightings keeps both earlier residual10 and103 as possibilities. Three intervening entry/reload signals and missing/evicted history remain explicit. The resolver is called by the tracking controller and prepared job. These relations are conditional same/different/error alternatives, not certified actors or extra AT draws.
- AT preparation now hashes the owned snapshot once rather than twice and avoids enumerating the same replay factors twice. Cancellation after the first digest stops remaining preparation. Started jobs retain an owned copy of the already computed replay factors; job/controller motion companions are isolated from each other's mutation. Existing request/identity/checkpoint/ACK rules are preserved for identical event semantics.
- Normal background preparation and CPU fallback consume cooperative source generators. Cancellation can run between source instances, polygon work and packing/composition steps. Synchronous reference APIs remain. Pixels, ordered operations, failures and candidate budgets are unchanged; individual native raster calls can still block.
- A separate ROM-guarded native clock producer derives controller/scheduler arithmetic from native timer operands. It does not infer hardware ticks or interrupt counters from video PTS, and is not wired as automatic FirstSpawnReplay completion. NPC context at controller+0x3b0 remains distinct from scheduler delta+0x3b8.

### Verified
- Exact enc join:20 focused contracts and unchanged topology across1,040 ROM-linked origins. Five saved captures ran through actual automatic controllers and existing AT WASM. The invalid ID297 contributed no outcomes in table30, so numerical candidate-state counts do not decrease: semantics/provenance improve. Source evidence and checkpoint hashes intentionally change for the corrected input. The optional broad/manual-chain compiler remains unchanged.
- Movement:23 dedicated checks; original owned-body observations, automatic events and AT identities remain unchanged by adding the motion companion. Multiple predecessor candidates are retained rather than selecting a winner.
- AT preparation: real saved BODY before/after keys, request and started-job replay remain identical under the same corrected enc semantics. Actual WASM resumes a prior ACK without extra writes; changed source rejects it. Cancelled preparation performs1 digest rather than4. Three paired Node runs measured median1282.64→1019.78ms; this is not browser-starvation proof.
- Cooperative preparation: paired Metal sample largest timer gaps1580→13.8ms for GPU-input preparation and744→55.8ms for CPU fallback. Full GPU payloads/CPU image JSON and296 saved native proposals remain exact. Total work can increase due to yielding. These measurements do not identify the cause of browser/API timeouts or establish a hard maximum segment time.
- Native clock: guarded arithmetic matched two actual controller invocations from the unchanged verified older DST. Observer-OFF/ON CPU/RAM boundaries matched. Unknown clock operands stay unresolved; exact entry/video reproduction is not inferred from this arithmetic check.
- Parent combined post-cache checks pass for encounter joins, ROM plan, native motion, actual controller/job ownership, ACK resume, session boundaries, mounted activation, real pause sequences, cooperative rendering and clock source guards. An initial local pause regression harness accidentally used the already-fixed c28 code as its OLD baseline; restoring its original c5 baseline resolved that harness failure without changing assertions or production behavior.

### Real automatic playback and entry diagnostics
- Own-cloud c28 playback of formal1ninn, after ROM/video selection and one start click, supplied names, map/position alternatives, background comparisons,32 residual comparisons and conditional singleton AT analysis without manually entered map/model/seconds/layout values. Saved output is at retained pixel timestamp170.312; playhead paused184.001057.716 raw regions include684 unclassified regions. This is not32 recognized enemies or complete video coverage.
- Its saved timeline retains128 of190 analyzed frames,18 entry signals, and explicitly reports62 frame/2034 gap evictions. Replaying the automatic factor join yields387 combinations:134 compatible,190 conditionally incompatible,63 unresolved; the broad unknown branch remains. Current AT is not recovered, proven lower bound0.
- From the separately supplied village DST, ordinary movement reached M01→F01 and then the target field scheduler boundary at resumed frame169.13 exact AT calls were observed:2 in the old map,2 within destination-loader NPC construction,9 later pickup-slot calls. This is a source-bound diagnostic of that original state/input, not a universal entry count or the original video's state. Original inputs and raw native evidence stay private/outside Git.
- A separately supplied persistent save boots at the ruins entrance. Three reproductions of the same newly captured pre-entry state crossed7100→7101 with223 frame boundaries matching;4 AT calls were observed during loading. Source-verified loader0x021a3a1c→0x021a3bdc spans resumed frames95–97 and contains all4 calls; map ID changes at frame6. Eight additional observer points preserve223-frame equality. Measuring only the map-ID switch misses these calls. No universal4-call rule is claimed.

All new production source is included in this checkpoint. Reusable authored harnesses and private input-identity receipts are backed up separately in dots-tools; ROM/SAV/DST/RAM/video and extracted assets are excluded.

## 2026-10-06 12:44 JST — DST-bound native AT replay and exact motion endpoint links

### Native entry input now executes existing replay
- Added one separate native-entry-replay-input module. It strictly reads the bounded main WRAM block from the observed DeSmuME v12 DST format and derives initial map/AT state from those bytes. Filename/video/manual seed guesses are not used.
- The producer binds reviewed ROM and original-state code, exact ROM/DST/input identities, native origin/end RAM receipts, every frame drain, observer completeness, register/state/pixel parity, ordered AT entry/return/caller pairs, absence of seed resets, and loader boundaries. It derives full controlled, loader-only and destination-until-first-scheduler windows from observations without scene-specific count constants.
- Both independent native cases execute the existing replayObservedTrace/ATKernel API with zero mismatches: village13/2/11 calls and ruins4/4/4 calls. Forty-eight malformed-state/binding/mutation checks pass. The roots are supplied states; their correspondence to another video, boot consumption, general FirstSpawn/world support remain unproven.
- This is a consistency-checked execution receipt, not cryptographic emulator attestation. The native execution provider must supply real receipts; no mandatory manual JSON/seconds/seed controls were added. The new module does not bypass existing FirstSpawn runtime guards.

### Motion associations link only exact endpoint selections
- Existing per-sighting movement candidates now link to concrete previously scheduled singleton branches and latent-event IDs only when that exact endpoint's source/ROM/epoch/frame/pixel/model/map/camera/table-species provenance agrees. Prior and incoming endpoint predicates remain separate; no intersection, extra draw or actor identity is invented.
- In the current recorded case, all16 motion relations remain unresolved: predecessors10/103 cannot borrow residual506's classification merely because the model/map looks similar. A positive synthetic exact-sighting case exercises the executable link and nested ownership; it is not a newly recognized video monster.
- Request, identity, checkpoint and ACK behavior remain unchanged. Fresh recorded B resumes its five-ACK result without new writes; changed source rejects the old ACK. Combined post-cache native replay, binding, endpoint ownership and real-WASM resume checks pass.

### Scheduling and pose experiment limits
- Actual exported A→B observations about19 seconds apart both finish their AT jobs. Their scheduled branch predicates are identical but raw native support changes the full request/key. A controlled3.167-second update experiment interrupts earlier completion after3–4 ACKs; it is not a measurement of live callback cadence. No scheduler change or cross-key ACK reuse was introduced.
- Prior-pose re-placement is retained only as an experimental source checkpoint under experimental/checkpoints/native-pose-reacquisition-c719b65b. It does not replace production proposal order. At equal budget, scores improve in12 pairs and worsen in2–3, positive supports remain17; detection/species/missed-actor improvement is unproven. All worse runs, source-map rejection/no-op cases and earlier fixed failures remain. The archive contains authored source only, no game pixels/assets.
- Reusable source/harnesses are backed up in the allowed repositories. Exact native private evidence and original input identities are separately saved in private Library, never Git. Current video AT remains unresolved; this checkpoint does not certify full automatic navigation.

## 2026-10-06 13:17 JST — Video tracking frame identity correction

- Corrected the residual tracker adapter cache: equal pixels are not the same observation when source/epoch/segment, frame serial or PTS changes. Invalid background/alignment clears tracking before cache lookup. The tracker now uses retained mediaTime before playback-time fallbacks and resets across source/scene boundaries.
- The prior adapter returned the cached 170.312-second observation for an explicitly controlled 170.362-second stamp on the same saved pixels; corrected code records the new stamp. This is a controlled adapter reproduction using real saved pixels/masks, not a newly observed video frame or detection-accuracy improvement.
- Eighteen focused checks pass. Noncached matcher outputs, the existing 0.5-second discontinuity boundary and original real inputs are unchanged. No DST/RAM data is used.

### Production input boundary implementation
- Native observed replay, boot trace and NPC runtime/clock upload commands now reject at the worker entry before input processing. The corresponding public trace input is disabled and NPC snapshot upload controls are removed; policy is visible in those panels. Old memory-proof session events/provenance are rejected before restoration or handoff to identification.
- ROM/video-derived geometry and conditional numerical projections remain permitted. The temporary hand-authored FirstSpawn numerical PoC is explicitly labelled as such, never automatic completion; identifiable DST/RAM provenance is rejected there too. Pure numerical replay functions are retained for isolated tests. No new DST/debug UI or opt-in is added.
- Provenance guards cannot detect a person retyping a RAM value after removing all origin metadata; that misuse is expressly prohibited by source/UI policy rather than falsely claimed detectable. On a38.4MB saved BODY, a guard scan measured46–83ms locally; duplicate boundary scans add overhead, not a performance improvement.

## 2026-10-06 14:08 JST — Original video/ROM path: isolated implementation checkpoints

- Production input guards and the frame-identity tracker correction deployed successfully at77fa730, verified in the cloud browser. Original build-script file mode restored at27b7c54; its Pages build/deploy also passed. Existing synthetic numeric tests remain; public memory-provenance input tests now require rejection.
- Implemented a separate bounded actual-video capture/replay lane while slow ROM rendering runs.12 real decoded frames at170.312–171.412s were measured. Frame-edge intersection, with acceptance gates unchanged, retains the visible orange residual12 through170.712; it still becomes unresolved at170.812 because forward/backward matches disagree by1pixel.74 checks pass; one original overlapping-duplicate assertion failure remains documented. No complete tracking, browser-overhead or detector-accuracy claim. This six-file source checkpoint is not enabled in production.
- Implemented a separate camera-aware body alternative and exact enc-to-AT singleton consumer. Current-code rerenders of five fixed real frames cover125 residuals,803 successful proposals and446 missing/unsupported proposals; successful gains reproduce the saved values. Only c28 residual12 produces a new provisional alternative. Existing1200s positive is preserved, but4200s false predictions and3300s failures remain. No general detector fix is claimed.
- The isolated consumer joins c28's camera branches to table30/species31 as a conditional possibility, retains the unknown branch and existing experiment branches, and does not add event order or independently certified draws. Repeated sightings are one possible latent event, not proven actor identity. Automatic production wiring remains pending review; these results are source-backed experiments, not completed end-to-end automation.
- Full authored source and test checkpoints are under experimental/checkpoints. Native memory state, raw pixels/video/ROM and extracted game assets are excluded.

## 2026-10-06 14:37 JST — Camera-conditioned video body evidence connected to AT hypotheses

- Integrated the separate all-retained-camera body alternative into the existing immutable recognition bundle and automatic AT controller. No new user controls or manual seed/map/JSON/seconds input were introduced. Complete same-frame ROM/video/model/camera/enc provenance is required; missing or changed evidence remains unknown. The old prediction and all original failures remain in their original fields.
- Compact claims are independently recomputed against full evidence owned by the same bundle before a conditional branch is scheduled. The model must agree with appearance across every retained camera; all required rival model proposals and nondegenerate known body ownership must be present. This compares best-tested hypotheses, not every possible pose or every input.
- Root reran actual saved c28 video/ROM body evidence through the mounted-preview controller and real AT WASM after cache finalization. One conditional table30/species31 branch is appended with zero manual-options reads. An independent table enumeration gives10241 allowed15-bit outputs /671154176 low31 historical event-state classes. The unconstrained unknown branch remains, global/current AT is not recovered or narrowed, and minimum proven calls remains0. Node substitutes Worker transport and IndexedDB storage; live-browser end-to-end behavior remains to be measured after publication.
- Legacy1200 request/identity/checkpoint/result remain byte-identical. Two sightings on the same tentative track keep one possible latent event; no independent birth/draw/order is certified. Eighteen mutation checks reject before preparation, three cancellation/source-supersession cases pass, and existing417 capture plus230 UI lifecycle checks pass. A reproduced synchronous cancel-in-running-notification hole is fixed with an epoch check before session start.
- The measured-frame tracking lane remains isolated. A second shadow experiment using418 raw connected-residual pixels instead of the726-pixel rectangle loses the visible orange body earlier; unchanged residual gate14 rejects measured14.3708 on the first step. This negative source/result checkpoint is preserved and not enabled. No threshold was relaxed.

## 2026-10-06 15:18 JST — Normal browser playback and preserved tracking/proposal experiments

### Browser measurement
- Published126d5df passed Pages build/deploy and the cloud browser loaded the exact1430 script revision. Selected formal ROM and1ninn.mkv, then pressed the automatic-start button once. No map, model, layout, seed or time parameter was manually entered. The app automatically selected map/background hypotheses and performed classification; its UI reported conditional-event AT analysis complete. This is workflow observation, not identity/current-state certification.
- Stopped and exported the actual timeline:870 analyzed observations,128 retained frames at611.496–743.462s,35 entry candidates,83 retained sightings.64 retained sightings have the new camera-alternative attachment, but none has a supported new camera model;4 have legacy conditional predictions. Earlier742 frames and11156 gaps were evicted. Do not infer that the new alternative was absent/present across the entire run. The final AT result was not exported before stop.
- Current AT remains unrecovered and proven calls0. All coverage/entry/absence certification flags remainfalse. A Page.getFrameTree read timed out during playback; later stop/status/export succeeded without reload. This is not an error9 cause/fix claim. Raw timeline25,566,564B/SHA256b2e533e9c372b174fcbca96eadbcb43830dc2d48822f459958bcebdfe710ecd5 is saved privately, never Git.

### Isolated source checkpoints, not production changes
- ROM-owned footprint tracking did not improve the original bbox lifetime. Eight orange and12 reproducible legacy hypotheses were retained;3 translucent cases were unavailable and58 saved-extent cases untested. The latter have poses/roots but lack the saved extent summaries; they are not impossible to rerender.
- Equal594-cost set-valued matching adds unverified alternatives but no verified retention. Full independent reverse checking extends the visible orange track by four0.1s observations through171.112, then loses it at171.212 while partly visible. All fixed-negative verified lifetimes remain unchanged. This uses more computation and does not select a winner or certify identity.
- Exact early-rejection witnesses preserve complete-search accepted positions and parent sets on all four fixtures. An actually visited reverse competitor that is better/tied disproves a unique return; acceptance still completes the original reverse procedure. The expensive r51 case drops100053→5534 displacement costs; orange20787→14330. Timing is not uniformly faster (holdout slightly worsens), and no browser runtime improvement is claimed.
- Deterministic component-tree enumeration supplies a previously missing body+mallet40×31 proposal without a fitted threshold/radius or chosen answer node. All37 merge nodes in4200 and1014 grouped nodes over five fixed frames are retained. Native-pixel appearance agreement does not reproduce in the separately labelled full-resolution decode: body identity remains unresolved and false UI/background alternatives remain. Four grouped native checks also remain unknown. No classifier/AT activation of this grouping.
- A narrow ordering-based ownership capability is source-backed but does not improve actual z038a cases: all have early opaque writes and remain unknown. Pixels/state/old ownership are unchanged. Full direct-color contribution through blending is a separate ongoing implementation, not a completed result.
- Six authored-source archives under experimental/checkpoints preserve these implementations, baselines, tests and failures. No ROM, SAV/DST/RAM, video, decoded images or extracted assets are included. Production runtime remains126d5df.

## 2026-10-06 15:27 JST — Direct body-color contribution implementation

- Added a separate exact direct-RGB coefficient-lineage mask to the admitted ROM compositor, including retained body terms through later map blending and removal by opaque/full-fog replacement. This does not mean a counterfactual visible difference, observed enemy membership or identity. Final-writer ownership retains its original meaning and limitations.
- Root reran751 assertions,15 unchanged extent checks and the unchanged mixed-compositor regression driver successfully. Worker also reproduced20 exact retained ROM/video recipes with identical old pixels/state/scores/extent fields. Four previously unsupported mixed z038a draws now have separate complete contribution evidence; in these four examples its mask equals final-writer ownership. Recognition/AT consumption of that separate capability remains isolated work in progress.
- The new two-module authored source, patch and tests are checkpointed under experimental/checkpoints/direct-body-color-contribution-fa339818. It is not activated in production.
- Exact replay inputs are saved privately as a47,273,796-byte ZIP with SHA256 b009687f97b8990e45a7bdedbf84da4f8760ee7f8568836887cc9819ed9c6264. Its27 original capture/decoded-frame files passed full decompressed size/hash verification. They are not in Git. Existing full-video file-stat dependencies remain required; no placeholder bypass was used.

## 2026-10-06 15:47 JST — Preserved negative consumer and bounded tracking results

- Separate direct-contribution consumer resolves additional mixed-body rival evidence without changing803 retained fit gains across125 regions. The existing c28 alternative is unchanged. Its21 binding mutations plus other checks pass, but it cannot independently reconstruct background pixel/photometric inputs absent from the serialized binding.
- In grouped4200 native-resolution queries the body-sized z002b alternative survives and three UI/background agreements are excluded. The separate full-resolution query instead falsely admits the command UI asz002b (similarity0.4766, source gain1,388,920), while the actual body-sized group remains unknown. The original expected-one-positive assertion fails and is preserved. Additional raw4200 replay covers ten regions/five models,101 renders/50 pairs; all separate alternatives remain unknown and old legacyfalse boxes stay. This consumer is not promoted.
- Fair actual-frame conditional position sets preserve all original baseline records on four fixed32-track fixtures. They reserve594 costs per active original track and keep unverified ancestry unresolved rather than spending later work on it. Orange continuity still fails at170.812, and the extra lane is slower. Initial597ms and subsequent276ms versus86ms results are preserved; requested8ms cooperative slices reached15.55ms in one measured run, not a hard time bound.
- Removing per-displacement async overhead preserves exact displacement prefixes, budgets, states and controlled cancellation/yield behavior. Four paired measurements after warmup give medians orange220→210ms, legacy174→170ms, holdout227→221ms, but fragmented154→159ms worsens. Mounted controlled completion169→158ms retains13captures/11steps/oneclassifier call and closes all handles. No retention gain or production activation.
- These negative source implementations and their original failures are included as separate immutable authored-code checkpoints. No source/evaluation threshold was changed to force a positive outcome. Normal production remains126d5df.

## 2026-10-06 16:34 JST — Measured video replay and delayed candidate labels

### Implementation and source validation
- Integrated the original bounded actual-pixel replay lane into normal automatic video observation, without the slower fair/set-valued/witness search experiments. It retains up to256 grayscale/validity frames and uses the existing unchanged matcher limits. Classified source PTS and current measured patch PTS remain separate. A previous candidate label is transported only through an exact source-frame/proposal anchor and measured seed handoffs; it is not a new classification, same-actor proof or extra AT draw. Lost, evicted, changed-source/map or unbound history remains unknown.
- Fixed two startup invalidations reproduced in the isolated mounted integration: unresolved layout must not establish a layout identity that erases a slow seed when layout resolves; a callback-clock metadata switch must not reset captures that still use the same retained VideoFrame pixel clock. Source/epoch/segment changes still reset immediately.
- One-button and native-play mounted flows use controlled Canvas/VideoFrame/ROM/classifier providers:13 captures and11 replay steps, with all handles closed. A delayed PTS0 classification can accompany the measured patch atPTS0.36 through three measured handoffs. These are controlled connection/lifecycle results, not real-browser timings. Source/proposal anchors are bounded by retained frames×32 and pruned on loss and eviction.
- Root applied all9 candidate files with exact source hashes, reran seven focused capture/anchor/mounted suites and the full standard scripts/build.sh successfully. Five existing camera/AT producer, guard, real-WASM, cancellation and legacy/repeated-sighting suites also pass against the integrated source. Current AT remains unresolved, unknown branches remain and proven calls0.
- All four saved12-frame replay sequences retain the original track outputs. Orange12 still loses continuity at170.812 while visible; no new retention gain is claimed. The original duplicate assertion still fails expected0/actual1 because its second overlapping patch overwrites159/400 pixels of the first, leaving only one exact patch. Its failure is preserved; a separate non-overlapping exact tie remains unresolved.

### Browser and resource limits
- Root rebuilt current source with the seven formalLibrary LLVM19 packages after verifying all50,287,888 bytes by the fixed v8 sizes/hashes. Linux amd64/glibc2.41 dependencies resolve; the complete standard build passes. No OS installation, emSDK rebuild or game-state input was used.
- Own-cloud localhost browser validation returned ERR_BLOCKED_BY_CLIENT after one bounded same-action retry. No alternate address, tunnel or security-setting bypass was used. Real-browser performance of this integration remains unperformed before publication.
- Fast capture reads8,294,400 RGBA bytes for a1920×1080 frame before exact sampling, potentially82.9MB/s at its0.1s budget. This is byte accounting, not observed browser CPU/GPU time. One canvas and one pending hash are retained; busy callbacks remain gaps. Actual deployed playback must be measured separately.

### Additional isolated recognition checkpoints
- ROM-derived wing1 command-HUD matcher was calibrated before holdout scoring from486 synthetic positives/66 negatives and then matches all five fixed frames. Its conditional parent-preserving shadow removes4200 HUD regions0/2 (254 residual pixels,49→47 proposals), while body/mallet25/34 stay unchanged. The connected-split3300 regression247→251 is retained; the parent-preserving alternative retains all five disconnected fringe pixels as one unknown parent and stays247. Sparse changed parents cannot reuse old classifications. One-pixel-occlusion controls still conditionally remove altered pixels; no exact ownership or absence certification is claimed. These HUD modules are not activated by this replay integration.
- A separate native-grid appearance query demonstrates sampling-order sensitivity:54/130 controlled top-model results change, versus5/130 from decoder-native RGB. It improves the4200 body-sized query but adds command-UI and selection-ring false agreements. All125 existing camera-comparator outcomes stay unchanged. No crop/alpha implementation defect was established and the alternative is not made the default.
- Source-only checkpoints preserve both implementations and failures. ROM/video/pixels/models/extracted assets remain private.

### Recovery inventory
- The additions Library mirror is now version49,21,032 bytes, SHA256 bf99328633441b04d4d110ca01207b63f863879fc4097f36aff13a516431d26c. A separately materialized copy and dots-tools commit6f70892434d96776c5313c710170cd87b54fb817 match exactly. Historical Work1–11 contents remain in old-version/history archives, all18 video-part declarations are unchanged, and common restore-index v8 is untouched.


## 2026-10-06 17:50 JST — Actual normal playback and source checkpoints

- Deployed 4c046656 completed the formal 1ninn video through845.029 seconds after one automatic start, without manual map/model/time parameters. Source revision and successful Pages run37431699060 were verified. Temporary browser/control transport failures did not establish environment loss; reconnecting control without reloading allowed export before stopping. Same host and required files remain present.
- Final retained timeline contains128 frames from755.246–845.012,126 background-unresolved and2 alignment-unresolved. Across the session831 observations were analyzed,703 frames evicted,11249 gap evictions recorded and37 entry candidates in the final report. Tail frames have zero completed classifications; this does not describe all evicted frames.
- Last completed body export belongs to711.379 seconds (32 sightings); separate end-input export belongs to845.012 seconds. They must not be joined as one input. End replay has zero active tracks and707 steps. Classification age133.65 seconds is not measured133.65-second computation. Current AT stays unknown and proven calls0.
- Replay-owned pixels total25,264,128 bytes under25,460,736-byte bound, excluding Canvas/classifier/browser/other memory. Six original run files were privately archived and verified; no video/pixels enter Git.
- Five source-only archives preserve cooperative HUD connection, exact capture-readback reduction, failed single-ring matching, unfinished HUD/replay integration, and same-Canvas validation gate. They do not activate these changes. HUD WIP remains explicitly unfinished even though a later isolated integration exists.
- Exact readback uses unchanged sample coordinates, reducing1920×1080 OBS read8,294,400→2,751,376 bytes with identical saved real/synthetic sampled bytes. Node copy/sample timings improve in the recorded benchmark; browser getImageData/GPU/WebCrypto performance is unverified. Same-Canvas gate keeps original first-frame pixels and allows subsequent rectangular reads only after byte equality, falling back on mismatch/exception.
- Cooperative HUD reduces longest measured blocking slice, but total work remains about226ms in that checkpoint and conditional one-pixel-occlusion limitations persist. It is not a10Hz ownership mask. Single-ring matcher fails background separation; all five real-frame results remain unknown with zero removals.
- Separate four-file gate/reseed integration reproduces and fixes target-frame history ordering and stale classification after intrinsic video-dimension changes. CSS sizing does not trigger cancellation. Source checks are recorded separately; root build/publication/real-browser verification remain pending at this entry.
