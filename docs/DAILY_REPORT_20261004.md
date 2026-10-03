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


## 01:35 JST 地上マップ材質色の直前writerを実測

元ROMのエミュレータ実行で、F06M0400の材質1がROM値2529FFFFからRAM値41E5FFFFへ変わる直前writer020B8BCCを捕捉。元SDKの実行命令と96bytes一致し、観測した入力からの書込み再現も一致した。全材質ループ020B8D78、環境値適用02053808と環境+40の実測値まで接続。時間帯・イベントから環境値を決める上流は未検証。

実測RAM材質を明示入力したCPU照明計算では、元描画と位置・UVが完全一致した1490頂点のうち1489頂点で少なくとも一つの元描画色に一致（全重複候補一致1487）。残り1頂点、未対応テクスチャ変換、対応キーなし5463頂点を保持。全マップ・全画素・モンスター認識の合格ではない。旧ROM材質のみの0/1490結果と失敗観測を保存し、既存評価の条件は変更していない。

解析注釈は[dqix-functionsの材質writer記録](https://github.com/DaisukeDaisuke/dqix-functions/blob/16557038993341ec540179a47278ee70b0130535/docs/jpn-field-ambient-writer-20261004.md)。再開用私的checkpointはLibrary v7へ保存済み。ソース7本は非公開ツールrepoへ通常pushしremoteでbyte一致確認。ROM/RAM/State/動画/抽出資産はGitに含めていない。


## 03:28 JST — 元の見逃し2フレームを再現

- 固定D0の125.850/125.900秒を元のRGBA hashで照合し、元の候補・除外理由・coverageを完全一致再生した。中央除外矩形に敵候補が重なり、みいらおとこの候補が棄却されることを確認。中央除外OFFでは敵候補が戻るが主人公候補も戻る。製品設定や閾値は変更していない。
- 125.000秒の別フレームでは基準方式が既に敵身体を検出していた。同地点差分の背景誤差は減ったが、このフレームの身体検出は改善せず、未対応候補の増加等も残った。元の失敗フレームと混同しない。
- 再現コード9ファイルをprivate dots-toolsの通常更新2ca98eb82d166bc88b155614057eecf42b6d3883へ保存し、全ファイルをremote読戻し一致確認。私的結果は既存Library checkpoint v10へ保存（675payload、CRC/hash照合済み）。動画・画像・RAM・ゲーム資産はGitへ追加していない。
- 分類精度向上、主人公誤認解消、全マップ完成、実動画AT特定は未達。中央境界の候補構造を調べ、失敗を保持したまま最小修正を検証する。
