# Experimental ROM-derived monster ROI ranking

Open `monster-recognize.html`, choose a local Japanese DQ9 ROM, then a local image or video. Freeze a frame and draw a rectangle around one enemy. Select up to four candidate model families and an explicit variant assumption, then run the bounded comparison with an explicit feature/provider choice. No table ID or AT seed is required. Files and generated imagery stay inside the browser; no ROM/image upload request is made.

The default candidate scope is orange spirit/z019b, white bandaged/z021a, ochre knight/z064a and silver slime/z000c. Other catalog models may be selected, but unsupported assets/clips remain explicitly reported. All species aliases of a selected model remain attached; z000c retains IDs3 and297. This does not identify an arbitrary enemy outside the selected candidate scope.

The page returns ranked model/pose candidates and an always-present unknown option. Distance is an experimental descriptor score, not a probability or calibrated acceptance boundary. Background/UI and other species can rank highly. No automatic detection, safe hard pruning, birth proof, AT consumption count or current AT recovery is performed.

## ROM-only pipeline

Existing NitroFS/monster asset extraction reads the explicitly selected model variants and animation files. The existing WASM geometry decoder accepts exact NSBCA local object matrices and replays its SBC stack/hierarchy. Supported animation curves are complete rate0 integer samples only. Unsupported encodings are not silently interpolated or substituted.

Quick mode uses bind pose and the middle stored frame of stand/run/appear, four azimuths and a45-degree hypothetical elevation. Standard uses bind plus frame0/middle for each clip, eight azimuths and the same elevation. These uniform defaults were set before the page smoke test; they do not select a privately fitted native phase. One common bounding volume is used across the chosen poses of each model variant.

The existing cancellable template bank now includes clip/frame/decoder identity and common bounds in its cache key. A CPU renderer reuses the existing canonical template projection and unlit materials. The manual crop is compared to generated templates using a24-component hue/saturation histogram, explicit bilinear48px normalization and a fixed, scene-specific blue/teal exclusion heuristic. This is a new ROM-only experimental scorer; prior video-exemplar accuracy numbers do not apply to it. No exemplar images or learned feature-bank bytes are shipped.

## Bounds and lifecycle

- Up to4 selected models and8 explicit model/variant requests
- At most256 rendered templates per job;64px tiles
- Up to8MiB retained pose geometry/material data per model and8MiB template cache
- ROI up to1024×1024; source dimensions at most4096×4096
-30-second cooperative processing budget; CPU rendering yields between views and triangle batches
- Cancel terminates the page's Worker; a later run reloads the selected local ROM
- Frozen pixel identity, ROM/source epochs and ROI are carried in one capture stamp; stale work cannot replace a newer result

The parser relies on the project's existing NitroFS extraction code. The page checks size/game code, but it is not a general hardened validator for adversarial NDS containers.

## Validation and limitations

Portable Node checks cover the exact-sample parser, malformed/truncated inputs, synthetic identity, crop bounds, template budgets, pose/session cache identity, aliases, CPU rendering and Worker error handling. Private actual-ROM checks additionally cover load→rank, cancellation after progress, restart parity and invalid ROI rejection. Existing static template/preview tests remain applicable.

The page is useful as an experimental manual-crop ranking tool. Its real-video accuracy and false-acceptance rate are not validated. A separate controlled rendering diagnostic established useful animated pose coverage, but that does not establish classifier generalization. CPU timings are per-job measurements, not30/60fps claims. WebGPU is not required for this slice; no actual GPU validation is claimed.

`web/monster-animation.mjs` adapts the vendored apicula format reader (scurest, Copyright2019,0BSD). The full license is published at `web/licenses/apicula-0BSD.txt`. No generated game assets are included in the publication.

## Browser smoke check

1. Open the page through the deployed site and select a local JapaneseDQ9 NDS
2. Select a local image or video; for video, pause/seek and press the frame-freeze control
3. Drag around one visible enemy or enter integerXYWH. The crop preview must match the frozen image
4. Leave the four default families, explicit `_f` assumption and quick mode, then start
5. Expect progress, up to four ranked model/pose thumbnails, every species alias, coverage and an unknown notice. No AT value changes
6. Cancel a run, restart, change the ROI/image/ROM, and verify prior rankings disappear and late results cannot return

The original color comparison uses relative, same-site catalog/WASM GETs. Optional DINO setup additionally fetches only the pinned public inference assets described below. Media inputs use local object URLs and ROM/crop bytes go only to the local Worker through postMessage. No upload endpoint, telemetry, external model service or third-party image request is used.

