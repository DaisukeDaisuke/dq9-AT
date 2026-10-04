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

## 03:49 JST — AT時計入力の接続と元状態再現の障害

- ROMのhardware tick差からelapsedを作る64bit演算を入力モジュールへ接続。元の保存済みnative観測にある差17481からelapsed33382、producerのraw/scaled delta33とphase2を再現し、親の再実行も一致した。絶対tick pair・後続の割込順序は保存されておらず、将来のdispatch到達の証明ではない。
- dispatch gateのgetter幅と参照先をROMから確認。Work8原2051 snapshotの値5/0は、その瞬間の条件判定としてのみ保持する。outer loopのcached flagや次frameの値へ流用しない。元の六呼出しprefix・300clock packet・conditional continuationは変更していない。
- 最初のdispatcher入口を新しく観測する試行は、原2051の完全RAM hashが一致せず、observer有効化前で停止。追加frame0、取得dispatch0。差はRTC日付時刻出力の5byteで、元の時計入力系列が保存されていない。ARM7のRTC読出し経路・ARM9の変換処理・既存coreのhost時刻入力まで確認した。原RAMへの書込みや5byte除外、代替state、hash条件の緩和は行っていない。
- 別に、新captureの複数frame一括stepは最終frameしか描画せず、原Work8の毎frame描画と違っていた。毎frame描画へ戻す最小修正案を保存。修正後のnative実行は未検証であり、時計不一致の解決とは扱わない。旧失敗source・画像差・raw結果は保持。
- 原snapshotの実SPと関数prologueから一段だけsaved r8=0と戻り先を復元し、LR−4の実BL先までROM/RAM双方で照合。直前callerはdecode処理であり、NPC outer cached flagとの同一性は未証明。親の再実行結果も一致。追加unwindは行っていない。
- 著作source・再開手順は非公開tools 81d7009b2d637cf257f0e238de320b449ad96580まで通常pushし、本文/headを確認済み。ROM/RAM/画像/raw命令出力はGitへ追加していない。
- 未解決依存だけを保留し、既存追跡/replayへ時計とgateの明示入力を接続する作業を続ける。unknownからAT下限を加算せず、現在AT特定・自動継続・全入力対応は未達。

## 04:19 JST — 新しい開始状態の実dispatchを既存replayへ接続

- 旧Work8のRTC不一致・旧原点hashを保持したまま、同じ正式ROM/SAV/routeを毎frame描画する別の新規epochを取得。RTC注入や旧RAMの修正は行っていない。
- 原点後だけ有効にした最初の2site捕捉で、実frame2052のdispatcher入口とLR0218dafc・上書き前r8=0を直接記録。次の3site版では、同入口に続く13controller callの順序、callerLR、owner、実r2/r3=50/3を確認。追加は2frame、既存frame境界2053で停止、drop0。両版とも対照/観測の開始・終了時の全RAM・両CPU状態・画素が一致。親も保存済みraw bytes・hash・event関係を独立照合した。これは同区間の介入比較で、全入力の非干渉証明ではない。
- 毎frame描画後の原点画素は旧2051と一致した。新原点RAMはRTC値が異なるため旧原点を置換しない。RTC callbackはこの短区間で0eventであり、記録した受信buffer値をhost時計の全入力系列とは扱わない。
- 新原点RAMから既存の固定抽出器を再利用し、ROMからmanagerを読み、通常NPC12体を再抽出。旧Work8の動的origin/controllers/epochは流用しない。同じROM由来の静的resourcesだけを再利用した。実13call中のslot4/kind2は通常モデル外として保持する。
- 実frame2052のclock50/3を新しい明示入力へ束縛して既存replayを呼出。予測を保存してから停止RAMを読み、対応する12体×13fieldが一致。親の新版再実行も予測・比較・結果JSONの全体一致を確認した。これは1回の実dispatchにおける通常NPC部分の再現であり、将来の呼出し予定や全マップの対応ではない。
- 予測draw0、開始/停止seed一致だが、AT呼出しsiteを観測していないため実消費0とは証明しない。AT下限追加0、kind2・他consumer・producerからstoreまでの時序は未解決。
- 旧Work8の300clockについては、別adapterで実controller引数を照合してもdirect gateがないためreplay未呼出を維持。旧conditional6drawは別結果として保持。hardware producerの「過去の最後」を時序証明なく流用する案は撤去し、別epoch入力も拒否する。
- 新source/再実行手順は非公開tools c78590cce6f93ca87fa4e24be53ca7db123c1963まで通常push、10file本文/head確認済み。新原点/停止RAM・raw観測・予測は私的Library checkpointへ保存し、旧RTC失敗archiveを完全保持した。Gitにゲーム資産や生RAMは入れていない。
- 次は通常モデルが除外したkind2の実分岐を確認し、AT消費を含み得る未対応箇所の接続を進める。単なるframe延長や一致件数追加には進まない。

## 04:49 JST — hardware時計からreplayまでの実時序を接続

