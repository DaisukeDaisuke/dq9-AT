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
