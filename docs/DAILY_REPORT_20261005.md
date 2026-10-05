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


## 07:10 JST — 確認された環境消失からの復旧

- 07:02:53に直前の作業ディレクトリ群の欠落を確認し、07:03:19に親も同じcwdで使用容量が約20GBから123MBへ変わったことと合わせて確認。会話再開だけを根拠にせず、実消失として承認済み復旧を開始した。予測時間帯は確定情報として扱っていない。
- 正式復元索引version8の原本68,621bytesと指定SHAを照合し全文確認。ROM元8partと必須動画18partをLibraryから再取得し、各part・結合gzip/tar・展開ROM/5動画のsize/SHA、gzip CRCをすべて確認した。旧動画cacheや別ROMへの代替なし。
- 固定公開/非公開sourceは全359/276payloadのsize/SHA/Git blobを照合。original runtime7資産を復元し、実ROMとmetal.savを使う既存読込smoke2件がpass。既存Node24.19/Python3.12.14/Java21.0.12.1とcompiler moduleを実確認し、追加Oracle JDK取得は不要だった。
- Ghidra12partとpatched NTRのsize/SHA・ZIP CRCを照合して私的配置。既存Javaを使う人工16byte ARM raw import/saveが成功。これは実ROM再importや旧解析DB復元の成功を意味しない。
- 直前ROOT CPU checkpoint v8とAT/RTC checkpoint v2の原本SHAが一致。CPUの全manifest entryとATの旧archive連鎖も照合。N1/phase bank等も正式Library保存版を取得・照合。ROOT専用控えは子へ配布していない。
- 消失直前のLK比較source/手順は非公開tools8f3699912e1fdcc6ab8673ac7891e20cb487700fへ保存済み。430.196元core31点からの逆追跡は429.912で全点を失い、429.596/.796を回復できない。後続の隣接frame残差は全208成分・人物/壁等混在の負結果を表示確認したが、raw結果の保存前に消失。報告値だけの再記録と原本復元を混同しない。
- 基盤読込は復旧したが、最新の映像観測adapter/AT compiler/searchの配置と実入力接続は復元作業中。過去の実測を今回の再実行成功へ読み替えず、復元したsourceと正式入力から続ける。


## 07:36 JST — 映像観測から条件付き有限探索への接続

- 正式Work7の元64参照PNGから同一Node/WASM providerでCLS/前景part bankを再生成。親側で旧保存bankと全descriptor/geometryを比較し、timings以外の64件が一致。新JSONのSHAは旧版へ偽装せず別に保持。
- 正式メタル1動画1204.6–1205.4秒から元V2で49frame/5観測/4候補を再生成。既存adapterのrawPTS/ROI/hash/全順位/暫定trackを保った観測bundleに、明示したtable・event順・有限gap・domainを渡す新入口を追加。初期seedやAT消費を映像秒数から推定しない。
- 実演は同じ暫定trackの最初2sightingを別weighted drawだったとする未証明仮定、D04M02→table30の条件付き供給、gap1..256、low31域0..65535。全順位aliases枝は65536件全部残り、未較正top-model枝は0件。これは入口の動作確認であり、動画AT特定の進捗件数ではない。このprefixの終端output15は0で、top枝0を全域の矛盾と呼ばない。最大16例は全候補exportではない。
- budget4096での別実行は先頭枝0..4095のみack、残4096..65535とtop枝全域を未探索として保持。開始前INPUTSと各ackの原子的保存を追加し、親の別実行は完了/途中停止ともRESULT全体一致、保存ACKと最終ackも一致。環境消失を越える自動resumeの保証ではない。
- unknown/既存entity/誤認枝が全uint32を保持し、動画現在state回復false・証明AT加算0。既知origin付きAPIのschemaは照合したが、この動画でorigin付き探索は未実測。
- 別途、復元した元native二抽選captureを元hashで探索再実行し、有限1..65536内のindex2/state551396688と既存reader読込が一致。これは保存native出力の再探索で、動画のseed根拠にはしない。最初に選んだ別selection captureの実行も保持し、元captureへ黙って置換しない。
- 新source6件は非公開tools5ba67e4b6616be83d5071e0af3060c626e1f34b0へ通常push、本文/head照合。実入力/結果は旧payloadを保持した私的checkpointへ保存。次は実際に異なる候補とscene/tableを結ぶ材料の確認。1220秒の既存4枠は再抽出画像では命令/ステータスUIであり、敵4体として使えない。


