# dq9-AT

DQ9の日本語版NDSを投入し、上画面マップ、静的フィールドノード、エリア別エンカウント参照をブラウザ内で採掘するWebAssemblyアプリ。既知initial AT seedの下限と条件付き候補を別管理し、映像入力・ROMフォントによるマップ名候補を接続しています。人間向け連続メタルポップ・ナビゲータ全体は開発中です。

## 使い方
公開ページまたはHTTP配信した `web/index.html` でNDSを選択／ドロップします。ROMはサーバーへ送信しません。

マップを名称・ID・field codeで検索すると、上画面画像と対応する静的フィールドグラフを表示します。「フィールドノード・エリア」でノードとゲーム内時間を選ぶと、生成地点のareaMaskに従う自然生成table候補を取得します。時間不明は候補を併合します。XZグラフはモンスターの移動・生成候補であり、プレイヤーの通行可能経路や現在位置ではありません。全経路単独表示、座標・隣接順、JSON／CSV保存も利用できます。

「AT追跡」で外部から既知initial seedを入力します。証明済み下限と条件付き候補は別管理です。ノードを選択して未来候補を計算すると、表選択→monster選択まで到達した場合の連続2消費のメタル候補を表示します。失敗試行・monster移動・フレーム時刻まで再現した予告ではありません。未知の消費を下限へ自動加算しません。

「映像入力・マップ名候補」ではカメラ（OBS Virtual Camera等）を選択し、元映像上をドラッグして上画面、上画面プレビュー上をドラッグして文字範囲を指定します。「NDSフォント生成」で実ROMフォントをメモリ内生成し、既存WebGPU scorerで辞書候補を照合します。候補スコアは実映像で未校正です。候補のクリックは表示マップを変えるだけで、実機位置の確定やAT下限の加算ではありません。映像停止・候補ログは保存できます。画像・フォント本体を自動保存しません。

## 実データで確認した範囲（2026-09-30）
|対象|実行結果|
|---|---|
|maplist9|1,010構造レコードを保持|
|上画面画像|268 OBG＋150 PAC、283配置合成（既存実ROM経路）|
|静的field graph|151/151グラフ、3,934ノード、6,044接続、エラー0|
|実RAMとのノード照合|ふういんのほこら26、エラフィタ47。ID・XYZ・area・隣接順すべて一致|
|map→table参照|210map／287参照。既存enc.jsonの分布は再生成しない|
|実AT列と本番WASM|160消費／95 ATRandInt／16生成関数入力、不一致0|
|観測branchを与えたtable→weighted|16件すべて一致。生成成功やフレーム再現とは別|
|ROMフォント|4サイズ、2,588字形、99名称434テンプレート。実GPU照合精度は未測定|

静的経路と結合できたmaprecordは151件、残り859件は未結合／動的として保持しています。既存enc.jsonにないtable276..279（map10000）は未解決として明示します。全マップの動的グラフ、起動から映像だけで下限を前進させる証拠、自位置、3D monster認識、field scheduler、人間向け移動最適化は未完成です。

## ビルド／配信
この作業は `fuzzy-goggles-r4vqvwgrw943p5r9` のclang18＋lld18でビルドしました。
```sh
bash scripts/build.sh
python3 -m http.server 8000 --directory web
```
`.github/workflows/pages.yml` は同じCソースをWASMにビルドし、`web/`をGitHub Pagesへ配信します。ROM、state、抽出モデル・画像・生成フォントは同梱しません。ノード座標など解析メタデータとゲーム描画アセットを区別します。

## 実データ経路の再実行
```sh
node scripts/run-map-mining.mjs /path/to/dq9_new2.nds
node scripts/run-field-mining.mjs /path/to/dq9_new2.nds
node scripts/run-at-replay.mjs
```
実ROM採掘・記録済み実測列の本番実行用CLIです。新規テスト基盤ではありません。画像観測はリポジトリ外 `../dq9-at-observations/`、解析記録は `docs/mining/` と `docs/observations/` に保存します。

## 引継ぎ
最新チェックポイントは `docs/CONTINUATION_20260930.md`、全体計画は `PLAN.md`、決定事項は `DECISIONS.md`、経過は `docs/PROGRESS.md`。逆解析根拠は `docs/ghidra/07-field-graph-loader.md` と `08-field-at-control-flow.md`、映像再利用元と制限は `docs/VIDEO_PIPELINE_20260930.md`、問題と対応は `docs/ISSUES_20260930.md`。
`protocol.txt` は利用者所有です。作業中約10分ごと、公開前、終了前に読み、上書きしません。
