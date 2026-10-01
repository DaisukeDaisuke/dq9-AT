# Experimental ROM-derived monster ROI ranking

Open `monster-recognize.html`, choose a local Japanese DQ9 ROM, then a local image or video. Freeze a frame and draw a rectangle around one enemy. Select up to four candidate model families and an explicit variant assumption, then run the bounded CPU comparison. No table ID or AT seed is required. Files and generated imagery stay inside the browser; no ROM/image upload request is made.

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

Only relative, same-site catalog/WASM GETs are made by the recognition Worker. Media inputs use local object URLs and ROM/crop bytes go only to the local Worker through postMessage. No upload endpoint, telemetry, external model service or third-party image request is used.

## 任意のDINOv2特徴比較（2026-10-01）

同じ手動ROIとROM由来の姿勢画像を、DINOv2の画像特徴でも比較できます。「色ヒストグラム」は従来の比較です。AI特徴比較を選ぶ場合は「軽量」と単一variantを明示してください。1〜4モデル、最大64姿勢画像を使います。複数の向き・アニメーション候補は引き続き列挙し、回転不変とは仮定しません。大きさの正規化は行いますが、画面y座標からの実寸校正は未実装です。

初回は推論重みと推論ランタイムを匿名で取得し、Service Worker用のCacheStorageに保存します。推論重みはHugging Faceの[Xenova/dinov2-small](https://huggingface.co/Xenova/dinov2-small/tree/c2bb04a51fab207c420665f1946016107bffc701)の固定revision、ランタイムはjsDelivrのONNX Runtime Web1.23.2です。4ファイル合計36,427,661bytes（約34.74MiB）。URL・長さ・SHA-256を固定し、検証済みの公開依存ファイルだけをキャッシュします。重みやランタイム本体はGit/公開アプリの配布物には含めません。

NDSから取り出すモンスターの3Dデータと、DINOv2の推論重みは別物です。NDS・動画・画像・切り抜き・ROM生成テンプレート・特徴ベクトルは外部送信せず、CacheStorageにも保存しません。ROM由来の最大64特徴ベクトルは、そのWorker内の一時メモリにだけ保持します。アプリHTMLなどをまとめて保存するキャッシュではありません。

比較は現在CPU/WASMの1スレッドで動きます。DINOの計算予算は90秒、色比較は従来の30秒です。準備・比較の進捗を表示し、中止や入力変更で古い結果を破棄します。ダウンロード・整合性確認に失敗したときは、エラーを表示して色比較を明示的に選び直せます。別方式へ黙って切り替えません。

この実験のCPUでは、実際のWeb向けWASMをNode上で動かした最初の64テンプレート比較が約23.85秒、同じWorkerの次のROIが中央値約515msでした。ブラウザの速度保証や30fpsの主張ではありません。WebGPU推論は未検証・未実装で、使用を前提にしません。

### 主人公の中央領域を除外する設定

フィールド画面であることと、操作画面の配置を明示してください。OBS左右配置のプリセットは、1920×1080入力なら右側の960×720、DS縦配置なら下画面です。画像全体や手動範囲も指定できます。画像寸法だけでフィールド画面とは決めません。

中央除外を有効にすると、操作画面内の正規化範囲`x=.42,y=.36,w=.16,h=.24`を重ねて表示します。敵ROIが少しでも重なる場合は、画像特徴を計算せず「未観測・判別不能」とします。表示用の塗りつぶしを元画像や推論入力へ混ぜません。重なった敵も見送るため、敵の不在やAT候補の否定には使えません。この範囲は単独主人公の14枚のフィールド映像で確認した実験値で、他のカメラ配置や複数人パーティーを保証しません。近くの宝箱も巻き込まれることがあります。

### 現在分かっている精度の限界

新しい動画でスコアを見る前に固定した明瞭なフィールド切り抜き4枚では、色比較の先頭候補は2/4、DINOv2は4/4でした。銀スライムの2枚は同じ短い観測区間で、4体の独立テストではありません。騎士2枚も同一個体の可能性を残します。別の切れた白い敵はROIを広げると候補順が変わりました。

背景6枚にも候補順位が出ます。たいまつ・つぼ・主人公などを確実に棄却する閾値はありません。主人公の中央除外は一部の誤候補を減らしますが、たいまつやつぼの問題を解消しません。コサイン類似度は確率ではなく、候補外・判別不能を常に残します。自動全画面検出・出生判定・ATの自動絞り込みにはつながりません。

### 再現性と依存ライセンス

推論重みSHA-256は`3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917`、24,451,943bytesです。公開URL・ランタイム全3ファイルのハッシュ・キャッシュ上限64MiBは`web/monster-inference-assets.mjs`に記録しています。基礎モデルの[モデルカード](https://huggingface.co/facebook/dinov2-small)はApache-2.0を示し、[ONNX変換リポジトリ](https://huggingface.co/Xenova/dinov2-small/tree/c2bb04a51fab207c420665f1946016107bffc701)は基礎モデルを参照しています。変換リポジトリ自体はライセンスを再掲していません。[ONNX Runtime](https://github.com/microsoft/onnxruntime/blob/v1.23.2/LICENSE)はMITです。既存apiculaの帰属・ライセンスはそのまま保持します。

`node scripts/test-monster-recognition.mjs`から、既存の認識契約に加え、合成画像によるPillow前処理照合、AI特徴の上限・破棄・中止、中央除外、公開依存キャッシュの破損・版・再取得・中断を検査します。実ROM・動画・ダウンロードした推論ファイルは、このCI検査には不要です。UIの入力変更・中止・遅延結果の検査は`node scripts/test-monster-recognize-page.mjs`です。
