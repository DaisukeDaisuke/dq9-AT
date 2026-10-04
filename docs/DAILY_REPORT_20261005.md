# DQ9 AT / 映像認識 日報 2026-10-05

## 00:25 JST — 足先回収、支持mask比較、AT入力の証拠保持

目的は映像からのモンスター種別特定とAT総当たり。既存default、固定入力・評価・失敗を維持。

### 実装・実測
- 既存video wrapperの旧max/prototype追加順位とLK補助を観測adapterへ接続。元sighting ID・aliases・不確実な不在・unknown・world関連付け結果は不変。補助を独立出生/AT drawに変換しない。
- 親は1204.6–1205.4秒の実動画再実行出力をadapterと条件付きAT compilerへ渡した。元4 sighting、7追加prototype比較、3LK記録を保持。1205.2秒のz021a/z064a両仮説と無制約unknown枝が残る。種別候補から過去の単一抽選条件を解析的に比較したのみで、実seed/出生/有限draw間隔は未取得。現在ATは全uint32が排除できず、実測済み総当たり特定とは扱わない。
- 1205.4秒のLK core(21,65,36,36)から既存同参照coarse/fine支持を再利用すると、支持由来の箱(15,62,50,49)が得られ、見えていた足先を含む。ただし背景と味方断片も増え、prototype順位がz021aからz064aへ悪化。完全身体maskや採用済み改善ではない。
- 同じcrop/RGBを固定し、既存支持maskをalphaに適用して既存gray128前処理を使用。1205.2秒は旧max/prototype両方がz021aへ、1205.4秒はprototypeだけz021aへ変化。旧max不一致は残る。
- 味方誤枠1204.6秒にも同じ処理を適用。無加工z064aからmask後z019bへ変わり、怪物の誤候補のまま。prototype類似度も0.420781→0.511402となる。敵側の局所改善だけを理由に採用しない。
- 親はLK fine3例、alpha3例、味方を含む既存fine4例を別実行し、出力path差以外のgeometry/支持/順位/tensorの一致を確認。
- 既存LK設定で全初期特徴点を記録。味方core/fineは11点中3残存、敵は34/35点中2残存。camera補正後の運動差は観測したが、mask外の背景残存点は0で、同crop内の身体/味方/背景を分離できる根拠は不足。親の点別再実行も一致。

### 保存・未完了
- Source・再開手順・失敗比較は非公開toolsへ通常pushし、remote本文/headを照合。最新a2944d9ce0b0b7074277e75495d2e3fe6909d1ef（実装checkpoint eab0866ea278568a4ff5e0150ef8b68484b395ea）。私的な詳細結果はLibraryチェックポイントも更新し、旧payloadを保持した。ROM/SAV/RAM/動画/抽出画像/vectorはGitへ追加していない。
- 元64参照のalpha silhouette/part特徴の同一性を確認し、3点以上の頑健な相似変換で身体候補を作れるか調査中。旧2点外挿には保存済み負結果があるため再採用しない。全位相685参照にはpart特徴が未保存で、そのまま流用しない。
- 未解決：身体mask、味方/背景の拒否、任意種への一般化、動画と出生/AT draw列の対応。公開ページの更新は行っていない。

## 01:10 JST — N1自動mask復元と種別表現の訂正

### 訂正
前節で1205.4秒の順位変化を「悪化」と呼んだ表現は強すぎた。正式保存注釈で確認できるz021aは1205.0秒の別RGBA hashであり、確認した13資料には1205.4秒のexact hash注釈がない。1205.4秒は近隣映像・目視に基づく暫定解釈で、確定GTに対する誤判定には数えない。旧maxの最高z064a0.612948とz021a0.606925の差は0.006022。全位相最高もz064a0.601072/z021a0.578158。参照姿勢・色・描画解像度の差は観察したが、原因確定はしていない。