## 07:48 JST — 同frameの地図名候補をROM抽選表へ接続

- 正式動画1205.000秒のfull sourceから既存pixel DS-screen detector→map-name panel detector→ROM glyph CPU matcher→既存名前exact joinを接続。手入力の地図名/ROIなしで「ふういんのほこら１Ｆ」候補が出た。名前CSVのhashを記録し、ROM maplist/encfldから同名7401/D04M01、7402/D04M02をともに保持。全area-byte256通りとtime predicateゼロ/非ゼロを列挙し、現在のarea/flagは選んでいない。
- 7401にはencfld groupがなくunsupported/unknownとして残す。7402のtable30は条件付き候補。OCRは既存UI auto-threshold/scale/文字数設定と最大10秒・200万評価で停止しtextResolved=false。正解名を注入せず、未探索・誤読候補も残す。full画像のlibvips linear縮小とBrowser Canvasの同値は未検証。
- full sourceのbody cropと元観測のRGBA/PTS/timebaseが完全一致した1205の1sightingだけへ補助証拠を添付し、隣接4frameへ伝播しない。1205証拠を1160へ渡す入力は拒否、原bundleを保持する。
- 手指定D04M02を不要にした新経路は単一eventの解析的交差でinspected0。all-rankは全2147483648 low31、top-model仮定は671088640を保持。総当たり実行ではなく、unknown/no-table/OCR未探索/既存entity枝が全uint32を残す。現在AT復元false、証明加算0。別draw順/gapの仮定も追加していない。親の元動画からの5段階別実行でsearch/例/bindings/unknown結果が一致。
- 1160はexact名前join0を保持。既存画面矩形は1160で319×239、1205で320×240（解析画像座標）。元RGBへ両geometryを交差適用する診断では、名前領域のgeometry差MAE約20に対し同geometryの動画差約3.4。画面境界差が候補原因だが、他frameの矩形を採用して成功とはしていない。次は既存detectorの近接候補を抑制前に保持する明示variantで、geometry不確実性を残して比較する。
- source10fileは非公開tools d9deff66cbe60d3b42e49682def2a705e16e0f16へ通常push、本文/head確認。同frame証拠と失敗結果は旧payload保持の私的checkpointへ保存。既知名向けの閾値調整、公開UI/default変更、map固定1:1はしていない。


## 08:02 JST — 画面枠の代替保持と別sceneの参照供給

- 既存screen detectorのIoU抑制前候補を、元score順・max8 geometryの明示variantで保持。元detector返却結果は完全不変。既知幅/名前への丸めや正解枝選択はしない。各OCRは同じ既存上限を使い、総予算増加を記録。
- 1160は7geometry中OCR3、約599万評価/15秒。元319×239枝は誤読のまま、元から存在した次2geometryが7401/7402候補へ届く。名前panel失敗2/役割不明2を保持。1205は27中8枠、OCR3/約599万評価、失敗5/未処理19を保持。親の両frame再実行はelapsed以外RESULT全一致。
- geometry別証拠を同frame sightingへ接続。各2geometry×2species政策は独立した代替仮説で、4体/4draw連鎖ではない。原観測・no-table7401・未探索・unknownを保持。解析的単一event交差inspected0、全uint32/証明AT0のまま。親の両search RESULTは全体一致。
- 元Work7固定ラスダン270.000/zuo229.996を、正式動画から元RGBA/PTSに一致して再抽出。同じ処理でラスダンの名前候補から11map IDとtable193/199/200/202/204/207/208/209/210、zuoから7904/D09M04/table88候補を供給。ラスダンの選択文字列は9Fだが同名・文字代替の別階も残し、no-table4403/4414を除外しない。全OCR不完全で現在map未確定。
- この2frameの元4model動画検出は候補0で、補助mapがあってもsightingを生成せず探索ready=false/AT0。条件付きtable全union→既存enc/CSV catalogからラスダン14、zuo4、重複なし18modelを列挙し、全て元4model bank外と確認。z030bのenc側175と同model alias276も保持。これは候補表の範囲であり実際の可視敵種別を確定しない。親のplan再実行も全体一致。
- sourceは非公開tools741ab8bd1e8a69b55fe1e484cc993b4e722cf58aまで通常pushし本文/head確認、私的結果も旧payload保持で保存。次は18modelの実在_f資産と既存CPU decoderで扱えるposeだけをmanifest化する。stand/run欠落や未対応曲線を別variant/複製poseで埋めず、元4model評価は保持する。


