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


## 15:55 JST定期保存の追記: セントシュタイン5状態の実測と来歴の限界

15:17 JST時点で進行中としたセントシュタインのnative検証は、元SAV5件の限定実測まで完了した。町のparty／solo／馬返還後の3ケースでは、controller初期化の閉じた区間が11／11／13 draw、別のactor初期化が11／11／12 drawで、初期化小計は22／22／25だった。allocator、controller initializer、直接AT entry／return、閉じたcaller returnを同じcapture内で対応付けた。種別の異なるNPCを一律2 drawとせず、実際に確認した2種類の初期化を分けて数える。

武器屋map104はNPC51がmode8、NPC24がmode0で、entry初期化は計4 draw。追加の無入力600 frame（1911〜2510）ではNPC51の方向候補選択とthreshold再抽選の2周期、計4 drawを観測した。道具屋map108はNPC218／20がともにmode0で、entry初期化は同じく4 draw、追加600 frameのATは0だった。道具屋の継続0という観測で初期化4を消さず、永久・全consumerの0へ拡張しない。方向選択とthreshold再抽選は別のcallで、毎frameの固定消費や固定周期ではない。

町1,185 checks、店855 checksを通過。observer-off／onのCPU9／CPU7、画素、状態、full RAM比較が一致し、event sequenceの欠落とdropは0、元SAVのhashも維持した。configured siteとこの入力・観測窓での結果であり、全マップの保証、起動からの全seed-setter履歴、boot下限の確定、未来の継続予測完成を意味しない。以前の町captureを店検査のために再生成したわけではなく、今回の定期backupでもnative再実行・runtime再buildは行っていない。

重要な来歴制限として、Stornway flagsのsource条件とdescriptor順11／11／13の照合は、constructor-entry後のsnapshotを用いた条件付き評価である。配置が作られる前の原状態からmembershipを生成できたというproducer証明ではない。後時点のflag／list値を元入力へ戻して、その不足を埋めたことにはしない。新しいpre-placement captureとstory-membership codeは進行中・未凍結で、今回の保存・完成判定から除外した。