### 実装・実測
- 元64参照のalpha/12partを同一性照合した相似変換案も、味方に怪物silhouetteが成立し、敵の身体部位を落とす候補がある。親の再実行は全数値と86画像bytes一致。未採用。
- 保存済みWork1/N1のSlimSAM自動mask実装を正式Libraryから復元。旧D2の正受理1/2・誤受理1・上位2coverage0/2という負結果は保持。新方式の成功とは扱わない。固定revisionのONNX/processor設定はsize/SHA照合し、Python依存は私的venvへ用意した。
- 1204.6/1205.4秒の原画素から、元automatic_poolの576mask/画面、元凍結predIoU0.8/stability0.9で各18maskを得た。親は1152mask配列と元選別を独立再実行し一致。約20秒/画面で、実時間処理ではない。
- 1204.6秒の身体形状候補mask297は元順位7、1205.4秒のmask198は元順位14でtop8外。UI・味方・背景が先に並ぶ。元HUD除外矩形は今回のUIを覆わないが、設定は変更せず失敗として保持。
- 全36maskを元bbox/alphaのまま固定WASM旧max＋prototypeへ接続。親が全順位・tensorの一致を確認。元N1 classifier/acceptanceの再現とは別。全候補に4モデル順位が返るが、unknownは排除できない。
- 各maskの全8連結成分を保存し、現在の自動core/LK boxと実画素で一意に重なる成分のみを追加cropへ接続。36mask中6が一意対応、30は重なりなし。最大成分・GT・面積閾値では選ばない。mask198本体13143pxと上方60/18pxを分けたが、両分類のtop1はz064aのまま。味方誤枠も同条件で保持。親が独立生成mask/LKから再実行し6crop/全順位/tensor一致。異なる実行の時刻・由来hashは保持した。

### 保存と次の接続
- 非公開tools最新79c4cde7cfbe6c93605b2ad02187208225ecff38まで通常push、remote本文/head確認済み。固定モデルは別の私的Libraryへhash検証済みバックアップを作成。既存ROOT/phase bankとは別で、元ROMや映像は含めない。
- 明示的な動画入口から、N1候補・一意成分・分類を連続実行する経路を実装中。元V2/LK/default、元576/18/top8/top2順位、失敗を維持する。身体完成・未知拒否・任意種対応・AT特定は未達。

## 02:05 JST — 動画入口の完走と固定33条件での不採用

- N1動画入口は1204.6–1205.4秒の5観測で完走。2880 raw mask、84品質選別mask、17一意成分cropを保存。親も動画から別実行し、全mask配列・元84/成分17の画素・順位・tensorの一致を確認。独立実行の時刻・path・由来hashは保持した。1205.0秒のカメラ不確実と1205.4秒の元V2未検出は残っている。
- 別案として、自動core中心のみをSlimSAM positive pointへ渡した。5frame12coreから36raw mask、元品質規則後7mask。5frameの時間は4.75/6.36/3.42/3.07/2.65秒で、固定gridとはprompt数が違う限定比較。親の全36mask・品質選別一致を確認。
- raw36に既存の一意連結成分処理を適用すると27crop、9maskは複数成分対応で保留。正式注釈のある1205.0秒で脚付きmaskのbox IoUは0.7239→0.8764。ただし旧maxはz064a、prototypeはz021aの不一致を維持し、stability0.896825は元0.9を下回るため品質棄却のまま。親も27cropのgeometry/画素/tensor/順位一致を確認。身体pixel真値の評価ではない。
- 局所例だけで採用せず、既存固定33frame・15敵の元V2候補10件だけから同じ処理を実行。残23frameは0promptを維持し、coherent/alpha/別coverage variantを混ぜていない。ラベルは事後評価だけに使用。
  - 元V2：10箱、TP8、未対応2、FN7。幾何一致8件の旧max/prototype種別一致8/8。
  - point品質選別：10箱、TP6、未対応4、FN9。種別一致5/6。
  - 一意成分＋品質選別：9箱、TP5、未対応4、FN10。種別一致4/5。
  - 全raw診断でもTP7で、元TP8を維持できなかった。親の再生成・64crop分類・既存評価関数による集計も一致。
