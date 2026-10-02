# AT特定・総当たりの要件定義

作成日: 2026-10-02 UTC。対象: DQ9 日本語版 revision 0。**設計要件であり、映像から現在ATが特定できたという実績ではない。** 実装の参照点、既存実測、未解決条件を分離する。

## 1. 目的と非目的

目的は、観測に整合するAT状態を漏らさず残し、追加観測で候補を狭め、最後に指定した境界の実機状態と照合すること。「総当たり済み」は宣言した探索領域にのみ付ける。計算予算、候補保存上限、検出器の上位件数を物理的な可能性の上限にしない。

最短経路は既存の抽選predicate・WASM探索・条件付きreplayの接続である。再学習、新しいテンプレート照合、全世界の再制作を前提にしない。実時間メタルナビ、全マップの歩行再現、動画だけからの出生確定はこの文書の完成条件ではない。

## 2. 何を特定するか

`web/vendor/arand-reference.mjs` に従い、ATは次の32bit状態遷移と15bit出力を持つ。

- `S[n+1] = (0x41c64e6d * S[n] + 0x3039) mod 2^32`
- 抽選nの出力は更新後状態の `R[n] = (S[n] >>> 16) & 0x7fff`
- `S[0]` は指定したoriginの状態。起動initial seedとは限らない

出力する対象を次の三段階に分け、混同しない。

1. **抽選後状態**: 指定イベントEの直後の `S[E]`。現行識別エンジンの対象
2. **観測境界状態**: 指定capture/frame/phaseの `S[T]`。E→T間の全消費候補を伝播して初めて求まる
3. **ナビ用状態**: `S[T]` に加え、scheduler timer、map/area/day-time、hero、actor registry、入力・phase等、次の消費を決める状態。ATだけの一致では完成しない

各候補は `targetBoundary`（event ID、capture ID、native frame/phaseの既知・不明）、`state32` または `low31Class`、`origin`、`terminalIndex`、成立条件を持つ。originは `boot-known` / `paused-native` / `hypothesis` を区別し、paused-stateを起動証明に格上げしない。現在の映像captureがイベントEと同一境界であるとの証拠がなければ、Eの結果を「現在AT」と表示しない。

## 3. 総当たり領域と完全性

### 3.1 起動seedが未知の場合

- 全32bit状態は4,294,967,296件。15bit出力の制約だけならlow31の2,147,483,648クラスを検査し、各クラスcを `[c, c+2147483648]` に持ち上げる
- 奇数乗数によりbit31だけ異なる状態は以降もbit31差を保ち、抽選出力は同じ。出力だけの列を増やしてもこの2状態は分離できない
- この縮約は**出力predicateでの同値性**。完全32bit状態を直接参照する別条件へ、証明なしに流用しない
- 1イベントで許される15bit出力がk個なら、全域ではlow31クラス `k*65536`、32bit状態 `k*131072`。これを複数イベントの独立確率の積に置き換えない
- 有限のlow31 priorを使う場合は境界・出典・除外根拠を記録する。根拠が仮定なら範囲外を残す

### 3.2 既知origin seedの場合

- `S[n]=advance(originSeed,n)` として、最終抽選indexのinclusive範囲を走査する。index0はorigin、1は最初の更新後。現行UIの最終イベントindexは1以上
- 現行indexエンジンはuint64の10進文字列を受け付け、**1回の範囲長は最大2^31**。32bit全状態周期を評価する要求なら、明示的な複数範囲への分割・境界集約が必要。単一実行を2^32全探索と呼ばない
- 同一origin・同一indexでは32bit状態は1個。出力同値のbit31反転は周期内で2^31離れた別index。indexを2^32ずらすと同じ32bit状態へ戻るため、状態一致だけでは絶対経過消費数を決められない
- uint64をNumberへ変換しない。周期を越えるindexは別履歴として扱うか、modulo周期とepoch不明を明記する
- 未知initial seedと無制限indexを無意味に直積走査しない。まず対象境界の状態クラスを絞り、origin証拠がある時だけindexへ対応付ける

