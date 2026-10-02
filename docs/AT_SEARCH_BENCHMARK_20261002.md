# AT探索の有界ベンチマーク（2026-10-02 UTC）

既存のレビュー済みWASM／adapterを変更せず計測した、合成入力だけのNodeベンチマーク。ROM・SAV・動画・native stateは使わない。全2^31走査、実機AT特定、ブラウザ速度、実世界の観測精度を示すものではない。

## 再現

```sh
node scripts/test-at-search-benchmark.mjs
node scripts/benchmark-at-search.mjs /tmp/at-search-result.json 4194304 3
node scripts/benchmark-at-search.mjs /tmp/at-search-small.json 257 1 63
```

引数は出力JSON、1 trialの検査件数（既定262144、上限4194304）、反復数（既定3、1〜5）、chunk（既定65536、1〜1000000）。開始前に小領域oracle、境界、部分budget、候補保存、実Worker中止を毎回検証する。中止試験だけは全域を宣言して非ゼロのprogress受信時に止めるため、性能trialの件数より多く検査する場合がある。全域を完走する試験ではない。

生結果: [AT_SEARCH_BENCHMARK_20261002.json](benchmarks/AT_SEARCH_BENCHMARK_20261002.json)。source/kernel/request/mask SHA-256、完全なworkload recipe、境界、budget、反復ごとの値、ack coverage、候補数と保存件数を収録。全trialを直列に実行するが、共有マシン上の他処理は制御していない。

## 計測環境と意味

- Node v24.19.0 / V8 13.6.233.17-node.51、linux x64、AMD EPYC 9V74 80-Core Processor
- 各workload 4,194,304件×3反復。adapter前に同じworkloadの1024件をwarm-up。毎trialのWASM instanceは新規、プロセス全体のcold-start計測ではない
- adapter時間にはrequest clone/hash/instantiate/mask packing/chunk yield/候補保存を含む。JSON serializationは別計測。Worker転送時間は通常trialに含まず、中止検証だけ実Workerを使う
- raw kernel時間は同じmaskのsearch/scan_chunkだけ。instantiateとsetupを除外し、adapterの候補数との一致を検査
- low31 domainは0x12000000から4,194,304クラス、index domainは4,294,967,280から4,194,304index。両者は同じ状態集合ではない
- low31連続範囲は上位15bit出力を64種類含む局所範囲であり、全出力領域を代表しない。indexはLCG順に走査するため、両engineの候補数／速度を同一domain比較としない
- M/sは実検査数÷実時間の100万件/秒。low31はクラス数（各2つのuint32 lift）、indexは既知の合成seedに対するindex数（各1状態）

## 実測結果（3反復の中央値）

|engine|workload|adapter ms|adapter M/s|kernel M/s|候補数|
|---|---|---:|---:|---:|---:|
|low31|dense2-fixed|104.075|40.301|125.984|4194304|
|low31|sparse2-fixed|85.427|49.098|361.910|303816|
|low31|medium8-wide|320.409|13.090|17.074|3014656|
|low31|sparse8-mixed|223.304|18.783|28.337|292827|
|low31|dense32-fixed|758.438|5.530|6.538|4194304|
|low31|zero8-wide|78.171|53.655|885.103|0|
|low31|medium8-fixed|164.561|25.488|46.287|324158|
|index|dense2-fixed|18.353|228.533|258.650|4194304|
|index|sparse2-fixed|18.926|221.613|230.814|312237|
|index|medium8-wide|63.744|65.800|66.643|3051376|
|index|sparse8-mixed|124.457|33.701|35.290|301494|
|index|dense32-fixed|26.212|160.013|252.038|4194304|
|index|zero8-wide|51.762|81.031|86.333|0|
|index|medium8-fixed|21.239|197.481|216.811|328584|

medium8-fixedとmedium8-wideは同じ8個のmaskでgapのみ1→1..16に変更。今回adapter中央値はlow31で164.561→320.409ms、indexで21.239→63.744ms。gapを広げると候補も増え、同じ費用とはならない。32イベントdenseのlow31は758.438msで、2イベントdenseの104.075msより重い。単一の最高throughputから全探索時間を約束しない。

全trialは宣言範囲を完走し、unsearched区間は空。保存capはindexで7件、previewは別枠最大16件。4,194,304件見つかった場合も保存は7件であり、exportComplete=false。この0件・7件・全件の意味を検証している。low31は全候補の保存機能を追加しておらずpreview16件のまま。

## 正しさ・停止・メモリ

- 37検証ケース: 独立BigIntで小範囲全候補を照合、low31のacceptsとsearch件数／previewを照合、indexは全materialized候補まで一致
- sparse2-fixed／sparse8-mixedでは両engineに有効系列を埋め込み、非ゼロの真値保持と全候補集合一致を追加確認（4ケース）。自然に0件となるnegative workloadは別に保持
- low31の0/上限/high16境界、indexの2^31/2^32/uint64末尾、257件をchunk63で走査する端数、budget130での正確な未探索尾部を検証
- 実Worker中止は非ゼロack受信後に実行。結果coverageがそのackと完全一致することを検証。index側は約100ms単位の通知であり、chunk数そのものでは中止タイミングが決まらない
- cancelResolutionMsはcancel呼出しからホストPromiseの返却まで。Worker内部処理やOS thread終了の完了時間とは解釈しない
- raw WASM linear memoryとprocess RSSを別記録。process maxRSSにはoracle／Worker／JS／全trialが含まれ、workload単独のpeakではない。browser memory未測定

既存low31 47 assertions・index 634 assertionsも別途通過。新runnerのsmoke試験は37検証ケース＋14 workload（各257件）を実行。aggregate build／実ブラウザQAは未実施。

## 変更範囲

新規runner、runner回帰、本文、生の合成計測JSONのみ。既存engine・kernel・UI・build pipelineは変更しない。通常buildにベンチマークを自動追加しない。全世界再現や認識器の再学習は前提にしない。