- kind2/mode0の局所storeだけを条件付き予測する小実装を保存。原点のfallback actorからelapsed278→328、threshold2085等6fieldは一致したが、animation callbackを未実装として明示し、全kind2再現とは扱わない。親の保存済み入力での再実行も一致。
- 未接続依存を追うと、実callback02034bd4はregistryのratioQ12をsigned16にして使う。この値は以前の4word観測に無かった。現在の局所mode0は方向/threshold抽選をskipするが、callbackや他callee全体のAT消費なしは未証明。
- 既存observerの8site/4word内で別の新epochを記録。原ROM overlay17をtable/FATから直接展開し、全siteの命令を原点/停止4RAMと全eventへ照合。実行版はhash固定の保存ROM spanを使用し、原ROM直接展開による同一性を後から確認した。direct-readerへ変更した次版harnessは追加native未実行として分離してある。
- 21event/drop0から一組のproducerを実順序で閉じた。tick差43745/0→elapsed83537/0→cap50000、消費pending5→phase3、scale4096、raw/scaled50、ratio12047を源計算で再現。producerはcompletedFrame2051、dispatch/controllerは2052であり、同frameだと仮定していない。kind2の実callに続くcallbackのsigned r5=12047まで接続。別actorのcallbackは未接続のまま保存。
- 新originRAMから再抽出し、hardware演算が生成した50/3を実controller引数と照合して既存NPC replayへ供給。停止RAMを予測入力へ渡さず、予測保存後に対応fieldを比較した。通常NPC12体の156fieldが一致し、親の予測/比較/結果JSONも完全一致。これは前節とは入力経路の接続が進んだ結果で、対象数の増加ではない。
- 原点/停止の対照・観測RAM/両CPU/画素は一致。最大2追加frame、停止2053を維持。AT siteは未観測、kind2全体と別actor、未来の呼出し予定は未対応で、AT下限追加0のまま。
- Source/再開手順は非公開tools dfe0e1bcffaa1bb9d854426b67330f5a58a9046bまで通常push、12file本文/head確認済み。私的checkpointを更新し、旧archiveを完全保持。既存入力・失敗・旧epochは置換していない。
- AT側はこの限定接続を安定checkpointとし、次の実作業を敵身体の見逃し/誤枠へ戻す。現V2は既にquery patch対ROM前景12tokenであり、旧Work7のpatch対CLSと混同しない。既知の負結果を再利用し、実装済み手法の再包装や評価閾値合わせはしない。

## 05:02 JST — query側の前景支持を揃え、既知背景1枠を抑制

- 現V2はquery patch対ROM前景12token。fineEvidenceのquery側では、自動alphaで消した背景tokenもpart支持へ数え得た。既存ROM側と同じ9点・alpha128以上・6割の判定をqueryにも適用する別variantを追加した。類似度/mean/参照選択/minParts/順位/geometry/bankは変更しない。
- 固定33frameの元10候補中fine4件を同条件比較。背景1070は11支持→6支持となり左右支持条件で棄却。落ちた5token中4つは完全透明だった。真の1100/1195は2tokenずつ減っても保持、味方1215は8/8前景で誤枠が残る。6coarseと23候補なしframeは不変。既存事後採点でTP8/FP2/FN7→TP8/FP1/FN7。親も再生成/事後採点し、出力先以外の数値・画素hash・tensor結果一致を確認。
- 明示的な動画CLIへ接続し、正式動画1069.6–1070.4秒を手作り候補JSONなしで実行。5観測で元2枠→1枠。固定33と同一RGBAの1070背景枠を棄却したが、上端のenemy_unknownは元から未検出で残る。1070.4のcoarse候補は保持され、core z021a/fine z064aの不一致も残る。このframeの正式種別ラベルは未確認。親の実動画別実行も、出力先だけを正規化するとRESULT全体一致。
- 1205短区間の元4候補、1205.4欠落と元core分類を保持。未知拒否・種別確定・全身保証ではない。新方式は明示variantで、公開UI/default/AT確定条件は変えていない。
- source5fileは非公開tools e6752f07ea6ca82f9f072cd29c1f9b575776799dへ通常push、本文/head確認。ROOT私的checkpointを同一Library項目の新版へ保存し、旧payloadを全保持した。新追加分の再生成可能なfine grid/cacheは省略し、入力画像・crop・JSON・hash・再実行sourceを保存。
- 次の未決は、固定HUD矩形が現映像の上端の敵をdescriptor前に消す点と、人物頭部だけで全身の縦支持に見える1215。既知敵へ矩形を合わせず、既存HUD除外OFFを全固定入力へ同条件適用して、見逃しとUI誤検知の両方を比較する。

## 05:44 JST — HUD解除・参照拡大の負結果を保存

