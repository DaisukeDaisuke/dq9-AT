# DQ9 AT 日報復元 2026年10月2日

対象は2026年10月1日夜から2日朝（JST）の作業。2026年10月2日07:52 JST時点で残っている文書、復旧ログ、確認結果から再構成した。失われた日報原文の復元ではなく、過去の結果と今回確認できた結果を分けた記録である。

## 現在の結論

ROM、動画4本、チェックポイント、SAV、ソース、解析・ビルド環境は再び利用できる。実入力を使う再検証を再開した。旧RAM、旧runtime入力、旧観測captureは未復旧で、AT現在状態の同定から移動案内までの一連の機能は未完成。

復元開始時点の公開文書は `e163e3366771d5d9f32e50b41a341aa65e27838a`、その時点の配信アプリの基準は `6be287bb1d37ac986fe41df61f0b80cedc477ea1`。前者は文書のみの変更で、アプリの新しい動作検証を意味しない。

## 目標と進め方

1. ブラウザ上で、map・プレイヤー軌跡・seedを入口にAT消費とspawnを再現する。必要なruntime条件は明示し、未対応分岐を黙って通さない
2. 映像から現在のmap、自位置、敵の観測候補を得て、現在AT状態の候補を維持・同定する。候補から未来を比較し、実行可能な移動案内と再観測につなぐ
3. 敵認識は「映像内の大まかな敵位置候補 → 既存の高速分類器」を優先する。不採用となったboxとspeciesのjoint trainingを再び必須経路にしない
4. 最終対象は全map。shrine限定の成果を全map対応と呼ばず、map別名、座標、個体、ATの複数候補とunknownを保持する

必要な状態にはmap、player、chunk XZ、必要箇所の高さY、camera・向き、map遷移時の消費、battle・menu、spawn timer、画面外や遮蔽中の敵を含める。未確定な値は候補または未知として残す。

## 今回確認できた復旧

- scratch側のソース、`metal.sav`、`hokusei.sav`、`map.md`、`enc.json`を確認
- 2026年10月2日07:42 JST（1日22:42 UTC）にROM、動画4本、チェックポイントを復旧。ROM `dq9_new2.nds` は268,435,456 bytes、SHA-256は `3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7` と一致
- 元のemulator observerは7ファイルすべてが変更していないlockのhashと一致。20 tests通過、ROM依存5件はskip。ROMなしのnative起動もshared memory・4 workersで通過
- 公式Ghidra 12.1.4とJava 21を復旧。CLI 12 tests、NTRGhidraの合成35 assertions、ARM/Thumbのheadless 18 queriesを通過。18件中4件は意図したエラー確認
- Clang/LLD 19.1.7で、隔離コピーの通常AT aggregate buildがexit 0。直接WASM compile・link・実行も通過。元の配信WASMとemulatorアセットは置き換えていない

上記のruntime・合成テストは、実ROMのcreator再現や実動画の認識精度とは別の検査である。復旧したチェックポイントも、失われたすべてのRAM・runtime・観測captureが戻った証拠にはしない。ROM、SAV、動画、RAM、抽出ゲームアセットはこの文書に添付・同梱しない。

## 機能別の到達点

### Mapと自位置

`6be287b`で、自動取得・追跡された同一captureの座標候補を `partyCoordinates` としてplayer trajectory、export、座標panelへ接続した。map、party slot、leaderの別候補を維持し、同一frame、取消、失敗、古いreply、可変オブジェクト共有を扱う。

復旧後の検査はcapture 403 checks、range UI 12、registration 147、marker modes 60とaggregate通過まで。実動画での新しい位置精度測定は未完了。固定minimap anchorをそのまま物理位置にしたり、画像の候補を唯一のlive座標にしたりしない。

### 敵位置候補と既存分類器

CPU ROI候補と任意DINO patch補完、opt-inの動画observerは実装済み。現状の主な確認範囲はshrineの4モデルで、rankとunknownを返す。分類結果だけから出生、native個体ID、世界位置、AT消費を確定しない。

過去の限定開発データではCPUのcoverageが11/18、補完後14/18。別窓では2/6から4/6になった。一方、negativeにも最大8候補が出て、過去の30 crop監査はbodyあり5、背景/UI 23、曖昧2だった。繰り返し閲覧したデータであり、独立した汎用精度評価ではない。

復旧ROMと動画を公開ページで実行し、CPU/WASMで既存分類器のrank/unknown表示を確認した。自然EOF（94.866秒）で停止し、Start一回で0.226秒へ戻って再生・分類を再開、明示Stopで51.969秒に一時停止した。処理表示は約0.58〜0.65秒/crop。WebGPUはadapter取得不可の明示的エラーであり、GPU実行や速度を検証済みとはしない。

固定した24サンプルの新しいCPU候補監査では、明瞭な全身10 body-frame中8を75%以上覆った。一方field候補64件中56件は注釈したbody/不確実領域と重ならなかった。分母が小さく、同じ動画由来の繰り返し観測を含むため、全map精度や敵の確定判定ではない。

### AT追跡とspawn再現