## 08:28 JST — 条件付き18モデル参照の作成と残る見逃し

- 正式Work7同梱geometry kernelと対応JS/Cを照合し、ROM内18モデルの明示_f資産とbind poseを確認。quick4poseが揃うのはラスダン14中6、zuo4中0。rate0以外の曲線、matrix数不一致、exact clip欠落を保持し、regular代用やpose複製はしない。親の両asset probe再実行もRESULT全一致。
- 実decodeできた50pose×元4yaw viewを既存CPU unlit rendererで描き、200枚全て非空。同じ既存foreground samplerが全200参照を生成した。欠落22pose（ラスダン16/zuo6）はmanifestへ保持。boundsは利用可能poseのunionであり、model追加だけの効果とpose/bounds変更を分離していない。
- 既存manifest-local-bankの参照数/model集合bindingだけを可変manifestへ結び、元4/64は変更しない。旧64/4model、ラスダン新160/14とunion224/18、zuo新40/4とunion104/8を比較。二つの正式frameは事後注釈・原画素では味方のみの負例で、全条件0候補。旧predictions全文一致、親の両比較RESULT全一致。敵recall/種別改善はこの比較では未測定。
- 全画像/特徴/checkpointは私的phase bank同一Library項目のv3へ追加し、旧phase payloadを全保持してhash/CRC照合。sourceは非公開tools7ef5e9f14264fbc1db33acd147044382969a8784、保存receipt3779c9b40b859b5a665678695b9a7e5f97cc3bd7まで本文/head確認。ROOT再開控えにも別bank依存と負例結果を保存。
- 次の陽性は元正式注釈でzuo130秒（実129.996）のenemy_non_target2体を実行前に選定。species/modelラベルは不明、GT bboxは提案へ渡さない。当該frame自身のmap候補と同model集合を確認し、既存40参照を再生成なしで使用。旧4/追加4/union8はいずれも候補0で見逃し継続。身体の一方は色成分段階で部分的、他方は背景を含む大きい成分で、seed/fine支持不足を段階別に調査中。閾値合わせで成功にしない。


## 09:01 JST — 陽性zuo130の全成分マスクと種別判定の負結果