### 3.3 状態以外の探索領域

領域宣言はstate/indexだけでは不足する。次の各軸について、候補集合、根拠、全列挙済みか、範囲外、unknown分岐を保存する。

- sightingと個体の対応: 同一個体、別個体、再出現、既存個体、背景・誤認、未知
- 個体と生成イベント: 自然生成、別生成経路、録画前生成、未確定
- 種・共有model、map、生成地点area、day/time、候補table、table選択順序
- イベント順序、欠落イベント、イベント間AT消費、イベント→capture消費
- 必要なscheduler/移動/生成の到達条件と未対応consumer

現行backendは2〜32イベント、正の有限gap、最大gap合計256、完全な直列チェーンに限る。フォームは2〜8イベント。low31側の1イベントは解析集計できるが、index側の1イベントは未対応。非直列順序、無限gap、lag超過は「解なし」ではなく `unresolved`。未知を256や1秒などで勝手に切らない。

探索述語は「このstateに対し、許容されたgap/対応の少なくとも1つが成立する」。一つの失敗した対応でstate全体を捨てない。同じstate/indexを持つ異なる枝は重複し得るため枝件数を加算しない。集合統合にはboundary・origin・条件の同一性も確認する。

## 4. 映像観測の最小契約（提案schema、未実装）

既存 `captureStamp` とobserverのimmutable ownershipを再利用する。入力のJSONレコードは最低限次を持つ。

|区分|必須情報|
|---|---|
|由来|schemaVersion、observationId、source/video digestまたはopaque source ID、sourceEpoch、seekEpoch、ROM revision、生成器version|
|時間|captureId、media timestamp、decode/presentation frame IDがあればその値、取得時wall/monotonic time、native frame区間と根拠（不明可）|
|画素範囲|元映像寸法、gameplay panel、crop ROI、crop transform、HUD/hero等の除外領域とversion|
|観測|候補box、tentativeTrackId、species/model候補、raw score、score種別、`unknown=true/false` と根拠|
|文脈|map候補、heroの画面座標/世界座標候補を別フィールド、area/time候補、camera registration状態|
|観測不能|遮蔽、画面外、HUD重なり、decode欠落、pause/seek、coverage区間、検出を実行したか|
|解釈|identity/birth/naturalSpawn/drawOrderの証拠種別、対応代替、human修正履歴、raw observation参照|

未知値はnullまたは明示unknownで保持し、0・空配列・falseを代用しない。`notRun`、`noProposal`、`unknownObject`、`candidateSpecies`、`nativeVerified` を区別する。UIが保持する4件の履歴は全観測コーパスではない。索引化する際は別の有界・明示的な観測記録経路が必要であり、raw videoを自動保存・公開しない。

`web/monster-video-observer.mjs` は現在 `unknown:true`、`enemyIdentityCertified:false`、`birthCertified:false`、`ATDrawsCertified:0` を出している。現行データをそのままhard制約へ接続することは禁止する。共有modelの種候補、背景枝、見落とし枝を保持する。

## 5. soundな除外とsoft順位付け

ここでsoundとは、宣言した真の条件の下で整合する候補を誤って除外しないことを指す。確率スコアの高さとは別。

**条件付きhard制約にできるもの**

- source/native検証済みのAT遷移、引数範囲内のATRandInt、検証済みtableのweighted区間
- 証明されたイベントの種/table候補集合、eligible nodeの**順序を含む**集合
- 証明された前後境界の消費数・順序、同じ入力/状態からの検証済み遷移
- 各制約のsource・native evidence・適用条件を伴う矛盾。除外結果には最小の反証を記録する

**softに留めるもの**

- DINO等の順位、未校正confidence、画面上の近さ、tentative track、見かけの動き
- マップ名順位、推定area、見た目の出生、認識なし、録画fpsから推測した消費数
- F06のallocation/stability/ownership等、今回の入力で明示trueに置いた未測定条件

soft scoreは枝の実行優先順位を変えてよいが、候補削除・全域探索済み・proof lower boundの前進には使わない。top-Kやbeam切断は未探索尾部として返す。unknownのresource/table/trap/routeをfalse扱いしない。誤検出で正解が消えた場合は「ATが違う」より先に観測枝を再検討する。

