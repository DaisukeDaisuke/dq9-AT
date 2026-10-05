# DQ9 AT / 映像認識 日報 2026-10-06

## 00:30 JST — native背景・身体描画の接続と動画隣接フレーム

目標は全マップの動画再生中に、ROMに基づくモンスター種類の識別結果をAT探索へ接続すること。以下は局所実測と実装checkpointであり、全自動化完成ではない。

### 実ブラウザ

- 公開runtime e17f6f47で1ninnの227.250秒を通常の動画入力から自動比較。542残差を保持、既存3×3両寸法条件で451小断片を比較対象から外し、32領域を比較した。閾値・予算は変更していない。
- 領域196、箱(148,51,12,10)は条件付きメタルスライム候補1件。元動画画像の目視でも同じ箱に灰色の身体がある。gainは120595。種別・出生・AT消費の証明とは扱わない。
- この固定画像のRGBA SHA256は02e32a3df8cc09ff403c455734e0e7233a0af1d2db4b60d9bd714a0a11dadaa4。以前の227.000秒/領域239、227.012秒/領域233とは別の入力として保存した。
- 比較位置ずれ(-4,14)px、44856画素を比較、4296画素は未描画・半透明・画像外。RGB平均差13.659。霧位相と現行カメラの確定は残る。

### S04背景描画の実装

- 同名地図の固定表示点を主人公の実座標へ変換せず、S04の独立した未位置確定候補として保持する経路を実装。物理F02だけを同名地図の唯一候補としてキャッシュしない。
- ROM由来type4カメラ、分岐した床面、短い実パレット、初期clear色とalpha、透明fragmentのunknown扱いを接続中。既存成功入力・未対応の拒否を保存。
- S04のclip後の水平退化polygonが全体描画を拒否する問題を最小修正。nativeの通常edge walkで0 samplesになる条件を再現し、pose変更や閾値緩和はしていない。
- この修正はsource比較121入力、synthetic48 checksで確認。既存S04成功5候補のRGBA・mask・統計・診断は不変。D09の25 fragments、D04の26 polygon結果も保持した。
- 冷間処理の旧約390秒の全surface最終描画を標準経路にはせず、source-depth基底再利用と有限予算の経路へ変更中。実動画隣接入力では複数の通過背景が残るため、単一カメラ確定へ丸めない。

### モンスター身体

- SBC9 NODEMIXのsource整数演算とcache寿命を実装。実ARM96ケース・1799termsで位置12成分と方向9成分が一致。実assetの17命令・45termsでも非cache経路を確認。weight総和255を256へ正規化しない。
- BB/BBYは実ARM768ケースでpacket・matrix・restore/store・進行が一致。呼出し間templateの保持が必要であり、未知のlive flagsやcallback条件を初期値で埋めない。
- 正式状態の同一native drawでz019bの7個のNODEMIX packet、84成分が一致。実GPUの全framebuffer一致ではない。
- 元GXを保つnative身体描画ではF01のモーモン自身の支持が1200.000/1200.017秒の両方で正になった。ただしz000cの支持がより高く、単独の種類確定はできない。半透明の比較条件が不足する候補も保持する。
- 既存1ninn小メタル身体の2入力はnative経路でも正の支持を保持。F04の背景をギズモとする誤候補は、未証明の半透明合成・destination条件があり未解決。

### 継続中

- S04の有限予算経路、複数背景の共通/個別残差を公開経路へ統合し、実ブラウザで再検証する。
- 身体のsource-native支持を候補別に接続する。外観順位、未対応候補、ATのunknown/no-event枝を保持し、正のgainだけで確定しない。
- 霧のreload epochからsource描画stateへの接続と、実動画入場時刻との対応を続ける。歴史動画と正式保存状態のparty人数・実行履歴は異なり、同期を仮定しない。

ROM・SAV・RAM・動画・抽出ゲーム資産はGitに含めていない。公開反映とcheckpointのみのソースは区別して記録する。

### 霧のsource clock

- 実測reload epochから、実際に通過したMSE呼出しの描画前stateへ接続するadapterを追加。新規build後151呼出しのoffsetをROM規則から再構成し、388個の完全なnative frame境界で観測offsetと一致した。停止/未layerの戻りを描画回数に含めない。
- 4呼出しを既存整数描画に渡し、各60 polygons / 98304 fragmentsを処理した。これはrenderer実行確認であり、native framebuffer画素との一致確認ではない。
- 初期保存状態の保持済み61呼出しのphaseは未確定。実動画の復帰最初の可視frameは既にfade途中で、native reset/build/最初のupdateは画面から直接確定できない。動画時刻をnative frame数へ直結していない。

### Git保存と公開状態

- この時点の本番runtimeはe17f6f47。S04新経路、身体native helper、epoch adapterはcheckpoint段階で、本番動作確認済みとは扱わない。
- [背景checkpoint df1a44eb](https://github.com/DaisukeDaisuke/dq9-AT/commit/df1a44eb739a24ba7be421091c7090d04c6e5436)
- [身体matrix helper checkpoint 9154a597](https://github.com/DaisukeDaisuke/dq9-AT/commit/9154a5978395a63c392b3a4a019e895036d58160)
- [霧clock adapter checkpoint ea052076](https://github.com/DaisukeDaisuke/dq9-AT/commit/ea052076e931da8735b8bdda2afdb49a5a26ba93)
- [霧解析注釈](https://github.com/DaisukeDaisuke/dqix-functions/blob/89c15a7b03451362bca24ddca22f6366abc0337f/analysis/fog-observed-clock-20261005/epoch-render-clock-91b69fdb.md)
- 非公開headlessソースはdots-toolsのe3cdbfb8まで通常更新し、remote反映を確認。