## 任意のDINOv2特徴比較（2026-10-01）

同じ手動ROIとROM由来の姿勢画像を、DINOv2の画像特徴でも比較できます。「色ヒストグラム」は従来の比較です。AI特徴比較を選ぶ場合は「軽量」と単一variantを明示してください。1〜4モデル、最大64姿勢画像を使います。複数の向き・アニメーション候補は引き続き列挙し、回転不変とは仮定しません。大きさの正規化は行いますが、画面y座標からの実寸校正は未実装です。

初回は推論重みと推論ランタイムを匿名で取得し、Service Worker用のCacheStorageに保存します。推論重みはHugging Faceの[Xenova/dinov2-small](https://huggingface.co/Xenova/dinov2-small/tree/c2bb04a51fab207c420665f1946016107bffc701)の固定revision、ランタイムはjsDelivrのONNX Runtime Web1.23.2です。CPU/WASM・int8は4ファイル合計36,427,661bytes（約34.74MiB）、WebGPU・FP16は70,045,098bytes（約66.80MiB）です。選択した方式の4ファイルだけを取得します。両方式を準備した場合は合計106,472,759bytesで、専用の公開依存キャッシュ上限は128MiBです。URL・長さ・SHA-256を固定し、検証済みの公開依存ファイルだけをキャッシュします。重みやランタイム本体はGit/公開アプリの配布物には含めません。

NDSから取り出すモンスターの3Dデータと、DINOv2の推論重みは別物です。NDS・動画・画像・切り抜き・ROM生成画像は外部送信・永続保存しません。要求したROM姿勢の特徴ベクトルとその識別メタデータだけは、公開依存キャッシュとは別のバージョン付きCacheStorageへ保存します。Worker内では最大64ベクトルを保持し、永続キャッシュは最大256バンク・32MiBの実際の保存サイズに制限します。アプリHTMLなどをまとめて保存するキャッシュではありません。

推論は「CPU/WASM・int8」と「WebGPU・FP16」を明示的に選択します。CPU/WASMは従来の1スレッドです。WebGPUにはshader-f16対応のGPUが必要で、取得した実際の推論デバイスでも確認します。形状処理など一部でCPU/WASMを併用する場合があり、全演算がGPU上とは断言しません。未対応・初期化失敗時はエラーを表示し、CPUを明示的に選択できます。DINOの計算予算は90秒、色比較は従来の30秒です。いずれも処理の間で確認する協調的な予算で、停止したGPU/APIの待機を自動的に強制終了するものではありません。「中止」はWorkerを終了します。準備・比較の進捗を表示し、中止や入力変更で古い結果を破棄します。ダウンロード・整合性確認に失敗したときは、エラーを表示して色比較を明示的に選び直せます。別方式へ黙って切り替えません。

この実験のCPUでは、実際のWeb向けWASMをNode上で動かした最初の64テンプレート比較が約23.85秒、同じWorkerの次のROIが中央値約515msでした。ブラウザの速度保証や30fpsの主張ではありません。WebGPUの実機速度・安定性はまだ検証していません。UIは公開ファイル準備とダウンロード、推論初期化、姿勢特徴の新規計算・再利用件数、切り抜きの推論時間を分けて表示します。初回生成が瞬時になる保証はありません。

### 姿勢特徴の保存と再利用

要求したモデルごとに、完成した姿勢バンクだけを保存します。1モデルは最大16姿勢です。キーはROM全体のSHA-256、推論重み・固定revision・実行方式・精度、描画/姿勢選択/前処理の版、そのモデルID・variant・視点を含みます。候補セット全体や選択順はキーに含めません。保存内容と識別情報のSHA-256も検証します。CPU/int8とGPU/FP16、別ROM、異なる姿勢条件を取り違えて再利用しません。

同じ条件での再読込後は、選んだ各モデルの保存済み姿勢特徴を読み、再推論を省けます。切り抜き画像の推論、ROM読込、比較用の描画などは残ります。初めて要求したモデルの準備時間は必要です。たとえばA/B/C/DからA/B/C/Eへ候補を変えた場合、A/B/Cは保存済みの特徴を再利用し、新規のEだけを計算します。候補の選択順を逆にしても再計算しません。全モンスターの一括生成や、未確認の次マップの自動先読みは行いません。

保存済みバンクはLRUで上限内に保ち、要求した最大4モデルのバンクを順に読み、特徴ベクトルのメモリ保持は合計64件までです。Web Locksで複数タブの書込みを調整し、1バンク全体を完成してからCacheStorageへ置きます。容量不足・破損・API未対応なら理由を表示して再生成し、保存成功とは表示しません。「保存した姿勢特徴を消去」はこの専用キャッシュを消し、公開AI依存ファイルは保持します。ブラウザーによるストレージ削除でも再生成が必要になります。

### 主人公の中央領域を除外する設定

フィールド画面であることと、操作画面の配置を明示してください。OBS左右配置のプリセットは、1920×1080入力なら右側の960×720、DS縦配置なら下画面です。画像全体や手動範囲も指定できます。画像寸法だけでフィールド画面とは決めません。

中央除外を有効にすると、操作画面内の正規化範囲`x=.42,y=.36,w=.16,h=.24`を重ねて表示します。敵ROIが少しでも重なる場合は、画像特徴を計算せず「未観測・判別不能」とします。表示用の塗りつぶしを元画像や推論入力へ混ぜません。重なった敵も見送るため、敵の不在やAT候補の否定には使えません。この範囲は単独主人公の14枚のフィールド映像で確認した実験値で、他のカメラ配置や複数人パーティーを保証しません。近くの宝箱も巻き込まれることがあります。

### 現在分かっている精度の限界

新しい動画でスコアを見る前に固定した明瞭なフィールド切り抜き4枚では、色比較の先頭候補は2/4、DINOv2は4/4でした。銀スライムの2枚は同じ短い観測区間で、4体の独立テストではありません。騎士2枚も同一個体の可能性を残します。別の切れた白い敵はROIを広げると候補順が変わりました。

背景6枚にも候補順位が出ます。たいまつ・つぼ・主人公などを確実に棄却する閾値はありません。主人公の中央除外は一部の誤候補を減らしますが、たいまつやつぼの問題を解消しません。コサイン類似度は確率ではなく、候補外・判別不能を常に残します。自動全画面検出・出生判定・ATの自動絞り込みにはつながりません。

### 再現性と依存ライセンス

CPU用int8推論重みSHA-256は`3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917`、24,451,943bytesです。GPU用FP16は同じ固定revisionの`model_fp16.onnx`、44,427,534bytes、SHA-256`4e9ea6fe106e2225e28ee3c1c3d53b5b92aa4af62142f6ed6b66b6a92213cf04`です。両方式の特徴量を混用しません。公開URL・各方式のランタイム3ファイルのハッシュ・キャッシュ上限128MiBは`web/monster-inference-assets.mjs`に記録しています。基礎モデルの[モデルカード](https://huggingface.co/facebook/dinov2-small)はApache-2.0を示し、[ONNX変換リポジトリ](https://huggingface.co/Xenova/dinov2-small/tree/c2bb04a51fab207c420665f1946016107bffc701)は基礎モデルを参照しています。変換リポジトリ自体はライセンスを再掲していません。[ONNX Runtime](https://github.com/microsoft/onnxruntime/blob/v1.23.2/LICENSE)はMITです。既存apiculaの帰属・ライセンスはそのまま保持します。

`node scripts/test-monster-recognition.mjs`から、既存の認識契約に加え、合成画像によるPillow前処理照合、AI特徴の上限・破棄・中止、中央除外、公開依存キャッシュの破損・版・再取得・中断、特徴キャッシュの識別・完了書込み・上限・LRU・消去・中断・破損を検査します。実ROM・動画・ダウンロードした推論ファイルは、このCI検査には不要です。UIの入力変更・中止・遅延結果の検査は`node scripts/test-monster-recognize-page.mjs`です。

### WebGPUと保存特徴の確認手順

1. HTTPSの公開ページでNDSとローカル画像を選び、敵のROIを指定し、DINOv2・クイック・単一variantを選択します
2. CPU/WASMで照合し、完了後にページを再読み込みして同じROM・候補条件を選びます。2回目は「保存から」と再利用件数を確認します。候補を1種類だけ追加・交換した場合は、その未保存モデルだけが新規計算されます。毎回の切り抜き推論時間は残ります
3. WebGPU/FP16を明示選択します。非対応ならCPUへ自動変更せずエラーになり、対応時は選択方式の公開依存ファイルを準備します
4. GPUで初回完了後に再照合し、新規姿勢計算と再利用の時間・件数を比較します。GPUの実機検証が完了するまで速度向上を保証しません
5. 中止・実行方式変更・キャッシュ消去を試し、古い順位が戻らないことと、消去後の新規計算を確認します