既存 `at-observation-compiler.mjs` は不明table等を許容maskに残し、sighting自体からcertified drawを加算しない。この性質を維持する。

## 6. 時間整合とイベント→映像の伝播

- media time、推論完了時刻、native completedFrames、scheduler/creator/body phaseは別座標
- 各候補はnative frame/phaseの区間または不明を持つ。表示遅延・フレーム落ち・重複・buffer・seekを記録し、推論完了をcapture時刻として再利用しない
- 時間順の検出は抽選順を保証しない。画面外出生、既存個体、遮蔽を別枝として持つ
- post-state間gapは到着先抽選を含む1以上。抽選→sighting gapは0以上で、sighting自体は抽選ではない。両者のoff-by-oneを検査する
- E→Tの未知消費に上限がなければ `callsAfterEvent.max=null` のまま返す。有限scan窓を証拠の上限にしない
- E→Tを進めるときは既存replayの検証済みconsumerだけ使う。不明境界で停止し、確定prefixと未解決suffixを保存する。時刻だけから固定calls/frameを補わない
- source/ROM/crop変更やseekでepochを更新し、古い結果が新しいboxやAT枝へ流入しないことをテストする

## 7. 同一seed・同一stateによるnative検証

### 7.1 現在ある根拠

`F06_CREATOR_CONDITIONS` とcreator packetを備えた現行ソース、および2026-10-02のcreator carryレビューによる条件付き実績:

- 新規に記録したframe1200 originは `0x9ebad4ad`。149 phases／134 AT calls後 `0xa46fab4f`
- F06条件付き出生: species88、slot112、serial2、XYZ[-30665,9434,-91287]、heading11657、scale[226,226,226]
- creator returnではtimer1019、scheduler returnではtimer0、ここに追加AT消費なし
- 31 creator fields一致、255 native/prefix/pool比較、102 guard回帰という**既存報告**。後述の今回のportableテストとは別
- 1200-originのyaw0は元RAMに存在せず、同じboot/inputで補足取得。3byte差等の留保と `cameraYawRemainsInitial` 仮定を維持

これは既知結果に対する条件付き再現。元の失われたframe950軌跡の復元でもblind testでもない。`futureActorTicksPermitted:false`、`visualStateResolved:false`、destination world未解決を維持し、同一pass後半のhero/body、可視frame、実映像個体対応まで一致したとはしない。

### 7.2 受入用の検証手順

1. ROM/runtime/observer/code hashと入力scheduleを固定し、native originのseedに加えtimer/map/hero/registry/clock/必要resource状態を記録する。seed一致だけで「同一state」としない
2. observer-off/onの同一入力実行でCPU・選択memory・pixel境界、可能なfull RAM比較、event連続性、drop数を比較する。観測が挙動を変えたrunは除外する
3. originと到達前入力だけから予測を出してhash付き凍結する。以降のnative AT/actor/位置/scale出力は比較専用で、検索predicateや入力補完へ漏らさない
4. kernel truth-retention: 正解state/indexが検索集合に残ることを最優先で検証。種/table/gap/順序/bit31の代替、未知table、誤検出、見落とし、重複sighting、録画前生成を含める
5. ATの各entry/return、timer、phase順、停止理由を比較する。最後のseedだけの一致は不十分。最初のdivergenceを出す
6. 条件をfalse/nullへ変えるnegative試験でunknown/rejectionと既知消費prefixが維持されることを確認する
7. 既存F06のreproducibility試験と、開発で未使用の別origin/別窓のholdoutを分離する。blindと呼ぶのは結果が入力・チューニングに使われていない場合だけ
8. video integration試験ではnative真値を検索器へ渡さず、検索終了後に照合する。RAM付きのconditional replay成功とvideo-only identification成功を別項目で報告する

## 8. 成功・曖昧・失敗の判定

必ず `domainCoverage`、`hypothesisCoverage`、`candidateMaterializationCoverage`、`temporalPropagationCoverage` を別々に出す。