既知seed追跡、条件付き探索、known-origin／terminal-index探索、ROM由来graph・table・terrainとruntime・trajectoryを使う部分再現がある。予算停止、未探索区間、未知消費、別経路を残す。

現在の公開F06経路は **134 calls / `0xa46fab4f`**、条件付きhero XYZ `[-16220,9420,-137818]`、node 24／table 20／species 88の選択まで。timer 1019でcreator結果の前に停止する。候補地点は生成後接地位置ではなく、観測/live座標も未確定。

別の過去shrine経路には343 calls、controller return 1812までの完成prefixがある。134と343は入力・経路が違い、進捗の大小比較には使わない。1814の部分controllerを完成frameへ進めない。

失われた未公開creator研究には生成射影の報告が残るが、最終parser、allocation、heap、scale変更の検証は揃っていない。現在、復旧ROMとSAVから新しい観測を採り直し、Ghidraでcreator経路を再構成している。公開停止境界を越えた完成物としては扱わない。

## AT同定の判定で守ること

- 同じ敵の継続観測を別の抽選に数えない。capture時刻とlifetimeの対応を保持する
- 目視、分類rank、仮説だけで証明済み下限を増やさない。既存個体、失敗生成、画面外の敵、未知消費、未探索区間を残す
- 比較用の未来RAMや未来stateを再現器の入力へ流さない。入力時点で利用できる情報と、検証用の正解データを分離する
- shrineの4種をすべて残すrank一覧だけではATを絞れない。復旧後、既存 `enc.json` と本番 `monsterForRandom` でtable 30の32,768 weighted出力を列挙し、4種が全域を覆うことを再確認した
- 分類順位の改善、AT候補の減少、実際に歩ける案内の成立は、それぞれ別に実証する。敵graphを人間用walkmeshとみなさない

## 次の作業と完了条件

1. **実ブラウザで動画入力を通す**  
   復旧動画と利用可能なbackendで既存分類器を実行する。EOF停止、EOF後Start、Stop、取消、seek、source・ROM変更を確認し、同一captureの自動座標がtrajectory/exportへ出ることを検査する。完了条件は実際の入力、backend、操作、期待値と実測、残る制約が記録されること
2. **F06のcreator停止境界を進める**  
   ROMとSAVから必要runtimeを新規取得し、resource identity、allocation/link、template/component、terrain/scaleを根拠付きで照合する。完了条件はcreatorとscheduler return直後までを照合できること。同passのhero/body後続処理とは分けて判定する
3. **観測でAT候補が減る最小例を成立させる**  
   種候補と同一lifetimeの対応を持つ少数観測を使い、候補が減った根拠と残った別候補を示す。完了条件は重複抽選や根拠のない下限追加、未来state入力なしで、現在観測まで候補を更新できること
4. **移動案内と再観測を接続する**  
   自位置とATの残存候補で未来を比較し、通行可能性を確認した移動だけを案内する。完了条件は実行後の観測で予測との差を説明し、候補更新と再計画ができること
5. **部品が使える状態になってから最終UIを仕上げる**  
   ヒーローセクションなし、light theme、JA/EN、複数CSS themeを用意する。localStorageの選択themeは初回描画前に適用する。見た目の完成を、上記の機能・再現の完成判定に代用しない

一つの経路、バックアップ先、保存先が詰まっても、独立して進められる解析・実装・検査を続ける。通知への返答がないことを全作業の停止理由にしない。ユーザーPCを使う作業は、ユーザーが起きていることを明示し、MCPの準備完了を確認できた場合に限る。

## 記録の引き継ぎ

失われた日報原文、旧raw RAM、旧runtime、旧観測captureは未復旧として残す。既存文書の古い「ROM復旧待ち」は今回の入力復旧で解消したが、過去の実験結果が新たに再現されたことにはならない。

次の保存・更新ではsource SHA、入力版、実行方法、期待値と実測、停止理由を残し、日報の保存先リンクをチャットで知らせる。既存の履歴は書き換えず、新しい検証結果を追記する。

参照: [現在のチェックポイント](CURRENT_STATUS.md)、[引き継ぎ](HANDOFF.md)、[全体計画](../PLAN.md)、[動画observer](MONSTER_VIDEO_OBSERVER_20261001.md)、[敵位置候補](MONSTER_POSITION_PROPOSALS_20261001.md)、[DINO補完](MONSTER_DENSE_SUPPLEMENT_20261001.md)、[AT追跡](AT_TRACKING.md)

## 08:35 JST追記: 小さい改良と復旧経路

