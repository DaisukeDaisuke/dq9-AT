# 観測した地図の点から map ID 候補を逆引き

`map-recognize.html` の既存「文字→画像照合」で、ROMフォントから地図名を読み、同じフレームの地図画像とパーティ点候補を照合した後に実行する。正解の家IDを一覧で選ぶ必要はない。参照ビューの選択とは独立している。

入力は `factorPartyMapCandidates` の同一フレームの descriptor × marker × registration peak。各点を合成地図画像へ逆変換した位置・誤差矩形と、`map-coordinate-index.mjs` の固定表示点を比較する。名前候補に含まれていない map ID も、その descriptor の固定点と一致すれば出力する。名称・内部ラベル・field code は投入NDSの既存 map records を使い、固定点をすべて「民家」と呼ばない。

- 点の誤差矩形を「建物位置の追加許容 px」（初期値4、0〜64）で広げ、その範囲にある全固定点を残す。距離順は表示順だけで、最近傍を現在地として確定しない。
- 同一建物の階層、別館・改装状態、複数マーカー、弱い登録ピーク、別descriptorを保持する。画像の最上位の位置候補で支持されるかも分けて表示する。
- 通常の物理座標として表示する別mapの可能性は `physicalMapIds` として残す。点だけで屋内滞在を証明できない。
- 変換・許容幅・点の本人対応・表示モードは未校正。`currentMapId:null`、`mapIdentityResolved:false`、`minimumProvenATCalls:0` のまま。室内の人物の物理X/Zは復元しない。
- 最大4096位置分岐を評価し、上限・無効分岐があれば未評価数とunknown理由を残す。画面は最大24候補、残りは既存の観測ログ／点の軌跡JSONに保持する。
- ROM解放、動画の切替・seek、許容幅変更などは従来の世代管理で古い結果を無効化する。保持画像追跡では現在フレームの点から毎回計算し直す。

実装: `web/map-position-identification.mjs`、`web/video-panel.mjs`。追加の独立ビューやエクスポートは設けない。

## 検証

`node scripts/test-map-position-identification.mjs [明示したローカルROM]`

`node --experimental-vm-modules scripts/check-video-panel-capture.mjs`

前者は点→ID・階層重複・複数分岐・屋外位置・範囲外・上限を検証。後者は実パネルの非同期処理を模擬し、家を選択せず候補が出ること、取得・追跡・設定変更・解放・任意索引失敗を検証する。

別途、非公開のオリジナルnativeキャプチャ2枚（武器屋／道具屋）を、画面検出→名前枠→実ROM字形CPU照合→同名57 ID→C01画像登録→点検出→逆引きの順に実行した。固定点候補はそれぞれ map104／map108、点との差は約1.40px／0.91px。正解記録は予測後の比較にのみ使用。追加許容0/1/2/4/8pxで同結果。CPU文字は未確定候補のまま利用し、未探索の文字／マップ候補を残した。これは静止したnative実画素での検証で、圧縮動画や全建物の認識率を示さない。ROM・画像・字形・private実行結果は公開リポジトリに含めない。