- **searched-within-domain**: 宣言state/index範囲の全区間を実際に検査。未列挙観測枝の完全性は含まない
- **conditional event-state recovered**: 有効条件付き枝で最後の抽選後集合が求まった。1クラスなら通常2つの32bit liftを残す
- **current-boundary recovered**: 観測対応・全消費の伝播・target boundaryが成立し、残存する全枝の集合が同一32bit状態に一致。未証明仮定があればconditionalを付ける
- **ambiguous**: 複数state/index、bit31、対応/時間不明、unconstrained枝、範囲外、未探索、保存欠落を明示。順位1位を確定としない
- **inconsistent within declared hypotheses**: 完全走査した枝が0件。入力誤認/モデル欠落/領域外の可能性を示し、全ゲーム状態に解なしとはしない
- **unsupported / interrupted / failed**: 不正入力、未対応gap、予算停止、中止、hash違反等。0候補という意味に変換しない

`globallyUnique`を立てるには全代替枝・全適用領域の除外証明が必要。現行engineの `coverageVerified:false`、`currentVideoStateRecovered:false` をUI接続だけでtrueへ変えない。全候補を保存できない場合でも件数とcoverageは正しく返し、sample16件を全結果として渡さない。再開はrequest/code hashとacknowledged intervalが一致する場合だけ保証し、現行の新Worker再実行をresumeと呼ばない。

## 9. 性能評価・総当たり実行契約

この文書は全2^31走査の速度・所要時間を測定していない。以下を実測して初めて実用上の総当たり時間を述べる。

- request manifest: predicate/input hash、table version、event数、gap分布、枝数、domain、初期seedが既知か、保存上限、chunkサイズ、予算
- environment manifest: CPU、OS、Node/browser/version、WASM hash、worker数、並行負荷。C nativeとWASM、Node Workerと実ブラウザを分ける
- dense/all-accept、sparse、0-hit、gap固定/広い有限range、2/8/32イベント、合計lag256、複数枝・重複枝を測る。単一の都合のよいmaskで代表しない
- cold準備/compile時間、warm kernel時間、worker転送、materialization、JSON出力、全体elapsed、peak memoryを分ける。反復数を宣言しmedian/rangeと生結果を保存する
- throughputは実際の検査state/index数÷秒。枝重複を含むworkと一意domain coverageを別計数。解析的1イベントを走査速度に混ぜない
- 小領域をBigInt referenceと全候補照合してから、全域runへ拡張。範囲端、chunk端、index周期/2^31境界、uint64最大近傍を検査する
- ETAは同じworkload/engineの測定からの推定と表示する。完全runのelapsedを予測値から作らない。演算量はpredicate/gap幅に依存する
- 中止latencyとcheckpointのack区間、端数chunk、保存上限0/小/100000、OOM/error recoveryを測る。停止まで内部処理された未ack区間を検索済みにしない
- 15bit mask32768項目、stream chunk最大1000000、stream全2^31 hit bitset相当256MiBは設計上のサイズ。これは実測peak memoryでも全候補保存の推奨でもない

既存動画レポートのclassifier median726msやwarmup30.9秒は観測処理のNode harness値。AT探索性能、ブラウザdecode性能、検出精度の代用にはならない。

## 10. 実装ゲート（順番と終了条件）

|Gate|実装/検証|通過条件|
|---|---|---|
|G0 境界固定|この契約、request/result schema、source hashes|seed/state/index/frameの区別、unknown表現、各coverageをレビュー|
|G1 純粋探索|既存compiler＋2エンジンを再利用、benchmark runnerとrequest manifest|小領域全候補oracle一致、真値保持、bit31/周期/中止/保存欠落の回帰|
|G2 全域計算|明示した有限枝の全low31または既知seed-index範囲走査|実測のcoverage・time・memory・候補件数。未支持枝と未探索を保持|
|G3 観測アダプタ|captureStamp→sightings/hypotheses、unknown枝とsoft順位のみ接続|非同期stale・seek・重複/見落とし試験、hard pruningなしでnative truth保持|
|G4 同一state検証|既存F06条件付きreplayと独立holdoutを使用|予測凍結、native同一条件、各AT/phase比較、未来入力漏洩なし|
|G5 対象境界への伝播|必要なE→T consumerだけをsourceで確認して接続|未確認consumerでは停止、frame/phaseまで真値比較。未通過ならevent-state結果のまま|
|G6 利用可能な表示|候補・条件・coverage・追加観測提案|「現在AT」表示はG5の条件を満たす場合だけ。ナビ完成は別判定|

