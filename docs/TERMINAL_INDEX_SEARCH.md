# 外部既知seedからの条件付き最終抽選index探索

既存ページの「探索方法」で `外部の既知初期seedと抽選indexで探す` を選びます。従来のlow31数値範囲探索は別のエンジンとカーネルのまま維持します。

## 入力

- 初期seed: 32bit unsigned、10進数または `0x` 付き16進数。外部で既知の値と出典・仮定を明記します。フォームはゲームでの正しさを検証しません。
- 最終抽選index: inclusiveの先頭・末尾と根拠・仮定。10進のuint64文字列、1〜18446744073709551615。範囲の長さは最大2147483648個です。大きいindexをJavaScript Numberへ変換しません。
- index 0は入力した初期状態、index 1は最初の抽選直後です。最終イベントindex 0は拒否します。
- 観測行: 2〜8個の種抽選を仮定した有限の直列順序。バックエンドの上限は32イベント、正の間隔、合計最大間隔256です。1イベント、未知の間隔・順序は未解決のままです。抽選を補って有限化しません。
- 計算予算: 最大検査index数、時間、チャンク数。証拠の上限ではありません。
- 候補保存上限: 枝全体で0〜100000レコード。検査予算や総候補数とは別です。

初期入力にはseedやindex範囲を埋めません。「合成例」は `0x12345678` と合成の範囲・間隔を使う操作例で、利用者のRTAや実機から得た値ではありません。

## 結果の読み方

結果座標は `absolute-terminal-draw-index-from-supplied-origin` です。探索済み／未探索は `searchedIndexIntervals` / `unsearchedIndexIntervals` であり、low31数値区間ではありません。表示件数は `candidateIndicesFound` です。

入力seedと1つのindexを固定すると、対応する32bit状態は1つです。bit31を反転した出力等価状態は、2³²周期内でindexが2³¹ずれた別の位置に対応します。画面はこの別indexを分けて示し、同じindexの2件目として数えません。絶対indexの証明、周期外の除外、現在映像のAT確定にはなりません。

先行履歴の準備は `min(最大間隔合計, 先頭index−1)` 抽選です。index 1未満へさかのぼらず、準備区間を検索対象の最終index件数へ含めません。未探索、範囲外、既存個体・再出現・誤認などの別解は保持します。出生の証明もイベントから目視時点への伝播も行いません。

進捗通知はおよそ100ms間隔にまとめます。中止時は最後に受信確認したチェックポイントを返します。通知前に内部計算が進んでいても、その部分は未探索として残ります。再実行は新しいWorkerで行い、再開済みとは表示しません。

## 候補の保存・JSON出力

候補を数える処理と、引き渡し用の候補レコードを保存する処理は別です。画面のサンプルは各枝最大16件で、JSONの `sampleCandidates` にも残ります。保存上限は `candidateMaterialization` の配列に適用し、この固定数のプレビューは別枠です。

`candidateMaterialization` は、基準index文字列 `baseTerminalIndex`、uint32の `indexOffsets`、対応する `states32` を保持します。絶対indexは `BigInt(baseTerminalIndex) + BigInt(indexOffsets[i])` で復元します。JSON保存時は既に上限で制限された配列だけを変換します。省略した候補を再構成する処理ではありません。

- `allFoundCandidatesMaterialized`: 発見済み候補を全件保存できたか
- `candidateExportCompleteWithinDeclaredDomain`: 宣言した範囲を全探索し、その全候補を保存できたか
- `truncated`: 発見数が保存数より多いか（未集計はnull）

例として100万件の候補を数えて7件保存した場合、7件を完全な候補集合とは表示しません。全範囲探索済みでも保存上限で省略されれば出力は不完全です。枝の候補数や保存レコードを足して、重複のない全候補数とは扱いません。完全保存や未探索部分の再評価には、適切な予算・上限を明示して再実行する必要があります。

## 再現可能な配信と確認

`web/wasm/at_identify_stream.wasm` はROM等を入力とせず、同梱Cソースから作成した2475byteのカーネルです。

SHA-256: `fe39118a209b516d55456ded498a2dfc627cf473d248c29dd176e5316a9ca955`

`build.sh` は既存カーネルとは別にhash/ABIを検査し、実Workerのアダプタテストとフォームテストを実行します。Actionsの任意バージョンのclangでこのカーネルを上書きしません。再ビルドにはemsdk 3.1.6のupstream clangを明示します。

```sh
CLANG=/path/to/emsdk-3.1.6/upstream/bin/clang bash scripts/build-at-identify-stream.sh
bash scripts/build-at-identify-stream.sh --verify
node scripts/test-at-identify-index.mjs
node scripts/test-at-identify-index-page.mjs
node scripts/test-at-identify-page.mjs
```

別コンパイラの成果物は同値性の再レビューが必要です。hash guardを緩めないでください。Nodeの最小DOMハーネスによる保存内容検査を、ブラウザ上でダウンロード完了した証拠とは扱いません。

## 検証の由来（2026-09-30）

- 受入済み上流engine SHA-256: `90db433108ff22cf202ae4f1825e670589af0b39257e8b66cce37332006bec99`
- uint64入力ガード修正後の上流form SHA-256: `4ed50bbe766d87226960c07a50d29b9871a25e39da57cb89b71d8fad27b57e3d`
- カーネルC SHA-256: `4431f8f64df30111980d2f3f32497dbf8c9ec1f03882e7b981ab1ab72ac68f41`
- 本番移植でアダプタの変更は相対import先だけです。数値計算、coverage、Workerライフサイクルは変更しません。
- アダプタの634チェック、フォームの122チェック、既存フォームの83チェック、既存AT回帰4件を実行。数値/WorkerとUI契約は別々に読取レビューしました。実ブラウザの見た目・保存完了の検証はこのNode実行結果に含みません。
- 独立レビュー: 数値16412検査/39有限ケース、Worker33ケース、精度入力20ケースで受入。レビュー記録SHA-256: `a7b6ddaf2469f807c24ddaf17082c3cf8232f71f848aff006f33bc3c23afbe10`。これらも実ゲームの初期seed・観測対応を証明するものではありません。