- 既存HUD除外OFFを全固定33へ一律適用するとTP8/FP2/FN7→TP7/FP1/FN8となり、不採用。1070上端は成分生成まで届くがfine横支持1で落ちる。160は文字と身体のcoreが結合し、同じcoarse経路の縦支持が3→2となる。元高さ35もfine上限32を超えており、「高さ増加でfine対象から外れた」という初期説明は誤りとして訂正・保存した。
- ROM fontは既存sourceで実抽出できるが、既存自動ROIはマップ名枠専用でcommand UIを局在化できなかった。未校正OCRや文字幅の列全消去で身体を消す処理は追加していない。
- 既存の全整数位相PNGから、同じforeground samplerで位置検出用bankを生成。686入力中685参照を生成し、empty1は既存unsupportedのまま。682参照は12part、薄い3参照は既存規則の8/6/9partで、複製補完しない。旧64、新bounds control64、全685を分け、数値gate・HUD既定・全固定入力を維持した。
- 固定33結果は、旧64=TP8/FP2/FN7、control64=TP4/FP1/FN11、全685=TP9/FP22/FN6。430の追加検出はcontrol64でも起こるため、位相追加単独の効果とは数えない。全685は誤枠増加が大きく不採用。全候補と拒否理由を保存し、旧64出力の完全再現とquery cacheのhashを照合した。親の保存予測からの再採点も一致。
- 同じquery前景guardを3bankの全保存候補へ一律に適用すると、旧64=8/1/7、control64=4/0/11、全685=8/11/7。全685ではFP11件と真陽性1100の1件を除き、430を得て1100を失った。TP数8でも元8体の保持ではない。残る11FPは前景支持を満たすfine7件と対象外coarse4件で、透明tokenだけでは説明できない。これも不採用。
- 生成vector/manifestは私的phase bankへ別保存し、旧CLS/prototype payloadを保持。比較source・再開手順は非公開tools c9be2686b1c344d6c51475868018355e92e80c40まで通常pushし、本文/head反映を確認。ROOT私的checkpointも旧payloadを保持して更新した。公開UI/defaultは変えていない。
- 次は選別順序の未試行部分。元64/HUD既定でfineへ入る44自動成分のうち、実fine棄却39成分/19frameを対象に、既存公式SAMの成分中心point＋元成分box→mask付きcrop→同じfineEvidenceを追加仮説として比較する。元V2受理後だけを扱う以前のSAM入口とは異なる。全3maskを保持し、空maskはunsupported、GTで最良maskを選んで成功とはしない。元の候補・全失敗・評価閾値は保持する。

## 06:49 JST — 棄却成分からの映像入口と分類入力の分離

- 元64/HUD既定のfine棄却39成分・19frameから、既存SAMの自動成分中心＋boxで全117maskを保持した。fine位置支持を満たす7仮説のうち、既知430の身体boxに重なるのは1体の1仮説で、残る人物/UI候補も保存。3maskは同一成分の代替であり、3体とは数えない。
- masked CLSでは430の3maskはmaxが全z064a、prototypeがz000c/z064a/z064aとなり、正式モデルz021aを選ばない。既存ROMと同じ前景token poolingを追加比較しても全3maskがz064aのまま。全117件の親側再実行は出力先だけの正規化でRESULT一致し、負結果も保持した。
- 同じ430原画素の旧自動core/union診断4条件を再現し、順位・scoreが完全一致。native256側の同じgeometryでも全4条件がz021aだった。同じSAM bboxとRGBのままalpha255へ戻すとz021a、SAM alphaではz064aを再現し、この例では透明化が順位を変えることを実測した。消した画素が身体か背景かの一般判定は未解決。
- 全117maskに、位置支持用maskを保持しつつ種別判定だけ元RGB不透明cropを渡す明示variantを追加。430の3代替はmax/prototypeともz021aになったが、1070のUIも一部z021a、人物断片の誤候補も残る。親の別実行111 fresh encode＋6同一入力cacheでも全RESULT一致。初版40件後の診断側cache扱い失敗と最小修正を保存した。
- 動画ファイル・既存layout・時間指定だけの入口へ接続。正式1ninnの429.596–430.396秒から49frameをdecodeし5観測。元V2の1候補・分類・追跡を保持し、fine棄却3成分の9maskを別仮説として記録。実PTS429.996は旧430とRGBA一致し、3maskの画素、支持、masked/opaque全順位も一致。9maskのopaque順位は全z021aだが正式種別比較は中心1体だけ。近隣frameへラベルを流用しない。
- 429.596では見える身体が自動成分生成へ届かず未回復。429.796は部分的な小boxで、全身保証も未知拒否も未成立。default・公開UI・出生/AT確定条件は変更していない。旧「34 crop」は複数variantで繰り返された自動観測34件であり、独立34体や手動GT cropではない。
- sourceと再実行手順は非公開tools 27165f0e2dc794d9f328cfcdede8cf20fd4f2680まで通常pushし、各本文とremote headを確認。私的再開checkpointは既存Library項目のversion8へ保存し、全旧payload保持・追加687fileのhash/ZIP CRCを照合した。再生成可能なtensor cacheは一部省略、SAM本体は別の固定依存。中断復帰や全入力対応の保証ではない。
- 環境と既存必要ファイルは保持され、消失は未確認。予測された注意時間帯を確定した消失予定とは扱わず、成分生成前の見逃し原因の調査を続ける。