先に進められる作業はG1/G2の探索・計測とG3の観測契約整理。G5未完成でも総当たり自体は実行できる。全世界再現や認識モデル変更を待つ必要はない。一方で、その計算終了をライブAT特定の終了と取り違えない。

## 11. 参照ソースと証拠の扱い

リポジトリ内:

- `web/vendor/arand-reference.mjs`: 32bit LCGと15bit出力
- `web/at-core.mjs`: ATRandInt、table選択、weighted predicate、既知seed session／boot traceの境界
- `web/at-observation-compiler.mjs`: masks、unknown、gap、観測枝、coverage契約
- `wasm/at_identify.c`、`web/at-identify-engine.mjs`: low31探索、32イベント、256 lag、sample16
- `wasm/at_identify_stream.c`、`web/at-identify-index-engine.mjs`: cycle-order scan、index範囲、保存coverage
- `docs/CONDITIONAL_AT_SEARCH.md`、`docs/TERMINAL_INDEX_SEARCH.md`: 現行UI/workerの範囲
- `web/monster-video-observer.mjs`、`docs/MONSTER_VIDEO_OBSERVER_20261001.md`、`docs/VIDEO_CAPTURE_IDENTITY.md`: 観測のunknown/非同期ownershipと実験限界
- `web/f06-creator.mjs`、`web/first-spawn-replay.mjs`: optional creator条件、部分tag、出生後停止

ローカルの実測レビュー: `VERIFIED_NATIVE_RECOVERY_20261001.md` の00:36追記と `CREATOR_CARRY_REVIEW.md` の00:42レビューを確認した。古いリポジトリ内 `docs/F06_NATIVE_RECOVERY_20261002.md` は後半追記がなく、単独では最新creator到達範囲を表さない。本文の数値は実測レビューからの引用であり、今回新たなnative captureは実施していない。元ROM/SAV/RAM、動画、raw trace、抽出アセット、private packetはこの文書へ同梱しない。

## 12. この要件作成時に再実行した確認

2026-10-02 UTC、元stageを変更せず隔離コピー上で以下を再実行し、全てexit 0。実装変更は行っていない。

|コマンド|結果|
|---|---|
|`node scripts/test-at-observation-compiler.mjs`|360,503 checks、synthetic/public-table predicate|
|`node scripts/test-at-identify.mjs`|47 assertions、実Node Workerを含む有限領域・unknown・中止|
|`node scripts/test-at-identify-index.mjs`|634 assertions、index/BigInt/Worker/materialization|
|`node scripts/test-f06-creator.mjs`|83 portable checks、optional native/ROM入力は未実行|

新規native capture、private trajectoryの再実行、全2^31 benchmark、aggregate build、実ブラウザ映像QAはこの文書作成では実施していない。既存報告のnative比較数と今回のテスト数を合算して新しいnative証拠としない。

参照した探索ソースSHA-256:

- `wasm/at_identify.c`: `f0d1c330d7a927b80789adf81f79a88152b6d886685844218ad647f38056f1d0`
- `wasm/at_identify_stream.c`: `4431f8f64df30111980d2f3f32497dbf8c9ec1f03882e7b981ab1ab72ac68f41`
- `web/at-identify-engine.mjs`: `7fdfd0add5f397c7af20dc981fee3774d6b54985a18cf6684f25bfaaec421ad7`
- `web/at-identify-index-engine.mjs`: `6f4bf4b68f98e8cdffcac587a53f78d68febaa5bfc8cd5e6a5cedc5b9307fca1`