- 正式zuo129.996の敵2体はspecies/model不明・GT近似bboxのみでsilhouette maskは無い。GTは予測後の対応説明に使用し、提案/点/box/閾値/参照選択へ渡さない。対象成分の通常seed peakは追加bankで最大.39168/.40438、既存.50以上の画素0。fineSeed .37後もfine支持不足で棄却され、旧4/追加4/union8の2missを保持。
- 元8appearance成分すべての中心point＋元core boxを同じMeta SAM ViT-Bへ渡し、1embedding/全24raw maskを保存。成分2の敵1側はbboxIoU .587/.575/.490の部分領域、成分0は敵2を含む背景域で.101/.149/.263。元quality参考選別5枚にも階段/味方/床が残る。GT boxの面積被覆を真のsilhouette保持率とは呼ばない。親再実行はtiming以外RESULT一致、全packed mask配列も完全一致。
- 成分0の点は敵box外でも実appearance mask=1、blocked0。『色前景外の点だから移動する』条件は不成立で、点変更はしていない。全8確認では0..6が色前景内、7だけ外。既知敵位置へ点を寄せない。
- 保存40参照画像から同一Node/WASMのCLSを別取得し、foreground vectorは代用しない。全24maskの同bbox/元RGBを不透明分類入力として各1回処理。旧64参照/追加40参照/union8モデルの全順位を保持。追加4model top1は22/24がz024bで、身体部分・背景・味方にも同じ順位を返し、unknown拒否や種別正解は未成立。親再実行は参照40ベクトル一致、24queryは出力先以外RESULT一致、同frame context束縛も一致。
- 同frame129.996のmap候補からmodel/variant/alias集合を照合し、230で生成した静的参照を再利用した。230のmapを時間伝播したわけではない。元6未対応pose・bounds/照明差・認識誤差を保持し、出生/draw/ATには接続しない。
- source/依存復元記録と訂正文を非公開tools df10d17922a38ec4aa38c35fe52360b16a01f66dまで通常pushし、本文/head確認。私的入力/全mask/CLS/失敗を旧payload保持で保存。次は既存Work1 automatic gridを同Metaモデルへ適用する別baselineで、色成分を入口条件にしない候補生成を確認する。以前のSlimSAM grid失敗とMeta core点/box比較を保持し、新モデルやGT点は追加しない。


## 09:40 JST — 全画面候補の順序改善と実動画入口、バックアップ反映

- 同Meta SAMに元Work1の全画面16×12 gridを無変更で適用し、192点/576raw mask、元quality/NMSの29候補を保存。色成分で背景と結合していた上端の敵2に、bboxIoU.867607/近似GT箱coverage.903499のmask37が生成されたが、quality順位15位で元top8外だった。敵1はmask64の部分箱のまま。親の別実行はtiming以外RESULT一致、576 packed mask配列も完全一致。
- quality29全部をtop8より前に既存fine支持とopaque CLSへ接続。old64/conditional40/union104の適用数15/12/17、coherentは旧/unionが小UI371と敵2側37、conditionalが37のみ。全ineligible/大きいmaskと全順位を保持。CLSは26/29が同モデルでunknown拒否は未解決。親の別実行は出力先以外RESULT全一致。
- 元coherent判定で安定分割し、coherentを元quality順、その後全残候補を元順で並べる明示variant。3bankすべてのtop8に37が入り、元部分箱64も残った。元top8の近似敵box対応1体→2体だが、種別正解・完全silhouetteではない。新top2にもUI/味方が残る。GTで37を選択せず、新NMS/閾値/既定動作は変更していない。
- 正式zuo動画129.596–130.396秒の5実観測へ、video/time/layoutと検証済みcacheだけの入口を接続。各frame自身のfullsource→screen/name geometry→ROM候補→model/variant/alias照合で参照を再束縛し、前frameのmapを伝播しない。元V2は全5frameで0候補のまま保持。Meta model/processorは各1実ロード、5embedding/2880raw mask、quality148全件のfine/opaque/priorityまで344.19秒で完走。リアルタイムではない。
- 中心129.996は固定単frameのRGBA/画像tensor/576mask/29fine/CLSvector/全順位/3banktop8とtop2がexact一致。条件付きcoherentは5frameで0/0/1/0/0となり、近隣で支持が安定しない。旧/unionは小UIを通し、body/species/unknown/出生/ATの未解決を維持。全20レビュー画像と941私的fileのhashを保存。
- GitHubプラグインの再許可後、保留分と動画入口を非公開tools main95e2fc1d840d3610aa9b9065d0590885ecb38970へ通常反映。main refとファイル本文を照合した。先に作成した未所属commitへのリンクはmain反映完了前だったため訂正し、現在はmainが同commitを指す。ROM/SAV/RAM/動画/抽出資産はGitへ入れていない。
- 私的作業控えは旧全payloadを保持し、動画入口の947追加payloadまでhash/ZIP CRC検証して既存Library項目のversion15へ保存済み。復旧索引の正式原本/モデル依存と併用する控えであり、全実行環境が単一ZIPに入るという意味ではない。