- shrine限定のCPU候補に、巨大な背景連結成分から暖色部分を一度だけ分割する追加処理を実装。既存候補を置換せず空き枠へ追加し、最大8件を維持する。既存の実験チェックボックスで静止画・動画の両方へ適用し、直接APIの既定は無効
- 固定した17 field-frame内の明瞭な10 body-frameは8→10件を覆った。追加16候補のうち12件は注釈領域に重ならない。別時刻の同一動画holdoutは改善なし、有効な明瞭全身は1件のみで汎化の証拠は弱い。中央値3.44→3.79ms。自動確定やAT絞り込みには使わない
- 回収した小さい2cropは既存CPU/WASM分類器でしにがみが1位。これは候補順位の確認で、校正済み正答判定ではない
- GP2/NARC/LZ入力切れでゼロ埋めされた偽の正常出力を返す問題を修正。実ROMの4,975 GP2 memberと601 enemy container等で旧版と全バイト一致を確認。未検証のminimap末尾変更は含めない
- 独立レビューと統合aggregate buildは通過。これらの新しい変更のデプロイ後ブラウザ検証は別途行う
- [新しい実ROMの生成処理観測](F06_NATIVE_RECOVERY_20261002.md)を保存。過去の失われた実験を復旧したとはせず、新しい起点・明示入力から照合する
- 非停止observer入り元ランタイム7ファイルを圧縮キャッシュとしてprivate toolsへ保存。emsdk 3.1.6も再構築可能に戻し、pthread・例外・zlibを含むWASM実行試験を通過。通常復旧はキャッシュ+Nodeで行い、ソース変更時のみ再コンパイルする
- 環境置換時は最後のデプロイ成功版と保存済みツールからクリーンに再開する。失われた未保存ソースの回収に固執しない。作業中は最低30分ごとにチェックポイントを保存し、変更を許可済みの保存先へ通常pushする

## 08:50 JST追記: デプロイ後の確認

`faf92a1f5bcbf999de9ecec731fd46666e80f50e` の [CI/deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36941759381) は成功。新しいcloud Chromeページで、自動生成された360秒/570秒のコンパクトcropを選択し、既存CPU/WASM分類器のz019b順位とunknown維持を確認した。64 pose feature再利用、新規生成0。自然EOFからStart一回で再開、Stop、seek、実験checkbox解除後の古い結果消去も通過した。

静止画確認は色管理metadataを除いた同じRGB入力での比較であり、ブラウザ動画YUV decodeとの画素一致や全動画recallの保証ではない。WebGPU adapterは引き続きこのcloud環境では利用不可。今回の検証で追加の不具合・コード変更はなかった。

## 09:14 JST追記: 認識開始の導線とエラー表示

利用者のスクリーンショットでは、動画/ROMが読み込めていても実験設定、DINO方式、場面などが未指定で開始できなかった。必要条件を一つずつしか表示せず、設定項目も離れていたため分かりにくかった。

明示的な「ほこら・OBS右上」設定の一括適用と、残る不足条件の一括表示を追加した。backendと任意DINO補助の選択は維持し、設定適用だけで再生・ダウンロード・推論しない。通常の切り抜き照合にも不足条件を常時表示する。Worker/observerのエラー名・内容・段階・stackをローカル画面で確認できるようにし、取消や失敗後のcleanupを維持した。

統合aggregateと独立レビューを通過。拡張206件のpage検査にはGPU初期化失敗からCPU明示選択・結果完了までを含む。公開後の新しい導線確認は別途行う。変更前の実cloudブラウザではGPU adapter取得失敗後もStartは有効で、GPU失敗がグレーアウトを継続させる現象は再現していない。

## 09:25 JST追記: 一括設定の公開確認と残る問題

- `b6fed2c99941bcd4e28274904b4d5512df83b120` のCI/deploy成功後、公開ページでROM・動画から一括設定→Start有効化→実CPU分類を確認した。WebGPU adapter失敗時も元のstage/name/message/stackを表示し、CPUへ明示変更して結果が再び出ることを確認した
- 利用者から「背景ノイズが多く敵が候補に載らない」という追加指摘。抽出、上限8枠、track照合順、直近4件の履歴を分けて実動画で調査中。候補上限や推論頻度を安易に増やしていない
- 認識枠を残したまま停止できない問題を確認。既存pauseイベントが自動観測停止とプレビュー消去につながっていた。画素・枠・記録時刻を同じ観測として1枚保持する修正を作業中で、まだ公開完了ではない
- ATの149-phase/134-call条件付き再現は復旧。creator returnまでの追加接続は別stageで31項目を照合中。allocation/ownership不明時の停止、optional-off互換性を確認してから公開する

## 09:34 JST追記: 枠付きプレビューの一時停止

「枠と時刻を保持して一時停止」を追加した。動画が観測時刻より進んでいても、最新の観測画素・候補枠・時刻の組を1枚保持し、動画と推論を止める。遅い推論結果は保持内容を変更しない。通常の動画pauseも同じ保持経路を使い、再開・seek・ROM/source/config変更では解除する。通常Stopは従来通り消去する。

217 page/lifecycle、34 observer、実buffer転送の独立検査と統合aggregateが通過。デプロイ後の実canvas確認は別途行う。認識ノイズの除去や敵種の確定を追加する変更ではない。

## 09:46 JST追記: 条件付きcreator returnへの接続

元の1200-frame状態・ROM・記録された制御から、149 phases、134 calls、seed0xa46fab4f、scheduler timer0までを接続した。species88/slot112/serial2、XYZ[-30665,9434,-91287]、scale226など31項目を非停止観測のreturn値と照合した。独立レビュー、root統合build、ROMを使った149 checksが通過。

