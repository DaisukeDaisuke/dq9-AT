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