## 09:55 JST — 公開ソースをmainへ統合

- 作業ブランチ25279ae95c3298be12c713d78c460fd8bcbdf4e4のROM-only previewソースをmainへ統合。main側の既存日報を保持し、旧公開待ちの説明とライセンス参照名を更新。
- 56 JavaScriptファイル構文、46module/108相対importリンク、既存CSV/WASM依存とMapRenderer初期化を確認。機能コードの追加変更なし。ブラウザ操作・全map対応は未検証。
- 既存Pages workflowによるbuild/deployと公開配信内容の照合は、この記録の作成時点では確認待ち。

### 09:59 JST 公開結果
- main統合commit b4a2e4320ce4e05ef04add14efba824f22a26b05のPages run37249432473はbuild/deployともsuccess。
- 公開map-browser-previewのindex.html、preview.mjs、automatic-scene.mjsをHTTP取得し、統合元ソースとbyte単位一致を確認。preview.mjs初回timeoutは再取得で解消。
- 配信反映を確認した範囲は上記3ファイル。ブラウザ上のROM読込・クリック・描画操作と全入力対応は未検証のまま。

## 10:26 JST — 近隣見逃しの段階差とHUD除外の比較

- 同5frameで前半の身体候補はquality後まで残るがfineの縦/横支持不足、後半は固定command-HUD矩形とのbbox交差が先に棄却することを分離。全148旧候補で参照のcoherent優先を試しても結果は不変。近隣の身体対応は事後目視であり、中心frameの正式近似bbox注釈を転用しない。
- SAM生成後の固定HUD bbox gateだけOFFにした明示variantは、同2880rawから148→166quality候補（旧候補消失0）。既存148の入力/vectorを照合再利用し、追加18 opaque/7 masked/20 tileを実推論。条件付きcoherentは0/0/1/0/0→0/0/1/0/1。後半1frameの身体候補が戻る一方、前半top8に大背景が増え、既存UI誤受理も残るためdefault不採用。以前のappearance HUD OFFとは適用段階が異なる。
- 親の独立再選別22JSONは出力pathのみ正規化して一致。追加推論の全5frame rows/summary/順位も一致（結果hashは出力pathに依存）。
- 全166候補で画面固定と既存camera補正の同一画素域のRGB差を比較。初回30/共通域なし2を保持し134件実測。UIは画面固定支持が強いが背景/主人公にも成立し、単独のUI除外根拠には不足。親のRESULT再実行は完全一致。
- bbox交差があっても実maskのHUD交差ゼロなら残す別診断では、全2880中120件該当・47件のHUD理由を解除できるが、23は元IoU quality、24はstabilityで落ち、候補/順位は不変。後半身体は実交差があり回復しない。既存仕様のバグとは断定しない。
- sourceと再開手順は非公開toolsへ通常push。HUD比較と旧全payloadはLibrary同項目v16へ保存し、700追加fileのhash/ZIP CRCを確認。画面固定支持等その後の結果は作業領域にも保持。次は参照の未対応poseを実ROM/decoderで確認する。身体完全性・種別/未知拒否・出生/ATは未解決。

## 11:25 JST — Canvas2D背景と実動画比較をブラウザへ接続