allocation/ownership条件が不明なら従来の134 calls/timer1019で止まり、optional packetなしも従来と同一。生成物は条件付きで、live inventoryや同pass後続hero/bodyには接続していない。Yaw0は元snapshotに無かったDTCMを別の一致起点replayで補った入力で、継続中の不変性は明示仮定のまま。

private再現helperに一度、後時点のpool pointerを入力へコピーする不備があった。元heapから導出するよう修正し、後時点値は比較専用にしたうえでnative255チェックを再実行した。公開10ファイルのhashはレビュー中に変わっていない。デプロイ後のブラウザ確認は別途行う。

## 10:09 JST追記: 識別へ渡す枠の修正とAT探索要件

- 同じ78.75秒の映像で、敵を含む表示1番が未処理なのに背景の2番を識別へ渡す問題を再現。最初の処理を表示1・2の順に優先し、残りは有界の待ち順で処理する。切り抜き座標計算・分類器・頻度上限は変更しない
- プレビューは上位2枠のみ表示し、内部候補は保持する。実際の識別cropには取得時の元番号・時刻・ROIを表示し、現在の枠との誤対応を避ける。一時停止の画素・枠・時刻保持を維持する
- 実動画からの8種類の推論時間fixtureで236件の切り抜き画素を検証。47 observer、224 page/lifecycle、統合buildと独立レビューを通過。100ms等のfixtureは実WebGPU測定ではない。背景の分類、白い個体の抽出漏れ、直近4件の履歴からの押し出しは残る
- [AT特定・総当たり要件](AT_IDENTIFICATION_SEARCH_REQUIREMENTS.md)を追加。未知seedのlow31全域、既知originからのindex範囲、bit31の2状態、イベント後から映像現在までの未知消費、hard除外とsoft順位を定義。既存探索の回帰を再実行した。全域性能測定と映像由来の現在AT特定は未完了
- 既存creator release `3a49749acb3d77ddcdcc71cea657a51aeb2f61cf` の[CI/deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36947907324)成功を確認。cloud Chromeでlow31/既知originの合成例、reset、候補保存上限の表示、first-spawn入力不足時の無効化を確認。private creator fixtureのブラウザ実行とは別
- 今回の枠修正は公開後の実ブラウザ確認をこれから行う

## 10:27 JST追記: 認識修正の本番確認とAT探索の性能測定

- `fbc499c2858772b2e6054b3d87b019ae97fc0845` の[CI/deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36949693816)が成功。cloud Chromeで実ROM312モデル、既存動画clip、CPU/WASM推論を使い、表示2枠／内部8候補、取得時番号・時刻・ROI、保持pause、resume、seek消去を確認。識別精度やWebGPU速度の保証とは別
- [有界AT探索ベンチマーク](AT_SEARCH_BENCHMARK_20261002.md)と再現runnerを追加。既存engine/kernelは無変更で、14 workloadを各4,194,304件×3反復。37件の独立BigInt oracle・planted真値・境界・中止・保存上限検証、既存47/634テスト、独立レビューと統合先のrunner smokeが通過
- low31とindexのdomain・計数単位を区別し、同じ8 masksのgap幅拡大によるコスト増加を計測。全域所要時間への外挿、映像の現在AT確定、ブラウザ速度の実績とはしない
- 1ninnの2分5秒付近でみいらおとこを見逃すという追加報告。実映像の抽出・選択・分類の境界を確認中で、原因未確定。方式選択の調査に向けた依頼文も用意した


## 10:32 JST追記: 合成条件でlow31全域を実走査

[全域走査の記録](AT_FULL_CYCLE_SCAN_20261002.md)を追加。2イベント・gap1の合成述語で、low31全2^31クラスと、既知合成seedの同じ出力クラス1周期を実際に完走した。portable runnerの実測は8.474524秒／9.650933秒、候補数は両方式で159,739,990一致、未探索尾部0。小範囲測定からの外挿ではない。index候補保存は7件に限定し、全候補保存済みとは表示しない。

実装・WASMは無変更。出力クラスと32bit状態を区別し、現在映像ATや絶対indexの特定とはしない。独立レビューでLCG周期、前イベント境界、全checkpoint区間、候補件数、実測時間とhashを確認した。

2分5秒の認識調査では、対象モデルz021aが含まれ、敵のCPU候補枠も存在する。600ms推論fixtureで待ち時間の長い背景枠が未処理の上位枠に先行する問題を再現。実ユーザーGPU速度とは別の条件付き再現で、選択順の追加修正を検証中。


## 10:36 JST追記: 2分5秒の選択順を再修正

[見逃しの調査](MUMMY_WINDOW_20261002.md)で、待たせた背景枠が処理可能な上位1・2を追い越すケースを再現した。CPU候補1・2を厳密に優先する2ファイルの最小変更を実施。600ms fixtureの敵crop要求は0→2、既存75～85秒の比較に悪化なし。統合build、49 observer、224 lifecycle、独立レビュー通過。

実DINO照合では125.75/126.25秒cropはミイラ男が1位、125.00秒cropははにわナイトが1位だった。選択不備と分類混同を分離し、類似度を確率として扱わない。任意DINO補助経路は今回の変更対象外。公開後の動作確認は別途行う。

## 10:42 JST追記: 上位枠選択の本番確認完了