元ROMで確認したstory／questのRAM layoutと関数注釈は、dqix-functionsの既存mainへ追加公開済み。commit [7eaf0f13](https://github.com/DaisukeDaisuke/dqix-functions/commit/7eaf0f13cb0d93425722afc6120ce1c2c1eed19b)の[CI](https://github.com/DaisukeDaisuke/dqix-functions/actions/runs/36972911083)は成功し、[layout文書](https://github.com/DaisukeDaisuke/dqix-functions/blob/7eaf0f13cb0d93425722afc6120ce1c2c1eed19b/docs/jpn-story-quest-flag-layout.md)を確認できる。これはruntime layoutの注釈で、私有の現在flag値やSAV serialization offsetの公開ではない。今回dqix-functions自体は変更していない。

武器屋NPCの既知開始snapshotから次の継続ATを予測するWork5指示書を本人へ提供し、その同じ文書1件を既存の非公開tools保存先へ保存した。指示書の提供はWork5実装完了を意味しない。元入力IDとprivate取得先を含む文書本体は公開日報に同梱しない。既に保存済みのsource checkpoint、共有復元書、追加台帳は変更・重複保存していない。Work3最終成果は取得・検算中で、境界検証も未完のため、未確定数値を結論へ採用していない。

今回の公開変更はこの日報追記のみ。既存の記録とWork方針を維持し、runtime／WASMは変更しない。ROM／SAV／DST／RAM／画素／動画／抽出資産／raw flag・event／私有download URL／秘密情報は追加しない。


## 16:42 JST追記: Work1／2／3の受入結果を本番codeへ統合

独立レビューを通過した3系統を、既存本番経路と通常buildへ統合した。調査結果だけを保存する段階から、利用中の処理と以後のCIで働く変更へ進めた。今回の対象は以下に限定する。

- Work1: CPU候補生成でwarm-split由来の候補を選別通過数へ含め、保持数と枠上限による省略数を正しく計上する。本番認識UIには同じcaptureのCPU選別・保持・省略と入力切り抜きの特徴計算到達数を表示し、未計測と0件、保持中／履歴／現在frameを分ける。実候補の矩形・順序・priority、認識classifier、閾値、gate、最大2枠表示は変更していない。認識精度改善の主張ではない。
- Work2: 受入監査でruntime defectが確認されなかったため、engineを変更せず、実際のhost／Worker／固定WASMを使う取消・checkpoint・coverage回帰と独立binary64 oracleを通常buildへ接続した。途中取消やWorker errorで未ackの仕事を探索済みと数えず、最後にackされた候補・範囲・materializationを保持する契約を検査する。新しいtestとhelperの変更でもPages CIが起動するようpath filterへ追加した。
- Work3: 本番createFirstSpawnReplay入口が、利用者のローカルROMにあるUpdateATの全40命令byte＋12 literal byteを固定SHA-256で検査する。以前は実入口を通過していた算術命令の変更を、replay生成前に拒否する。同期API、既存ARM9 decoder本体、元ROMでのreplay結果は維持する。ROM命令byte自体は追加していない。[source結合の範囲](AT_SOURCE_BINDING.md)と[Work2本番回帰](AT_WORK2_REGRESSIONS.md)を参照。

最終統合版で、既存Clang／LLD19.1.7による通常buildを07:39:19〜07:39:41 UTCに直列実行しexit0。既存Nodeチェック38本をすべて保持し、新規4本を加えた42本が通過した。既存ATSession 327,798 checksも通過し、正の下限・map表示選択・seed epochの意味を変更していない。生成WASMはcommit対象外とした。

統合後の再検査では、Work1の会計10件、Node DOM／lifecycle 230件、既存proposal・warm-split・recognition・observer計142件が通過。独立レビューでは変更前後787ケースの候補とtrackingの完全一致も確認済み。Work2は24 Worker cases／3,156 assertions（実clock22件、隔離した模擬clock2件）、binary64 196,795 assertions、65,536 scalar比較、65,536 mask出力、18 Worker casesが通過した。独立レビューでは実production sourceへの7種類の故障注入をすべて検出した。有限範囲の検査であり全周期探索や任意入力の完全性の証明ではない。

Work3はportable 529 checksと元ROMをローカル入力した695 checksが通過し、52 byteすべてを1 byteずつ変更した場合の拒否、同じbufferの変更後再検査、元入力不変を確認。統合後の完全replay出力も、既存の2入力で30 phases／2 drawと149 phases／134 drawが変更前と一致した。固定hashはこのleafの同一性だけを結合し、caller到達、seed setter不在、現在seed、全mapのAT下限を証明しない。

公開前のNodeとローカルROM検査は完了した。公開commit固有のCI／deploy結果と公開ブラウザ確認は、この追記時点では未確認として別途確認する。Node DOM検査をブラウザ実測と扱わない。ROM／SAV／RAM／動画／抽出ゲーム資産／秘密情報は追加せず、既存日報の本文をそのまま保持して追記する。

## 17:28 JST追記: Work1–3の配信後確認と再開用チェックポイント

Work1–3の公開commitは `6d8e38582c678823aa9882e2c67701a3da4c6176`。[該当CI/deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36980155810)は2026年10月2日07:45:26 UTCにsuccessとなり、remote mainと公開sourceの一致も確認した。前節の「公開commit固有のCI／deployは未確認」はこの結果で解消する。

### 公開ブラウザーで実測した範囲

07:49–07:57 UTC、cloud Chromeの公開認識ページで、この検査用に作った矩形画像と6.2秒の合成動画を操作した。暖色分割だけの1候補、9候補を8件保持／1件省略、元候補11件を8件保持／3件省略、0候補を確認。繰返し生成、8番選択、画像差替え、中央除外設定変更、候補消去、動画0／3／5秒の手動固定、再生位置と固定時刻の区別、最後のreloadで旧候補と旧件数が混在しないことを確認した。

固定画像の候補会計と操作は13項目PASS。軽微な案内不整合が1件あり、画像差替え後に固定画像と有効な候補生成ボタンがあっても「先に動画のフレームを固定するか画像を開いてください。」が残る。候補生成後は正しく更新し、古い候補・件数の残留はない。今回の変更による回帰か既存かは未判定で、修正は未実施。

NDS／モデル一覧を読み込まない合成入力の検査なので、自動liveの2枠描画、観測を保持する一時停止／再開、実分類の特徴計算件数・履歴・遅延応答は未実行。手動の動画固定をその代用合格にしない。ROM・ユーザー動画を用いた認識精度、WebGPU性能、AT連携の新しい保証もしていない。ブラウザーのscript参照には完全なcommit SHA表示がなく、releaseとの結びつきは別途確認したCI／remote証拠に依存する。

### Work4の受入監査

固定cameraYaw=0の斜め4方向source patchは、隔離copyで適用と通常aggregateが成功。keyboard portable 516 checks、元ROMをローカル入力した517 checks、origin 208 checksを独立実行した。原ROMの同時押しbranch、direction byte、table、target writerも照合済み。patchの5変更対象は監査基準と一致し、Work3追加との適用整合も確認した。

本番への統合・公開はまだ行っていない。F06 native全profileのraw／比較器等が揃っておらず、報告の内部整合性確認とnative完全再実行を分ける。ほこらのUpRight+Rはcontroller-end XYZが25/32一致、計31 field差分という既知失敗を維持する。camera回転、一般world/body再現の完成とはしない。再開用のprivate保存には未適用source patchと監査文書だけを収め、RAM・events・抽出物は入れない。

### Work5中間成果と次の作業

中間提出の報告では、既知開始状態から各600 frameの継続について武器屋map104は予測／実測4 draw、道具屋map108は0 draw、比較対象の状態差分0。これは提出側のnative比較報告で、この保存作業で再実行した値ではない。現行依存関係を使った中間互換性検査は新規9ファイルに既存pathとの衝突なし、予測器20件＋抽出器5件がPASS。最終回帰・最終patch・本番接続は未完了で、候補配列の直接stack採録や未対応branchを残す。条件付きdrawをworld minimumへ昇格しない。

callstack移植の対象は現在のheadless実装である。ブラウザー向けの古い指示案を置き換える修正版が完成したため、既存Node API／非停止observerの接続先を明記した指示書をprivate checkpointへ保存する。移植実装そのものは未完了。既存BMMP座標の索引化・可視化も新しい隔離stageで着手したところで、実装完了・公開済みとはしない。

今回の公開変更はこの日報追記だけ。稼働sourceと配信内容は変更しない。private再開用checkpointはsource／監査／進捗の明示allowlistだけを保存し、ROM・SAV・DST・RAM・動画・抽出ゲーム資産・秘密情報・Work5 private ZIPを含めない。`dqix-functions`は新しい確定注釈の差分がなく、`7eaf0f13cb0d93425722afc6120ce1c2c1eed19b`を維持する。変更中のstageを完成物として固定せず、重複・空commitを作らない。

## 17:45 JST追記: 既存BMMP座標の索引化と地図表示

既存のBMMP座標groupを再利用し、map IDごとの表示先を保持する端末内索引と、地図上の固定表示点を追加した。地図ブラウザーとマップ認識の参照表示で、「配置」から元の画像候補と固定表示先を選び、固定表示点のON／OFF、座標対応JSON／CSV保存を行える。複数表示先を一つに潰さず、既存の画像認識候補records[].candidatesは変更しない。索引作成に失敗した場合も元の地図候補による表示を継続する。

ローカルROMから得る関係は1,267件（固定表示888、物理X/Z379）、493 map ID。明示groupのない380 IDは未解決として残る。これは屋内数や通行可能地点数ではない。固定表示点は建物等の代表点であり、室内NPC／プレイヤー位置やdoor triggerではない。物理X/Zのgroupには別途観測した座標がない限り点を置かない。

画像寸法とcrop原点は、実ROMの全283 descriptorで既存WASM合成器と一致した。ただし世界座標から画像pixelへの較正は独立実測しておらず、画面とexportに未校正・暫定値を表示し、transformVerified／runtimeContextVerifiedをfalseのまま保持する。範囲外の点を画像内へ丸めず、座標情報が不完全ならunknownを残す。現在位置同定、室内外actor変換、経路案内、AT下限の証明として使わない。[仕様と制限](mining/MAP_COORDINATE_INDEX.md)を参照。

現行公開sourceに対する変更はsource／UI／tests／仕様の10ファイル。最新日報を保持した隔離stageでClang／LLD19.1.7の通常aggregateを08:43:25–08:43:47 UTCに実行しexit0。並行buildのobject衝突を避けるため実行時のobject保存先だけを隔離し、公開するbuild scriptは承認済みsourceと完全一致させた。既存42本のNode検査をすべて維持し、新規2本を加えた44本が通過した。

最終stageで元ROMをローカル入力した座標索引4,505 checks（全283 descriptorの合成寸法／原点比較を含む）、panel30件、既存marker67件、実Worker経由の出口UI37件が通過した。画素・抽出座標一覧・ROMはcommitせず、公開sourceから利用者の端末内で生成する。実ブラウザーでの見た目と操作のQAはこの追記時点では未実施で、公開後に別途行う。

Work6のheadless移植指示書は提供済みversion2へ更新し、private checkpointの対応文書とmanifestも置き換える。元ROM／開始Stateは検証用の参照とhashだけを記載し、本体を保存しない。Work6実装、Work4本番統合、Work5最終受入が完了したという更新ではない。

## 17:58 JST追記: 実動画BOX課題の引き継ぎと地図UI確認

座標機能の公開commit `b03ef5324dd1ce9854abdcf4c73bcc7eb904c16f` は、[CI／deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36986148884)が08:49:28 UTCにsuccess。公開ブラウザーの地図ブラウザーとmap-recognize両画面でmap103の固定表示点、map114の物理groupでは点を置かないこと、町／地域の固定表示先への切替、点のON／OFF、解放／再読込時の古い表示消去を確認した。未校正・暫定という表示を維持し、現在のactor位置の証明にはしていない。

座標JSON／CSVを追加したexport領域でボタン文字が狭く折り返される問題を確認したため、export領域だけを2列gridへ変える4行のCSSを追加する。出口exportと補足は全幅を使い、ROM処理・索引・画像認識・AT処理は変更しない。隔離stageの通常aggregate44 Node scriptsはexit0、座標索引36件とpanel30件も直接再実行して成功した。実行時のobject保存先だけを隔離し、公開build scriptは変更していない。変更後の公開ブラウザー確認は配信後に行う。既存公開版のexportクリック後にアプリ例外は見られなかったが、ダウンロード完了と保存された内容の確認は未完了。元からあるmap CSVも確認ツールのdownload待ちがtimeoutしたため、新規座標export固有の不具合と断定しない。

### 元動画でのBOX誤検出

本番認識ページの通常のfile chooser、自動観測、枠を保持する一時停止、手動固定を使い、元の実動画で問題を再現した。1ninn.mkvの保持観測146.146秒／固定146.150秒では表示2枠がともに廊下の壁・床。メタル1.webmの保持観測1100.017秒では表示2枠のうち1枠が味方で、同じ時刻付近の固定画像にはコマンドHUDや別の味方も候補化された。分類順位の問題より前に、領域候補生成のfalse positiveが残っている。

一部の時刻では敵体を囲む枠も確認したが、背景・味方・敵の見落としを含む全体精度の合格とはしない。元動画試験と、色metadataの影響を受け得るPNG／raw RGBの比較は分ける。修正後の比較、独立データのprecision／recall、見落とし全件の集計は未実施。画像・動画・画素・browser生ログはこの日報へ公開しない。

### 修正担当と未採用診断

利用者の指定に従い、BOX修正は外部GPT6 Pro／Codexへ引き継ぐ。こちらの追加BOX編集・実験は停止し、実動画の自動敵枠改善を完了条件にしたWork7指示書と既存証拠を準備した。候補数表示、分類器だけの比較、AT改善を枠検出の修正完了に代用しない。現本番の誤枠は未解決。

source座標の丸めで人工的なHUD重複が生じ、敵候補を失う限定不具合の診断patchは、synthetic回帰を改善した一方、凍結検証入力では背景候補も増やした。そのため本番の検出精度改善として採用せず、source-onlyのpatch／報告／凍結条件だけをprivate recoveryへ保存する。今回の公開変更には含めない。

定期保存では提供済みWork7指示書、未採用診断の6ファイル、追加ファイル台帳の参照を更新する。台帳の既存版を保持し、ROM／SAV／DST／RAM／動画／画像／抽出ゲーム資産／秘密情報は追加しない。Work4本番統合、Work5最終受入、Work6移植実装は別途未完了のまま。

## 18:18 JST追記: Work4の固定カメラ斜め移動だけを統合

公開e4738a5を基準に、Work4のうちcameraYaw=0を固定する斜め4方向のsource branchだけを統合する。明示したUpLeft／UpRight／DownLeft／DownRightについて、原ROMの同時押しreader、direction byte、table、target writerを結び、既存のordinary keyboard gateとROM-bound angle guardを維持する。変更はcreator／hero motion、関連回帰2本、説明文の5ファイル。Work3のsourceArm9 exportとAT source binding、認識、地図UI、build／CI、C／WASM sourceは変更しない。

最終統合stageは通常aggregate44 Node scriptsが09:13:23–09:13:44 UTCにexit0。一時objectの保存先だけを隔離した同じpipelineで検査した。keyboard portable548 checks、元ROM557、origin268、元ROMを使うAT source695が成功。新規検査には斜め4方向のXZ符号、外側の未解決branch、非zero／unknown cameraYaw、不変宣言の欠落、future camera、L/R表現の拒否を含む。公開用5ファイルはこの検証済みmanifestとbyte一致し、適用後のkeyboard548／origin268も再実行した。

既存fresh1990の30 phase／2 drawとconnected1200の149 phase／134 drawは、結果全体と入力非変異が変更前と一致。承認済みfresh1990起点と到達clockに各方向のscheduleを与える現在のfactoryを凍結し、提出済み固定camera報告との8経路／2,224 assertions比較も一致した。計240 pre／232 post、16 draw、各routeのtimer1019／seed0xa46fab4fとcreator前unresolvedを保持する。これは保存済み報告との数値統合回帰で、新しいnative captureではない。

### 対応しない範囲と未解決

斜め＋L/Rカメラ回転、camera-relative一般移動、任意map、world／body全体、creator後継続は未対応。ほこらUpRight+Rの最初のX差127は未解決のままで、writerや原因を断定しない。後続差は増えうる。提出された全native profile、off/on RAM／hash、runtime／controls、凍結projection、builder／verifierの不足も解消していない。全native parityやobserver非干渉を独立再現済みとはしない。[対応契約と検証範囲](F06_KEYBOARD_ORIGIN.md)を参照。

### 地図機能の範囲を訂正

先に公開した座標viewerは、map IDを選んで対応する地図と代表点を見る順引きの診断機能だった。利用者が必要としている「画面上のおおよその点から家／建物のmap ID候補を逆引きする」機能はまだ完成していない。逆引きの実装を別stageで進めており、今回の斜め移動releaseには含めない。

直前のexport欄CSSは、[e4738a5のCI／deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36987703136)が09:05:59 UTCにsuccess。公開root／map-recognize両ページで2列配置、出口action／説明の全幅、縦潰れ・横はみ出し・ページ末尾への押し出し解消を確認した。download完了と保存内容の検証は引き続き未完了。

BOX検出の修正担当は外部Work7のまま。未採用の丸め診断patchや追加BOX実験をこのreleaseへ混ぜない。ROM／SAV／DST／RAM／動画／画像／抽出ゲーム資産／秘密情報／生成WASMはcommitしない。公開commit固有のCI／deployはこの追記後に確認し、実施済みのローカル回帰と分けて扱う。

## 18:30 JST追記: 観測した地図上の点から建物map ID候補を逆引き

利用者が求める「表示されたおおよその位置から、家／建物の名称とmap IDを得る」方向を、既存のmap-recognizeの「文字→画像照合」へ接続した。同じ取得frameの地図名候補、地図画像の登録位置、パーティ点候補を使い、その点の誤差範囲に入るBMMP固定表示点からmap IDを逆引きする。正解の家IDを事前に一覧選択する必要はない。参照viewerの選択と独立し、名前候補に含まれないIDも同じdescriptorの固定点との対応から候補へ加える。

結果は候補として表示する。同じ点にある階層・部屋・改装状態、複数marker、弱い画像登録、別descriptorを保持する。距離順は表示順だけで、最寄りを現在地と確定しない。追加許容幅は0〜64px、初期値4px。物理座標として同じ点に居る屋外mapの可能性も残し、currentMapId=null、mapIdentityResolved=false、minimumProvenATCalls=0を維持する。未校正の変換・点の本人対応・表示modeから、屋内滞在やAT消費を確定しない。

### 最終統合の検証

直前のWork4公開 `8a8644bcf56540d4f3ded7c8ed48dd5baa918a3f` に8ファイル差分を適用。Work4の5変更ファイルと最新日報を保持した。通常aggregateは09:28:39–09:28:59 UTCにexit0、既存44本のNode検査をすべて保持し新規1本を加えた45本が通過。一時object保存先だけを隔離し、公開build scriptは検証済み差分と一致させた。

最終stageのcore＋ローカルROM118 assertions、実panel moduleの非同期フロー417 assertions、既存native実画素2枚を使う一連の47 assertionsが成功。最後の47件は、DS画面検出→名前枠→実ROM字形のCPU照合→同名57 ID→C01画像登録→点検出→逆引きをNodeで実行したもの。予測へ正解IDや事前選択した家を渡さず、予測後にのみ正解記録と比較した。武器屋は固定点候補map104、道具屋はmap108となり、点との差は約1.40px／0.91px。同じ点を物理表示するmap100や未探索の文字候補は残る。

これは既存の非圧縮native実画素2例によるNode経路の検証で、ブラウザー操作、圧縮動画、全建物での認識精度の合格とはしない。実panel417件も模擬DOM／canvas／Workerの制御フローであり、実ブラウザー試験とは別。配信後の公開UI確認は担当を継続して行い、その結果までは利用者向けの最終完了としない。[逆引き契約と制限](mining/MAP_POSITION_IDENTIFICATION.md)を参照。

ROM解放、source差替え・seek、許容幅変更で古い結果を無効化し、追跡時は同じ新frameから毎回計算し直す。評価上限4096分岐、無効分岐、未評価分を明示し、表示24件の外も観測ログに保持する。私的な画素・動画clip・字形・ROM・native実行結果は公開しない。

Work4の[CI／deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36989408902)は09:23:54 UTCにsuccess。固定camera斜めだけの対応、camera回転未対応、ほこらの未解決、不足native証拠は維持する。BOX修正は引き続き外部Work7の担当で、今回も認識BOX sourceは変更しない。09:25の定期保存はこの確定差分の通常保存を兼ね、直前Work4の重複commitは作らない。

## 19:01 JST追記: Work5の条件付きNPC継続予測を既存AT機能へ接続

最終Work5のsource-only成果を、既存AT Workerのreplay経路とAT画面へ接続した。「起動連続trace / 実測replay」の「開始snapshotからのNPC継続予測」でorigin.json、clocks.json、actor-rom-data.jsonを端末内で読み、条件付きdraw、終了seed、停止境界を表示・JSON保存できる。新しい独立ATアプリへの置換ではなく、既存セッションの証明済み下限・観測仮定下限・seed追跡を変更しない別の条件付き計算である。

開始時の動的状態と、ROM由来の静的値と、外部clock／invocation条件を分ける。controller巡回、移動・flags・elapsed、mode7/8の順序付き候補、方向drawとreset drawをつなぐ一方、mode9/10、未知mode、空候補、alias、特殊actor、未支持算術は明示的な未解決境界を維持する。条件付き4 draw等を、全世界のAT minimumへ加算しない。[入力契約・再現手順](NPC_AT_CONTINUATION.md)を参照。

元の提出sourceの固定base141b979と、今回の製品統合基準442f6fbは区別する。現在のWork4固定camera斜めと地図逆引きを保持した23ファイルのsource／schema／tests／UI差分だけを統合し、native証拠、RAM、抽出table、画像、ROMや生成binaryをcommitしない。通常aggregateは10:00:08–10:00:29 UTCにexit0、既存45本を保持した49本のNode検査が通過した。一時object保存先だけを隔離し、公開build scriptは承認済みsourceと一致する。

最終公開stageで実production Workerのportable回帰22件、実panel controllerの模擬DOM回帰18件を実行。保存済み入力を使った43 checksでは、武器屋／道具屋／武器屋vectorの3ケースが凍結projectionと完全一致し、条件付きdrawは4／0／4、各300 tickだった。既存replay入口と専用入口の一致、結果保存、連打抑制、入力差替え／クリア後の遅い返答の無効化、壊れたJSON後の古い結果除去、既存ATSessionが不変であることも確認した。

この43件は実Workerと模擬DOMを使う制御フローの検証で、新native captureや実ブラウザーの見た目の合格ではない。公開後に実UIから確認し、それまではブラウザー確認待ちと明記する。単体report、source ZIP、private evidence、再現手順の最終4点はLibraryに保持し、追加台帳にも参照を保存した。

### 地図逆引きの公開UI確認

442f6fbの[CI／deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36990459916)は09:34:24 UTCにsuccess。その後、新規cloudブラウザーで、元native実画素から作った可逆動画とローカルROMを通常入力し、正解の家IDを選ばずに武器屋104/C01M04（1.4px）、道具屋108/C01M08（0.9px）が表示された。WebGPUが利用できずCPU単発10秒の設定を使った。map100と未探索候補の維持、動画切替／ROM解放での古い結果消去を確認した。

これは2つの可逆clipでの実UI確認で、圧縮動画や全建物の精度保証ではない。既存player-statusの長いID列が隣列へはみ出す軽微な表示問題は残り、逆引き結果の行は読める。

### 優先課題とWork6の保存状態

利用者が新しく最優先にしたWork8「map進入時の青宝箱／NPCなどの具体的AT消費」は別課題で、今回の既知開始snapshotからの通常NPC継続予測では完了しない。進入前後の消費、起点、他consumer、seed setterとの結合を別途閉じる必要がある。

Work6はエミュレータtool側の変更であり、ATアプリの置換ではない。失敗時lifecycle、遅延prologue、IRQ境界、最外frame returnのlane誤接続を修正後、30/30回帰、native hook9件、実CPUfixture9件、元ROMのOFF／OFF／ON各600frameのCPU／RAM／最終画像一致、drop0を再確認した。修正版はprivate tool repoのcanonical sourceと新しいversioned runtime cacheへ通常pushし、38 textファイルと779,274 Bのraw gzip runtime archiveをremoteからbyte一致で確認した。元cacheと元lockをrollback用に保持し、以前のLibrary ZIPが修正後runtimeを含むとは扱わない。

ARM9の推定stack／unknown rootという限界は残る。今回の約19.1%のstep時間増加は限定実行の測定であり、全ゲーム・全Stateやcycle単位の中立性を証明しない。緊急保存した旧UNFINISHED版は履歴として保持する。今回のWork5公開にWork6 sourceや未採用BOX修正を混ぜない。

## 19:57 JST追記: Work5の公開ブラウザー確認完了

Work5公開commit `4cc785a1d9a77c0051b385a70f6dea80ade5b004` の[CI／deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/36995329064)は10:25:55 UTCにsuccess。配信後、新規cloudブラウザーの[公開ATページ](https://daisukedaisuke.github.io/dq9-AT/)で、通常のファイル選択から実際の開始状態・clock・ROM抽出JSONを入力して確認した。19:01追記のWork5「ブラウザー確認待ち」は、以下の確認範囲で解消した。

武器屋／道具屋／武器屋vectorの3ケースは各300 tickを完了し、条件付きdrawは4／0／4。武器屋2ケースのseedは951441153→3358057021、道具屋は1536043482のままだった。各結果の「証明済み下限への加算0・追跡セッションは変更なし」と、画面上の既存sessionのseed、証明済み下限、観測仮定下限、event件数が変化しないことを確認した。保存済みprojectionとの全field比較やsession全体のbyte不変検査は前節のNode検査であり、ブラウザー側では表示を確認した範囲に限定する。

完了後のorigin差替えで旧結果が消え保存が無効になること、clocks.jsonをoriginとして選ぶと入力種別エラーになり正しいoriginへ戻すと4 drawへ復帰すること、クリアで全入力・結果を除去し実行／保存を無効にすることが通過した。desktop表示に重なり・欠けはなかった。処理中の入力差替え、session永続化内容のbyte比較、JSON構文破損はこの実ブラウザー確認では独立再試験していない。

結果保存はクリックまで確認したが、確認ツールのdownload待ちがtimeoutし、保存先・ファイル内容を取得できなかったため、ダウンロード完了は未検証のまま残す。検証入力、画素、画像、動画、抽出table、生ログは公開しない。[本番予測器の契約](NPC_AT_CONTINUATION.md)、[実Worker回帰](../scripts/test-npc-at-replay.mjs)、[panel制御回帰](../scripts/test-npc-replay-panel.mjs)と、上記の実UI検査を区別する。

地図逆引き2例の実UI確認と修正済みheadless toolのremote一致確認は19:01追記に記録済みで、今回再実行・再公開していない。今回の更新はこの日報だけ。Work8のmap-entry実装やclient起動・通信成立を、この確認から完了と推定しない。

## 20:28 JST追記: 保存済みの前日日報とナビゲーターの残作業

Libraryに保存された `dq9-at-source-20261001-v16.zip` 内の `dq9-at/docs/daily/2026-10-01-night.md` を取得し、全文を確認した。48行、6,954 B、SHA-256は `9d7778356c50be1f1c71e2fd6a3af86cb49dc5c86ffdbf92094845aa912f6342`。2026年10月1日15:19 JST追記までの保存版であり、その夜の最終日報や失われたraw実験結果まで回収できたとはしない。冒頭の「日報原文は未復旧」は当時の記録として保持し、現在はこの保存版を参照できる。

最終目標はATナビゲーターを作ることで固定する。AT再現、モンスター認識、総当たり、下限の証明はいずれもその手段である。前日日報の目的と今日の「観測でAT候補が減る最小例」「移動案内と再観測」を照合し、残りは、実観測から現在までの候補を狭め、実行できる移動を案内し、実行後の観測で更新する接続だと整理した。個別部品のテスト数を全体完成に置き換えない。

Work5の条件付きNPC予測、Work6のheadless更新、屋内逆引きの限定公開UI確認は既述の範囲で完了済み。Work4の固定カメラ斜めは公開済みで、カメラ回転等の未対応は現在の停止方針を維持する。BOX修正は外部Work7、道具屋から城下町への入場消費はWork8が担当する。別担当の成果を重複実装せず、最終UIの装飾は必要なナビ構成要素の接続後という条件を維持する。

Work8から開始報告を受領し、指定した通信文書の取得・hash確認と、初回指示を読み受領確認したことを照合した。報告時点ではROM／SAV／runtime復元、退出入力の確定、native比較、実装・回帰は未実施。開始と通信確認を実装完了として扱わない。既存観測から候補探索への接続も隔離環境で実装中で、未確定のsourceは今回保存しない。

今回の確定差分はこの日報追記のみ。前日日報のarchive本体、通信本文・routing state、進行中source、ゲーム入力・抽出資産はリポジトリへ追加しない。private tool資産と解析注釈に新しい確定差分はなく、重複commitを作らない。

## 20:43 JST追記: 記録した観測を既存の候補探索へ引き渡す

AT追跡画面の「記録した観測から候補を絞る」から、同じタブの既存identifierへ保存snapshotを渡す接続を追加した。保存済みsession JSONからも1〜8件の観測を選べる。外部既知seed、観測ID、table／monster候補、mapや観測元、未知のconsumerを保持し、元の追跡sessionと証明台帳は書き換えない。

過去の探索窓、保存lowerBound／conditionalBound、時刻、観測後に追記したboot prefixを、その観測のindex上限・下限へ流用しない。通常の入力でgapや最終indexが不明なら条件不足のまま残す。利用者が根拠付きの有界仮説を明示した場合に既存solverへ渡せる接続であり、実動画の現在ATを自動特定する実装ではない。結果も仮定した最後の抽選時点を表し、観測時点から現在までの未知消費は残る。

変更はadapter、既存form／page／AT panel／HTMLと既存page回帰の6ファイルに限定。最新日報を保持した統合stageで既存aggregate49 Node commandsがexit0。low31 page83 assertions、known-origin page171 assertionsを含み、引渡し、file読込、選択、重複拒否、条件不足、遅延読込、clear／retry、取消・再開、元session不変を確認した。探索engine／Worker、AT core、WASM、build定義、Work7／8の内部実装は変更していない。

合成の保存形式sessionに明示した合成index1〜100000の仮説では、観測2件の20,964候補が3件で14,148候補になった。一方、未知gapのままなら未解決・走査0・候補数不明を維持する。この数値はnative sessionや実動画での同定成功ではない。公開後の実ブラウザー操作は未確認で、配信後に別途行う。ゲーム入力、native生成データ、画像・動画、生成binaryはcommitしない。

## 21:01 JST追記: 観測引渡しの公開ブラウザー確認

`9c09606fdb058bac793b23e478f449ef754ea4ea` の[CI／deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/37002671563)は11:45:36 UTCにsuccess。11:48–11:55 UTC、新規cloudブラウザーの本番UIで、架空の3観測を記録→新ボタンでidentifierへ移動→観測選択→探索入力の引渡しを確認した。保存した合成session JSONも読み込み、seed・元ID・table候補・map／source・自然生成確認の記録を保持した。index上下限は空欄、gapは不明のまま引き継ぎ、観測後のprefix100を過去のindex制約に転用しなかった。

明示した合成index1〜100000／gap1〜3では、2観測20,964候補、3観測14,148候補を実ブラウザーで計算した。未知gapなら走査0・候補数不明・未解決を維持。不正JSONのエラー表示、clear、再読込後の同じ14,148候補、Backで元panelへ戻った際の3件の可視JSONログと下限表示の不変も確認した。ROM・動画・native観測を用いた試験ではなく、現在ATの復元や移動ナビ完成を示す結果ではない。

「追跡を保存」のクリック後は確認ツールのdownload待ちが10秒timeoutしたため、保存完了と全snapshotファイルの前後byte比較は未検証のまま。今回の確認によるsource変更はない。動画の復旧先は別途、検証済みLibrary IDとhashを持つprivate復旧索引・追加台帳へ保存し、動画本体や通信記録をGitへ追加していない。

## 2026-10-02 21:32 JST — 識別候補を主画面の条件付き対象比較へ接続

- 識別器が保存した full32 候補を同じタブで主画面へ戻す導線と、結果 JSON の読込を追加。元の seed・セッション・観測 ID/内容・抽選対応を照合し、ROM から選択中の map/node・area・時間と既存の対象選択を使って比較する。
- 最終抽選から比較参照点までの消費範囲と根拠・仮定を別途要求。不明や空欄は 0 にせず未解決のまま残す。保存済み候補ごとの状態を検証し、指定 draw 先の table→weighted の条件付き結果、一致/不一致、未探索・未保存・途中停止範囲を表示する。50,000 評価・1.5 秒の上限と中止を設け、元セッション・下限台帳・WASM kernel は変更しない。
- 最終統合版で既存 aggregate 49 コマンドが exit 0、識別画面/実 Node Worker 接続の 224 assertions が通過。実ブラウザの画面・戻る導線・ROM 読込は配信後に別途確認する。
- 保存済み native 記録を用いた別の数値照合では paused-state 起点の候補 7 と明示した 2 draw 消費から、記録内の table draw 10 / weighted draw 11・monster 108 が一致した。これは boot 起点の実セッション接続や実画面での出現確認ではない。現在 AT、出現時刻、歩く方向、生成成功は依然未確定。

## 21:58 JST追記: 候補比較の公開UIとheadless座標スクリプト

`ecce19c25b0219871f66573ba501b82524cb1840` の[CI／deploy](https://github.com/DaisukeDaisuke/dq9-AT/actions/runs/37007560589)は12:36:09 UTCにsuccess。12:38–12:44 UTC、公開ブラウザーでローカルROMの静的コンテキストと合成保存sessionを使い、主画面→識別→「候補を追跡画面で比較」→元画面へのBack/BFcache復帰を確認した。ROM・active session・対象・探索窓を保持し、明示した合成index1〜10000／gap1〜3で発見1,394件のうち保存100件を渡した。

reference gap不明は0評価・未解決、有限範囲の空欄はエラー。明示した合成gap0〜0・window40では100 state検証、3,900評価、39 offsetを処理し、保存済み候補内の結果差と未保存・範囲外候補を表示した。time変更で旧結果消去・再計算、ROM解放で結果消去・比較無効を確認。元sessionの可視7イベントと証明／条件下限100／100は不変だった。これは実ROMの静的情報を用いた合成sessionのUI検査であり、実動画の現在ATや出現時刻の同定ではない。

結果JSONのdownload／import経路は今回未試験。別session拒否・計算中cancelはNode回帰のみで、全hidden snapshotのbyte比較も今回のブラウザー検査には含めない。追加の公開source修正はない。

private headless toolには、ユーザー提供Luaの座標配置を参照する小さな読取adapterと既存Node APIの入力例、test、使用説明の4ファイルを追加し、remote全文一致を確認した。元ROM／Stateでの座標読取、Right30フレームの移動、入力解放、読取有無でのARM9レジスタ一致の2 testが通過した。配列所属を敵の可視・生存と断定せず、raw location IDをmapファイル番号へ自動変換しない。A*・衝突回避はこの追加には含まれず、native runtimeと公開ATは変更していない。

## 22:44 JST追記: Work8の条件付きmap入場・NPC継続を統合

道具屋から城下町への限定ケースについて、既知の局所checkpointからsource由来の入場27 drawと通常NPC継続6 drawをつなぐ単位を統合した。保存済みpacket/sessionを既存「追跡を復元」とproduction Workerで再評価する入口であり、自動の入場検出や全map対応ではない。conditional33、起動からの証明下限0を保持し、局所起点表示とboot前提の識別画面への引渡し制限を追加した。

提出版の失敗setMapがmap/eventを先に変えてしまう不具合を修正し、不正・重複・重なり等の拒否時に元台帳を保つ。17 source fileだけを最新公開版へ統合し、同一だったWork5依存3file、候補比較Worker、WASM source/binaryは変更しない。最終aggregateは既存49＋Work8の1 command＝50がexit0、新Work8回帰12件を含む。

保存済み実測証拠の再比較では入場27 pairsの303 checksは差0。NPC6 pairsの30,100 checksは終端controller flagの差1を保持し、厳密比較は予定どおりexit1で全状態一致とはしない。順序付き消費の一致と未知の状態境界を区別し、JSON restore／再送／改竄・重なり拒否、Work5の保存projection4／0／4を確認した。今回の統合検証は保存証拠の再計算で、新native captureではない。

loader・heap・geometry等の条件、controller外部flag setter、kind2等、青宝箱のphysical identity／開封、未知suffix、boot全履歴は未解決。公開後の実ブラウザーrestore表示・ダウンロードはこの時点では未確認。ROM／SAV／State／RAM／動画／抽出資産／private evidenceは公開sourceに含めない。


## 2026-10-02 14:14 UTC: 大きい追跡証拠の表示を要約へ修正

公開Work8の実保存session（31,623,295 bytes）を通常の復元操作で読み、局所起点・証明下限0・条件付き33・未知5件と重複復元時の不変を確認した。一方、証拠ログを展開した後にブラウザー操作がタイムアウトし、通常reloadで回復した。全文をDOMに置いていたため、最新40イベントでも大きいnative evidenceを表示していた。

at-panelの表示だけを、イベント種別・件数・境界・hash・最初の差分などを取り出した要約にした。raw trace/source/比較列と保存・restore・Workerは変更していない。実sessionのプレビューは6,475 bytes、Node単発の作成時間0.379 ms、元sessionのJSONは不変。これはブラウザー性能測定ではない。既存12件と追加した同じテスト内の大きいログ確認、既存aggregate50コマンドが成功。修正後の公開ブラウザーでの展開は次に確認する。

夜間の短期優先は実動画での物体認識比較・修正と、Work8資料に基づくAT再現の不足確認。Work9は準備のみ・未開始のまま。Work7の未採用版を認識改善済みとして配信していない。