- このためSlimSAM point/成分法の標準採用は見送る。閾値は調整しない。d1-v1-160正例と背景誤枠1070の両方が元HUD gateで落ちるため、これをモデル能力不足とは解釈しない。340はraw3候補ともIoU0.5未満、400は複数成分で保留、1215の味方誤枠は品質後も残る。
- Source・再現手順・失敗内訳は非公開tools ca1e32faa7df71659bf3b366feadbbdf6ef2c6a5まで通常push、remote本文/head確認済み。私的N1結果と固定モデルは別Libraryバックアップ済み。Gitに元動画/ROM/画像/mask/vectorを入れていない。
- 次は公式SAM ViT-B一候補で、raw mask段階の差を同じ自動pointで少数比較する。SlimSAM能力不足を断定せず、HUD/品質gate・実行providerの違いを分離する。現default、固定33評価、未知拒否、AT状態は変更しない。

## 03:05 JST — 追加身体maskの動画入口を保存

- 公式SAM ViT-Bの固定safetensors/configをhash照合し、インストール済みTorch/Transformersの安全な読込で実行。3固定例のpoint-only比較は問題解消を支持しなかった。340のraw最大IoU0.4092、1205.0の品質参考順位は胴体、1215の味方も残る。親の全9mask再実行一致を確認。
- 現SlimSAM ONNXへboxラベル2/3を流用する互換根拠は得られず、この未証明経路は使わない。公式ViT-Bのinput_boxes契約で、同一frame/candidateに由来する保存済み一意fine boxだけを入力した。GTや手動余白は使わない。
- 固定33の元10core中、fine boxは6件で利用可能。340/1100は複数fine成分、1070/1215はenvelopeなし、残23frameは元core0で保持。追加maskを新しい敵検出件数に数えず、元coreごとの身体範囲仮説として比較。
- box追加18maskでは元core比IoU14改善/4悪化、coverage9改善/9悪化。旧品質規則による参考順位の5maskではIoU4改善/1悪化、coverage2改善/3悪化、旧max/prototype種別一致とも4/5（元core5/5）。種類分類の置換は採用しない。160の旧HUD棄却や元誤枠も残る。親の全6case/36mask再実行一致。
- 実装は固定評価専用で終えず、observe-video-sam-body-hypotheses.mjs の明示的な動画入口へ接続。動画/範囲/既存bank/runtimeから、元V2/LK→同frame一意fine→公式SAM point＋box→全mask分類を連続実行する。元candidate ID/core bbox/元分類/unknown/AT0はそのまま、身体maskは追加仮説に限定。候補JSONや評価frame名は入口に不要。
- 正式動画1204.6–1205.4秒の5観測で元V2 4core＋実LK 3coreを保持。一意fine6coreから18mask/18分類、1204.6の1coreは未対応。1frameごとにembeddingを共有し、使用frame4回、model load1回。親も新規出力先で動画から実行し、元観測不変・全18mask/全順位/tensor一致を確認。
- 1205.4秒はmaskごとに種類順位が分かれ、味方や小断片を含むmaskもある。元V2未検出、種別未確定、品質順位の未較正を維持し、品質1位を正解扱いしない。未知拒否・全身保証・現在AT特定は未達。
- statusだけで既存phaseを再利用する試作resumeは撤去。旧source/結果を保持し、新版は新規出力先への再実行のみをサポート。安全な一般resumeとは宣言しない。
- Source/再開手順は非公開tools 768511a4eb6dd761d4ec3a8e78ecb715746891f2まで通常push、remote本文/head反映確認済み。公開UI/defaultは変更していない。
- 次の実作業はAT側へ移る。既存10/3のclock producer/割込callback/dispatch資料を再利用し、未接続のhardware tick差→elapsed変換をROM命令幅で純粋入力契約へつなぐ。既に保存済みの観測一致を再計数せず、割込時序・outer loop到達unknownは保持する。