`8f18bbe84890715e69f6580e898a96da69d0db7f` の[CI/deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36951813772)と公開moduleのbyte一致を確認。実CPU/WASMの自動観測で125秒周辺のミイラ男cropを1番から識別へ渡し、複数cropでミイラ男1位となった。一時停止8秒保持・resume・EOFも通過。使用clipは121～129秒の再圧縮版で、固定PNGfixtureやユーザーGPU環境とは区別する。

別cropでははにわナイトが僅差で1位になるため、種認識の完全解決とはしない。[詳細](MUMMY_WINDOW_20261002.md)に時刻・類似度・検証範囲を記録した。


## 11:22 JST追記: 味方の方向転換・停止・再移動とAT一致

[F06の限定キーボード経路](F06_KEYBOARD_ORIGIN.md)を実装。新しいframe1990起点から、Down固定とDown→Right→キー解除→Downの2経路を、実際のcreateFirstSpawnReplay→advance→F06 continuationで比較した。各30回の移動前・29回の移動後のXYZ／角度／ノード／速度、timer、2回のAT消費がnativeと一致。seedは0x16e2ca29→0x9cdec1ae→0xa46fab4f、node24／table20／species88で生成結果の手前まで。

キー解除後に速度-7が1pass残る正常な減速をsource02032fc4に合わせ、movementByte0だけ非正速度を0へ戻す。負のactive/special速度は従来どおり未対応。Down/Right/NoneのROM由来方向値、明示clockとkeyboard gateを使い、nativeの将来位置・角度・seedは入力にしない。

従来の1200起点はD04の実測姿勢を与えた条件付き経路であり、将来の姿勢を予測入力にしない新しいfresh-origin検証とは区別する。旧Down packet、従来149-phase/134-callの条件付き経路は互換維持。新規UIや任意マップ／任意状態の読み込みには拡張しない。

8組のobserver有無ペアで、各64 frameのCPU／画素／状態と5点のfull RAMが一致。独立レビューで595 portable assertions、101 release checks、factory/native比較と入力の分離を確認。root統合buildも成功し、レビュー済み10ファイルと生成WASMのhash一致を確認。公開後のブラウザ確認は別途行う。

別の生成後調査では、nativeは次の生成抽選で136 callsまで到達することを確認したが、再現側の出生後bodyは未接続のまま。先行調査で取り違えたdescriptor-arrayと内部animation objectの参照を訂正し、追加条件なしでstatus bit2のclearを導出した。ここから全body対応済みとはしない。再現用ソースと訂正記録は非公開の既存ツール保存先にバックアップ済み。


## 11:35 JST追記: 上・左の移動と生成ノードの変化

既存のDown/Right/Noneに、ROMの入力reader・分岐命令・方向tableを検証してUp12868／Left19302を追加した。単なる許可リスト拡張ではなく、同じfresh1990起点の上転回・左転回・停止・再開をnativeと実factoryで比較。各30pre／29postのXYZ／角度／node／speed、timer、2回のAT entry/returnが一致し、上ではnode25、左ではnode24が選ばれた。map20006を維持し、遷移は発生していない。

下直進・右転回の既存projectionはwhole-object同一。独立レビューで入力分離、全40箇所の生RAM／画素／CPU等のペア、source binding、108 keyboard／120 originなどの回帰を確認。root統合buildも通過。斜め・touch・カメラ変更、生成結果以降のbodyは引き続き対象外。

一つ前の08e19525は[CI/deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36955480109)後に本番画面でも下／右の2経路を確認。reset・再初期化・不正入力からの復帰も通過した。今回の上／左の本番確認は別途行う。[対応範囲](F06_KEYBOARD_ORIGIN.md)。


## 11:55 JST追記: 上下左右の本番確認と生成後の調査

`1ae134b5fec598fbd45b51f1e119f2f780b8f03e` の[CI/deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36956415149)成功後、本番cloud Chromeで上／左の新規経路、下／右の回帰、reset／再初期化、斜め入力の拒否と正しい入力への復帰を確認した。上はnode25、左はnode24で、両者とも30 stages・AT2・seed0xa46fab4f・timer1019・table20/species88、生成結果の手前で停止する。

生成後の調査では、初回アニメーションが内部objectのnull／ownedを決め打ちせず、共通して分かる状態だけを導出できることを確認。後続bodyのtimer33／counter1は、その境界まで初期状態が維持されることを条件にした局所結果であり、製品のbody継続はまだ許可しない。

重要な時点差として、creatorのcompletedFrames2052とbodyの2053は同じcontroller呼出しに含まれる。フレーム番号が変わっただけで、新しいscheduler更新や余分なdeltaを加算しない。途中のpending-record処理が敵のdelay値を書き換え得るため、元の4つのmap値がその処理まで保たれるか、コピー・復元・packet経路を調査中。offlineだから無効と決め打ちしない。

公開ソース・日報は現在のmainへ、再測定用ヘッドレスhelperと復元手順は既存の非公開ツール保存先へ通常pushし、remote反映を確認している。ROM／SAV／RAM／画像／動画／抽出資産は含めない。


## 12:35 JST追記: 初回bodyの解析ソースと復元用チェックポイント

