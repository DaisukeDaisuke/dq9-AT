# DQ9 AT 日報 — 2026-10-04 JST

## 00:15 JST — 木を含む屋外表示をブラウザCPU経路で確認

前日の実動画位置合わせ・差分・AT準備から継続。

- ふういんのほこら入口D04の主モデルにある9個のYビルボード木ノードを接続。元ROMのエミュレータ実行から特定したnode6/7/8では、source nodeとcameraから再構成したmodelview全16word、専用callback全72byteが一致。ROM内templateからの再構成も一致。
- 主要model単体23draw/287triangles、既存静的2instanceを追加した公開経路は26draw/299triangles。原形を残すD04M02描画のRGBAhashは以前と同じ。
- dotクラウドブラウザで元ROMを選択し、D04の明示texture/profile、適用済みcamera行列snapshotを入力。実際のCPU/Canvas2D描画を確認。
- Nodeとブラウザの生成RGBA SHA-256はともに `f7f253061c24ef0808abffbb2e09a18a02598871ebca9dfd08e48939cdd077be`。Canvas読戻しは半透明495pixelsに最大1の差があり、不透明差0。差は保持しておりDS画素一致とは扱わない。
- 屋外の実測cameraにはareaBlendMask=4がある。通常player-follow入口の未対応guardを消さず、明示した適用済み行列snapshotの表示に分離した。このsnapshotではマップクリック追従を拒否する。クリックからの実際のcamera遷移は残作業。
- 公開source/deploy `04291048fa042fbab63344740054e40d821d132d`。ツールの通常backup `dots-tools:18b567b2b03c0f9cde522f782ddbe66406a54994`、新規10sourceを読戻し確認済み。ゲーム資産・動画・RAM・生成画像はGitへ追加していない。

## 続行項目

全マップ対応が目標。現在の屋外recipeを全mapの受入とは数えない。残6木nodeはsource-derived表示まででnative packet比較は未実施。動的可視性、特殊model、各場面のmaterial globals、霧・DS raster差は未解決。
実動画での上画面アキネーチャー候補XZ→背景描画→残差を接続済みだが、壁・霧・主人公・UIの差を敵として誤認しない識別が必要。文字誤読・位置/カメラ不確実性を保持し、未確定観測をAT消費へ加算しない。実DSは未使用。比較対象は原ROMのエミュレータ実行である。
