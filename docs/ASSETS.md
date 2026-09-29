# 再利用資産 / C01
2026-09-29。既存CSV/JSONは内容を変更せずコピー。
|入力（tunnelworkspace相対）|出力|用途|
|---|---|---|
|enc.json|web/data/enc.json|解析済encounter table。再採掘しない|
|LocalAI/work/dq9-respawn-timer/data/map-id-names.csv|web/data/map-id-names.csv|510 map IDsと日本語名|
|同/map-name-catalog.csv|web/data/map-name-catalog.csv|名称catalog|
|BattleArrow/Restricted-behavior/dq9items - Monsters.csv|web/data/monsters.csv|monster/model/name|
|BattleArrow/nitro-fs.js|web/vendor/nitro-fs.mjs|既存FNT/FAT parser。拡張子のみ変更|
|BattleArrow/gp2.js|web/vendor/gp2.js|既存GP2 decompress/entry parser|
|rand.js|web/vendor/rand.js|後続AT追跡|
## 読解した既存解析
LocalAI/work/NDS_DATA_INVENTORY.mdおよびdq9-map-name-extractor/extract-map-id-names.mjs。mapname.binは解析済なので実行し直さない。maplist9.binは同じ可変長call stream。既存parseCalls関数を再利用する。Fountain READMEとdq9下の対象検索はmap/minimap新規知見なし。必要以上に全探索しない。
## 後続工程で使う資産
vendor/nds-font-converter（Nds9ToFonts.jsリポジトリ全体、実コードは内側nds-font-converter）、vendor/apicula、BattleArrow/narc.js、font_akinator_webgpu.html、BattleArrow/BattleEmulator/public/vision.js。
現段階でNCG.parseはRGBAの確保長が入力バイト数のままであり、tilemap組立ても行わない。上画面map描画にそのまま使えるとは扱わない。実形式を確認し、不足するtile合成をWASMへ実装する。