初回animationのnull／owned両分岐、同じcontroller呼出し内の2052→2053、元1200のpending-record保存条件、別起点1990のtransfer除外を、再現helper・query定義・復元手順として保存した。元の1200解析と新しい1990解析の前提を混ぜず、実行に必要な私有入力は別途復旧・再生成する。

fresh1990の解析では、元の4方向profileにtransfer objectがqueueされず、buffer pointerもnullであることを確認した記録がある。特定したtransfer初期化・mode設定・enqueueはnonzero-global分岐内にあるため、既存のoffline／scene再入場なしの範囲ではその復元経路を除外できる。1200起点の保存証明を修復したことや、全writer／全経路を尽くしたことにはしない。製品のcreator後bodyは未接続で、134 calls／seed0xa46fab4fの境界とfutureActorTicksPermitted:falseを維持する。

非公開の既存ツール保存先へ45のtext-onlyファイルを通常pushし、remoteのcommitと全blobの一致を確認した。既存231ファイルは変更していない。

今回のバックアップ検査はsource-onlyのbyte/hash、UTF-8、query JSON、秘密情報pattern、Node／Python／shell構文まで。報告済みの11,291 primitive checks、15,324照合、198 sampled comparisons、8組のfull-RAM一致などを今回再実行したとはしない。ROM／SAV／RAM／画像／動画／抽出資産、raw event・query responseは保存対象から除外した。


## 13:09 JST追記: 認識監査の独立再現と解析ツール保存

Pro2完全ZIPの全33 memberのhashと13フレームPNGの一致を確認し、既存CPU候補抽出の13frame×中央除外ON/OFF＝26条件を再実行した。proposals／excluded／coverageが元の結果と全件一致。別途、完全動画から取得した10frame×ON/OFF＝20条件、component core診断2件、後段engineの拒否2件も保存済み結果と一致した。後段は中央重複ROIをDINO初期化前に拒否し、getDino呼出しは0回だった。候補生成だけの変更では複数段の中央guardを解消できない。

完全1ninn.mkvは330181795 bytes／SHA256 e9d3d37c62500d4a170eb38cca92361b66a9cfc0a61b91db1ef1174260a0c019。先頭324927488 bytesのSHA256はPro2記載のd5238b3e28fcca51970da5c3b32ada2c650a4a76093cfc825879759a7646876cと一致し、Pro2入力は5254307 bytes短いprefixと確認した。一方、実PTS125.846／125.896秒の操作画面cropは完全動画とbyte一致しており、この局所的な候補消失の診断は維持できる。全動画解析や新モデルの認識精度を証明する結果ではない。

3報告の和集合は基準・派生・補助・将来学習を含む40比較単位で、40個の完成検出器とは数えない。3本のWork用指示を作成・提供した段階であり、Workでの実行完了とはしない。製品の認識実装は変更せず、再現script・入力hash・派生結果・復元手順の23 text-onlyファイルを既存の非公開ツール保存先へ通常pushし、remoteの全blob一致と既存276ファイルの保持を確認した。ROM／SAV／RAM／動画／PNG／RGBA／抽出資産／私有download URLは含めない。


## 13:40 JST追記: fresh1990の実factoryをcreator returnまで接続

fresh1990起点の下直進・右転回／停止・上転回・左転回の4経路で、任意のoriginal由来creator入力を実際のcreateFirstSpawnReplay→advanceへ接続した。各30 scheduler rows、AT2、seed0xa46fab4f、timer0、slot112／species88／serial2／e0=0までを再現する。従来packetの出力はbyte同一で、旧1200起点も維持した。比較用の将来RAM・eventは予測結果の固定後だけに使用し、入力は各original1990とROM、明示された到達clock・既存条件に限定する。

独立レビューで発見した外部serial pointerと元heap／descriptorの重複を拒否する狭い入力整合性修正を入れ、再検査した。最終の統合aggregate buildはexit0、独立factory137 checks、関連14回帰、original/native1128 checks、実factoryのNode DOM72 checksが通過。別の4経路native照合1340 assertionsも通過した。Node DOM検査は実ブラウザ・画素検査の代用ではなく、この変更の公開後ブラウザQAは未実施である。

今回の到達点はcreator／scheduler returnで、同passのHERO／bodyより前で停止する。2052→2053を別controller tickとして扱わず、postHeroや追加scheduler tickを挿入しない。continueNewborn=trueは拒否し、futureActorTicksPermitted／worldStepResolved／visualStateResolvedはfalseのまま。到達clockと既存条件を明示仮定とした限定再現であり、生成後body・full-world対応や一般的な状態保存証明ではない。

レビュー済み4ソース／文書とこの日報だけを公開対象とし、生成WASMは変更しない。ROM／SAV／RAM／動画／画像／抽出資産／raw native events／GhidraDB／私有download URLは含めない。[対応範囲と入力契約](F06_KEYBOARD_ORIGIN.md)。


## 13:50 JST追記: ChatGPT Workへの依頼と深夜のdots単騎作業

記録時刻: 2026年10月2日04:50 UTC／13:50 JST。