- 主軸をNDS由来マップ背景描画と実動画の比較によるモンスター位置特定、AT総当たりへの接続に置く。既存の画面・地図名自動取得→ROM map/table接続はこの入口として活用する。過去Library資料の未決を現行バグと断定せず、現在source/実入力で確認する。
- 新4fileをmain880b98cf7a682c7902ef3276695bb19e827511b7へ通常反映。3module構文/52moduleリンクを確認し、Pages37254928591はbuild/deploy成功。公開ページにローカル動画・配置・時刻固定・Canvas2D背景重ね/差分・全未分類領域・記録保存を追加した。ゲーム資産の配信なし。
- 親のクラウドブラウザで正式NDSとzuo.webmをファイル選択、D09M04と129.996秒を指定し、ROM床がある地図地点でCPU描画→動画重ね→差分計算→JSON保存まで実行。48474画素比較/678未描画等、RGB MAE50.502。手動地点のため位置不一致を保持し、既存translation基準不通過・領域仮説0。シーク後は旧比較を失効しボタン無効化も確認。
- CLIの別描画点と実動画RGBA比較はMAE49.021、未位置合わせ/枠0。親再実行のstats/alignment/components一致。ブラウザとはクリック座標/decoded画素が同一と確認していないため数値同一を主張しない。以前のD09M04クリック2点の床未検出だけで全map描画不能とは扱わず、今回有効床から実描画できた。
- 現段階の地点・向きは手動で、自動位置特定の完成ではない。上画面marker→ROM地図登録→BMMP物理XZ→COL2床→ROMcameraの自動供給を接続中。同名map・marker・床の代替、初期cameraと現時点cameraの条件は保持する。差分を敵/出生/AT draw確定にはしない。
- 中断した比較/解析途中は既存Library控えversion17へ旧全payloadを保持して保存。現在の新map-video実装は公開Gitへ保存され、このLibrary版には未収録。公開ブラウザ実測画像/JSONは私的保存。

## 12:02 JST — 地図名・主人公位置からの背景比較とサイズ表示

- 同frame上画面のHUD色校正/点候補と既存MapPositionMatcherをROM地図へ結び、BMMP座標→COL2床→ROM初期heading→Canvas2D背景を接続。zuo129.996ではmap画像(172,118)、XZ FX(104474,46092)、唯一床21324。全12登録peak×4色marker候補・本人対応未証明・初期camera条件を保持。Nodeでは手動仮地点MAE49.021→自動地点16.658、微小translation(+4,0)適用14.871。敵精度の改善値とは呼ばない。
- 公開marker版55c8d1dで、ブラウザの新旧module混在が疑われるrenderCurrent未定義を検出。69240993でentry/importの版queryを揃え、再読込後に同NDS/動画から自動描画成功。Pages成功とbrowser実動作を分離して確認した。
- ROMfontの同frame名前候補→catalog map群→上画面marker→背景も接続し、main1b1bed8b/Pages37256808507成功。親ブラウザでは地図名・地点・向きを入力せず、NDS＋zuo＋OBS配置＋129.996秒の固定操作から7904/D09M04候補を得て描画/比較/JSON保存まで成功。検索予算停止・textResolved=false・未知候補は維持。最初の読込で反応しなかった試行は1回再読込で解消、原因は未確定。
- 親browserではrawMAE17.709、(+4,0)適用15.833・400未分類領域。Nodeの422領域とdecoded画素の完全同一は未確認で、数値を混ぜない。画面/名前/点/床の各段階は同じ固定frame由来を保持する。
- サイズ表示設定をmain2e7757eb/Pages37257413427へ公開。default1は全領域表示。小さい内部領域を表示だけ保留し、画面端と未描画境界に触れる領域はサイズに関わらず保持、全生残差と全候補はJSONに残す。親browser min8+再比較で400→90表示、310内部保留、小さい端/未描画境界33保持を実測。遠方の小敵も内部保留に入り得るため、不在/ノイズ確定にしない。
- 保存5frameのNode実行は各frame独立に名前/marker/床/背景を取得。生領域396/409/422/409/519、例min8表示74/62/79/77/125。中心のみ元正式近似bboxへ事後比較し、上端enemy2対応IoU.892を保持、enemy1は大背景へ結合し最高.055。味方/UIも残る。GTは生成/閾値/選択に渡さない。
- 私的再実行source/手順はdots-tools main8f662942まで通常反映確認。ROOT Library v18にはmap-video/marker/browser証拠まで保存、最新name/sizeは公開Git保存済みでLibrary同版には未収録。新たな環境消失はなく、同hostとROM/動画所在を確認。
- 次は現在D09M04でfogReady=trueなのに公開rasterがfogApplied=falseである差を、既存整数clip/native depth24経路から最小接続して比較。古い報告を現行成功とせず、同ROM/frame/cameraのbefore/afterで背景結合と小敵保持を見る。ATへの出生/draw確定は未成立のまま。
