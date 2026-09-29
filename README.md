# dq9-AT

DQ9の上画面マップを、利用者が投入した日本語版NDSからブラウザ内で採掘・表示するWebAssemblyアプリ。長期目的は既知initial AT seedを起点とするメタル系連続ポップ・ナビゲータ。現段階はマップ採掘のP0。

## 使い方
公開ページ、またはHTTP配信した `web/index.html` を開き、NDSを選択／ドロップする。ROMはサーバーへ送信しない。
マップを名称・ID・field codeで検索し、配置候補を選択する。通常画像・配置・特殊パックの一覧にも切り替え可能。PNG、元データ、選択／全メタデータJSON、マップCSVを保存できる。NDS解放でWorkerと展開データを破棄する。
既存enc.jsonは別欄で閲覧可能だが、現在エリアへの自動結合は未実装。map IDだけで表を固定しない。

## 実ROMで確認済みの範囲
`dq9_new2.nds`、既存CSV、Codespaceでビルドした本番WASMを `scripts/run-map-mining.mjs` で実行。
- maplist9: 1,010構造レコードを保持。既存日本語名CSVは510件を再利用。
- 通常上画面画像OBG: 268/268件をデコード。BMMP配置合成:283/283件成功。
- 特殊マップPAC:150/150件をデコード。画像合計418件、デコードエラー0件。
- 通常配置候補と結合した構造レコード:438件。残りも一覧／出力から除外せず、未結合として残す。

ブラウザ操作確認はprotocolの指示により未実施。確認したのは実ROM・本番parser・本番WASMの実行と抽出画像。プレビューはマップ素材の合成であり、実機UI・スクロール・現在位置・探索状態や動的生成階層を再現した画面ではない。

## ビルド／配信
Codespaceでclang18とlld18を使用する。
```sh
bash scripts/build.sh
python3 -m http.server 8000 --directory web
```
GitHub Actions `.github/workflows/pages.yml` は同じCソースをWASMにビルドし、`web/`だけをGitHub Pagesへ配信する。ROM、state、抽出PNG、モデル、フォントは同梱しない。

## 実ROM採掘の再実行
```sh
node scripts/run-map-mining.mjs /path/to/dq9_new2.nds
```
出力は `docs/mining/map-metadata.json` と `docs/observations/actual-map-wasm.json`。画像観測はリポジトリ外の `../dq9-at-observations/` に保存する。これは本番マイニングのCLIであり、テスト基盤ではない。

## 引継ぎ
優先度と完了条件: `PLAN.md`。決定仕様:`DECISIONS.md`。経過:`docs/PROGRESS.md`。再利用元:`docs/ASSETS.md`。通常マップ形式:`docs/mining/MAP_FORMAT.md`。特殊形式:`docs/mining/PAC_FORMAT.md`。逆解析根拠:`docs/ghidra/`。
`protocol.txt` は利用者所有の通信ファイル。作業中約10分ごと、公開前、終了前に読む。

P1以降: 指定装備別stateの観測、エリア切替／AT消費の証明、既知seedの起動からの追跡、既存フォント・映像資産の統合、3Dモンスター認識、連続ナビ。未証明AT消費を下限に加算しない。