- dotsでは時間がかかりすぎる実装は、本人が起きていると確認できた場合に限りChatGPT Workへ依頼する。Workの起動・操作は本人が行い、dotsは依頼文・入力の準備と、返ってきた成果のレビュー・統合を担当する
- 深夜作業は引き続きdots単騎で進める。Workを使えないことや本人が就寝中であることを理由に、作業全体を停止しない
- dots側で「Workでしか作業できないため作業不可」として止めず、許可済みのcloud環境で進められる解析・実装・検査を続ける
- 必須入力の不足や権限など、実際に進行を妨げる条件は対象と理由を具体的に記録し、その条件に依存しない作業を継続する


## 14:02 JST追記: ROM算術・同一mapのscript gate確定と実ブラウザ確認

ROMの乱数整数化は、binary64の除算、乗算を別々に丸めてから整数へ切り捨てる。metaru_nasi.dstから入力を注入した11例で、元ROM・本番JS・既存WASMが一致した。max93／r17970では50となり、厳密有理数の51とは異なる。6コード領域の一致も確認済み。host側のmax1〜93／r0〜32767、3,047,424組では最初の差がmax93だった。検査したenc.jsonの283表はmaxRand≦35なので、この反例を本番weighted選択のfalse negativeや修正の根拠にはしない。自然spawn・呼出し順・timingの再現試験ではない。

original1990／map20006／通常offline／scene再入場なしの範囲では、元のevent tableがnullで、ROMのtriggerF全90 commandにもmap20006行がない。同一mapのreloadが起きても空tableを保ち、event由来のactivationを除外できる。562 ROM/parser checksと214 source checksを記録した。過去にqueueされたmenu／encounter handler、controller word全体の保存、creator後のbody接続は引き続き未完了で、製品の継続条件は増やしていない。

04:55 UTC分のsource-only checkpointを非公開toolsの既存mainへ通常fast-forwardで保存し、22 text filesの全blob一致と既存335 filesの保持を確認した。復元手順・manifestを含み、未完のcontroller-writersは除外した。元probeに埋め込まれていた12 bytesのROM命令列は保存せず、手元の入力から読み出してhash確認する派生scriptに置き換え、その差分をmanifestに明記した。今回のbackupで元のnative実験を再実行したとはしない。ROM／SAV／DST／RAM／動画／画像／抽出資産／raw response／byte dump／私有link／秘密情報は同梱していない。

別途、公開creator版9df2f2bdac1347945e50405d4c04665556501262を実cloudブラウザで確認した。4方向のcreator結果、旧creatorなしpacketの停止、reset・再初期化・新fileでの消去、paired schema不足／誤入力／不正JSON／heap・descriptor serial aliasの拒否と復帰、未対応bodyの明示拒否、ROM解放時の状態消去を通過した。4方向とも30 scheduler段階、AT2／seed0xa46fab4f／timer0／species88／slot112／serial2でcreator return後に停止し、application由来のerrorはなかった。これは実ページの条件付きfactory/UI確認である。配信moduleへの直接アクセスはERR_BLOCKED_BY_CLIENTとなり、配信byteの独立照合と通信監査は未実施。body継続・全world・live現在状態の完成を意味しない。この追記では公開runtimeを変更せず、13:50 JSTのWork依頼・深夜単騎方針もそのまま維持する。


## 14:32 JST追記: Work2監査の独立再現と未接続bodyの復元保存

Work2の提出済み採用527ケースは、固定commit `4d174d2a57990817881b01d485ae6d2358737840` に対する独立再実行ですべて再現した。現行runnerが生成する追加2ケースもpassし、採用合計529件、fail0件だった。別枠の実時計補助2試験では、実際の計算が進んだあとでも正のack前に取消すと、返る探索済み数・候補数が0のままで、workerの終了も確認した。参照器selftestは3,111 checks。これは有界条件での照合であり、全入力のno-false-negative証明、hard real-timeの予算保証、実ブラウザ／download、自然spawnやROM実行の新規保証ではない。明示された模擬時計の論理試験を実時計の性能測定へ混ぜず、coverage tagや終了検査などのreport／harness制約も残す。

初回bodyのdraftは未接続・未受入で、`sourceBound:false` のまま復元用に保存した。重要な訂正として、host側のtouch releaseだけではgame側release byteが0に保たれるとは言えない。ARM7 queue-full時のinvalid sample fallbackとcontact／releaseの相関を残し、game側のrelease consumerとcandidate保存条件を引き続き調べる。creator後のbodyが完成したとはせず、追加scheduler tickやfuture body継続を許可しない。

05:25 UTC分のチェックポイントは、凍結済み30ソース／証跡ファイル、allowlist2、復元・検査文書4の計36 text filesを既存の非公開tools mainへ通常fast-forwardで保存し、remote commit・全新規blob・既存357 filesの保持を確認した。backup時の確認はhash／UTF-8／JSON／8構文検査と独立source-only検査で、上記の監査やnative実験をbackup処理で再実行したという意味ではない。ROM／SAV／DST／RAM／動画／画像／抽出資産／raw source dump／私有download URL／秘密情報は同梱していない。公開変更はこの日報追記だけで、runtimeは変更しない。

斜め4方向を本人が起動する外部Work4へ依頼する指示書も準備・提供した。まだ実装完了ではなく、私有復元情報を含む指示書本体は公開リポジトリへ追加しない。13:50 JSTに記録したWorkの起動担当と深夜単騎の方針は維持する。


## 14:49 JST追記: 全マップ共通AT台帳の未解決候補を保持

目標は「全マップでAT下限を証明し続けたい」。既存のATSessionを維持し、マップ横断の観測台帳で未解決の結果を不可能と誤判定していた箇所を修正した。trap・区間重複・区間欠落・不正なtable構造は候補として残し、確定した別種だけを除外する。従来は先頭候補を落としてconditionalBoundを1から2へ過大に進め得た。tableMatchesには確定一致だけを記録し、未解決部分は別途残す。実経路はat-panel→at-worker→ATSession.observeMonsterで、未使用の旧weightedStateConstraintは変更していない。

起動から証明済みのlowerBoundは今回の観測修正では増やさない。マップ変更、曖昧な場所、映像・入力の欠落、未探索の末尾を維持し、重複観測と重複したboot prefixの二重加算を拒否する。独立検査でも既知table・欠損tableの旧snapshotとのbyte一致、3マップの連鎖、自然生成仮定の有無、境界位置、失敗時の原子性を確認した。全マップのconsumer到達、新規の自然生成、seed epochの連続性、現在状態の確定を証明した結果ではない。

修正前のred再現後、最終session suiteは327,798 checksを通過。全32,768出力のcompiler照合、malformed／sparse table、公開table、保存・復元、production WASMの初回出力を含む。独立の手計算6ケースと追加61 assertionsも通過した。build.sh内37本とcompiler試験1本の計38 Node commands、識別kernel2本の固定hash／ABI検査が通過。公開前に現行mainのsource依存へ照合し、C／WASM再コンパイルを含むaggregate buildも追加実行し、exit0で通過した。repo格納の旧WASMを未ビルドで使う場合の既存export不足と、CIでsourceから再生成する経路は区別する。生成WASMは今回のcommitへ含めず、実ブラウザQAとnative全マップ実行は未実施。CI／deployの成否はこのcommitに対するworkflow結果で別途確認する。

旧コードが誤って引き上げたversion1の保存conditionalBoundは、復元時の再計算との不一致で安全に拒否される。元ファイルと証拠eventsは残り、同じseed・table資源で再評価する復旧余地はあるが、自動移行や保存数値だけの書換えは実装していない。正しい既存snapshotは復元可能。

Nodeの参考計測では50,000位置の観測中央値は1表4.56ms、4表8.26ms。各表32,768出力の分類により1位置でも1表1.23ms、4表3.74msかかる。各30 sampleの比較で同時負荷は未制御、実ブラウザ性能やnative timingの保証ではない。

次の正の下限接続には、観測時点までのconsumer到達、map依存の候補table条件、boot／seed epoch、順序・非重複、許容全経路の最小値、復元可能な根拠を揃える必要がある。既存F06の条件付きcreator prefixは再利用候補だが、未接続のfirst-body draftは最小追加AT0であり、これを全マップ下限の前提や優先課題にはしない。今回の公開対象はレビュー済み4ソース／文書と日報追記だけ。既存の日報・Work方針は保持し、ROM／SAV／RAM／動画／抽出資産／秘密情報／私有リンクは追加しない。[AT台帳の対応範囲](AT_TRACKING.md)。


## 15:17 JST追記: マップ共通のNPC所属条件を独立モジュール化

全マップでAT下限を証明し続けるため、NPC定義の固定除外条件、配置IDの照合、無条件opcode3の挿入・削除・順序を、既存parserを使う共通moduleとして実装した。raw32の定義IDとbyteに格納される配置IDを区別し、重複配置の順位付け、条件付き命令、未知のmodifierは未対応として止める。source上の所属候補を条件付きで求める段階であり、実際のheap／配置list／loader到達／constructor完了を確定しない。

D06M02／map7602では条件付きkind1定義が1件となり、H15／map16500では未対応opcode6により所属をunknownのまま保持する。source件数を実行済みAT消費数へ変換せず、provedMinimumATは0、actualATConsumedはnull、bootProofはfalseを維持する。ATSessionへの正の下限接続や実worldの変更はない。

合成fixture170 checks、独立3,578 assertions（無条件配置のランダム500ケースを含む）と既存回帰が通過した。独立レビューは元ROM命令との照合とD06M02／H15の再実行も実施済み。公開前には170 checksと独立3,578 assertionsを再実行し、既存Clang／LLD19の通常aggregate buildもexit0で通過した。新しいtestをbuild.shに追加し、以後のCIでも維持する。セントシュタインのnative検証は別途進行中で、全マップの実行到達や正の下限証明が完成したとはしない。

今回の公開対象はレビュー済み新規4ファイル、testのbuild接続、日報追記のみ。ROM／SAV／RAM／抽出資産／私有flag値／私有リンクは追加せず、生成WASMはcommitしない。既存の日報とWork方針は保持する。[入力契約と未解決の境界](NPC_MEMBERSHIP_PROJECTION.md)。
