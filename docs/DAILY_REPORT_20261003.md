# DQ9 ATナビ 日報 — 2026-10-03

以後の追記先はこのファイル。時刻は特記しない限り日本時間（JST）。10月2日の日報は過去記録として保持する。

## 10:59時点の引継ぎ

### AT再現・接続
- 道具屋SAVから通常入力でmap108→map100→map112へ移動。map108からの退出入力は左キーをエミュレーター内5秒。
- map112のトリガー前frame3350の実状態から、宝箱系9回＋NPC初期化2回の計11回を条件付き投影。全11回の順序、各seed遷移、乱数戻り値、呼出元が実測と一致。終端seed1280952554。
- kind4の抽選は開封済みフラグの反映より前。flags72→64を理由に先行AT抽選を省略しない。
- map112のsource projectionとATSession保存/replayへ接続済み。JSON往復一致、偽造bound拒否。旧version1保存レシピを維持し、拡張は明示version2。
- 公開commit: 7d29189673ddc5e92e0ac49c295734560e82f636。既存buildの50検証コマンド＋map-entry12チェック成功。GitHub Actions37087961390でbuild/deploy成功。
- 起動下限は0、全世界再現は未達。kind3、物理的青宝箱との同定、完全観測証明は未確認。先行逐次OFF/ONペアの開始時RAM不一致も保存。別のlockstepペアは開始/終端RAM一致・61イベント欠落0だが、全frame非干渉の証明ではない。

### 物体認識
- V6は既知小敵を回復した一方、固定評価で他の敵の見逃しや味方・背景の誤枠が増えたため不採用。数値閾値は変更していない。
- V5は隔離候補を維持。本番認識の改善完了とは扱わない。
- 視覚判断を要する認識改善はdot側で担当。外部Work候補として、数値で検証できる固定カメラ・8方向A*移動（既存Work9）や斜め＋R回転の不一致修正を提示。新規Work未開始、Work9の保留解除は未指示。

### 保存・復旧
- private dots-tools: a4a42b171815b3f3e2bab5df490affc33f06b4e1。解析ソースとハッシュ一覧、再開情報を通常pushし読み戻し確認済み。
- 私的チェックポイントはversion9へ更新し、CRCと全323member hashを検証。ゲーム由来資料はGitへ入れない。
- 稼働中の環境と必要ファイルは保持。不要なROM/動画再取得や復元は行わない。

## 次の実作業
1. map112の抽選直後と開封反映後を区別した実測受入を確認。欠けている観測条件を未確認のまま成功扱いしない。
2. 実動画の枠検出改善は固定失敗を保持し、必要な最小修正を進める。新しいWorkへ渡す場合も本体との競合を避ける。
3. 重要な成果・障害だけ連絡し、この日報へ追記する。

## 11:07 JST — map112の実測を追跡へ受入

- 元SAV・通常入力による新しい3350→3732の限定OFF/ON計測で、383frame境界のARM9/ARM7 register・画面・対象stateが一致。開始/終端4MiB RAM一致。
- 更新入口/出口/seed setterを元ROMとlive codeで照合し監視。35イベント連続、382回のdrain欠落0、setter0。
- 宝箱の値は終端、flagsは開封反映より前の実store時registerから取得し、採取時点を分離。既存比較器127チェック・11回順序比較が成功。
- 実測をATSessionへ受け入れ、保存→復元一致、再送同一性、seed改変/イベント欠落拒否を確認。局所観測11・条件付き11。起動下限0は維持する。
- 先行失敗・未確認条件はそのまま保持。物理青宝箱同定、kind3、未来clock、全世界再現は未達。

## 12:18 JST — Work9レビューと継続

- Work9はユーザーが開始し、Library通信を明示許可。移動目的は元ほこらState・8方向・L/R対応A*。指定public参照基準49615da848cc3ee46175b99ac5a5469f4f707c22を維持し、現在mainへ勝手に変更しない。
- 原近距離goal(1.5,14.5)、許容0.2、元/L/Rの各27frameの成功入力列をdot側で独立native再実行。全条件で提出座標と一致し、paused=true/running=false/input0、停止後読取でframe追加0を確認。元コード9試験、source manifest5件も一致。壁回避・全map・全条件無遭遇とは認定しない。
- 実行関数が途中到達でも残りの入力を進める不備を、小さい決定的制御例で再現して訂正送信。client7は修正とframe3での打切りを報告。新コードの最終独立確認は未了。
- ユーザーの追加範囲は遠方goal、ノード外任意world/chunk-local座標、道中に新たに出現する敵も含む観測更新とエンカウント回避。停止時点は移動完了であり、探索計算完了ではない。
- client7は遠方の元goal未達・安全停止を保持し、別の事前固定通路goalを実行中と報告。未達を成功へ読み替えていない。追加実装済み部分は即提出し、追加テストはdot側が担当するよう、12:15 JSTにユーザー指定で送信。受領/最新版提出待ち。
- Work10候補は生成直後から次のスポーン抽選までのAT再現接続。まだ新しい外部Workを起動していない。

## 12:18 JST — dot側の独立作業

- 認識V6の位置候補を固定し、最終CLSだけ従来の元解像度へ戻して既知評価を再計算。T320の味方誤枠2→0、T1190 TP13→14だが、D2/H4の見逃しとHの誤枠は残る。元の基準へ回復せず、V6は未採用のまま。閾値・注釈・固定入力を変更していない。
- スポーン生成後のstatus bit2を調査。元frame1200のpool値F8から、確認したreset/mode5処理だけなら結果候補8/10のどちらもbit2=0となり、比較用native0Aと整合する。未来のanimation objectを入力にせず、この1bitを扱える可能性を絞った段階。全constructor区間の保持と後続animation consumerは未閉鎖。productionの停止guard、起動下限0、追加AT証明0を維持する。
- private source/再開参照を033d244e044ba150502b32b78f2007a7a8adf573へ通常pushして11ファイル読戻し確認。私的チェックポイントversion11を保存。ゲーム由来raw・通信本文はGitへ含めない。


## 12:36 JST Work9 v2の独立再生と引継ぎ

提出sourceの13ファイルhashを照合し、元ROM・ふういんのほこらステート・既存headless runtimeで保存済み遠方入力列を再生した。元/L/Rの3条件は73/73/72移動frames、全frameのXYZと敵観測配列が提出記録と一致。各到達直後pause・キー解除・停止後読取追加frame0。道中新規モンスターも観測（元条件64frame）。同じ成功列のchunk/local・planeXY入口も一致。

旧executeSegmentsの到達後余計な入力は、保存済み反例で8→3frames停止に修正を確認。既存17制御試験もpass。native入力前距離停止および現在PC breakpointによる停止機構は追加frame0（実遭遇試験とは区別）。

一般的な壁回避、動く敵を含む全条件の無遭遇保証、厳密座標2件（tolerance0.035）の到達、AT consumer接続は未達／未検証のまま。別goal・tolerance0.2の成功で置き換えない。提出担当は停止し、追加試験と必要な修正はorchestraが引き継ぐ。全体完成認定はしていない。


## 13:37 JST 移動中のAT実測を既存replayで照合

元ふういんのほこらState・保存済み73frame移動列について、安全停止付きの基準側を各frame先に実行し、遭遇/seed setter停止がない場合だけobserver側を同じ1frame進めた。計測中75回すべてのmain RAM・ARM9/ARM7 register・field状態が一致。停止型breakpointとobserverを同一sessionで併用する制約は変更していない。

18回のUpdateATと18回のATRandInt実returnを72eventで捕捉し、欠落0・seed chain一致。既存replayObservedTraceとWASMで18/18、差0、最終seed0xcff55723。17回のtable選択wrapperと1回のweighted種選択wrapperを観測した。新しい敵候補はframe64で観測。生成entry自体は今回未捕捉なので、空の生成entry配列を「生成0」と解釈しない。

これは局所の実測replayであり、未来の出現・scheduler到達を自律予測した結果ではない。起動下限加算0。映像からの自動観測接続は未完了。

## 13:32 JST Work10開始と依存の最小解消

ユーザー開始のWork10 client1を受信。ROM・全5動画・既存成果は取得/hash照合済み。Python3.13と提供runtimeのPython3.12 ABI差が障害となったため、既取得libonnxruntime.so.1.23.2用の公式C APIヘッダ2点だけをLibraryで提供した。orchestra側ではC API23取得成功、担当側の推論確認/ackは未確認。

指示書はLibrary IDから直接取得する方式。入力の不要な再梱包・分割は中止した。認識方式は限定せず、ブラウザを使わず調査・隔離比較・ZIP提出を依頼している。本番反映や認識精度改善の完了とは区別する。


## 14:28 JST — 身体枠研究の提出と独立再集計

ユーザー提示のDQ9_BOX_STUDY成果1.0.0を取得。ZIP全体SHA・428エントリCRC・427payloadのサイズ/hashを照合した。提出済み注釈とraw予測に対して、提出者の集計コードとは別の最大対応数計算でtop8/display2・IoU0.3/0.5を再集計し、100集計セルのframes/TP/GT/FPが一致。新たなモデル再推論や注釈の独立正当性確認ではない。

既知の見逃しは中央/HUD除外、身体候補未生成、閾値、NMS、表示順に分かれる。種分類と位置表示は別経路であり、DINO順位改善だけでは候補未生成を解消しない。新規時刻の適格15場面・9身体で、小型器は不要表示枠27→21だがIoU0.5は3/9のまま、味方/NPC誤枠5→8、旧D2/H5に回帰悪化。調査成果として保持し、本番採用はしない。

既存Work10 client2はC API実推論とorchestra1受領を報告。今回の提出ZIPはNode/Python実験で、内包通信控えはbinding未解決・未送信。この2つの実行を同一と認定しない。Work11用指示書は既存入力IDと提出ZIP IDだけを参照し、案・実装・失敗の仲介を明記して提供済み。外部担当の代理起動は行っていない。

## 14:28 JST — 移動とATの追加確認・座標読取修正

元Stateからmap7402/D04M02・自然出現table30を解決し、既存naturalTailへ観測済み到達条件を与えた17試行18drawが一致。最後の種108が新規観測と一致した。35回のscheduler/clock観測も既存clock式と一致し、生成後のdeltaが33固定ではなく50となる区間を保存。未来clock・分岐到達の自律予測や起動下限加算とは区別する。

敵の物理Y読取に実際の不備があった。旧adapterは+0x54を読み、通常local座標を読むROM関数は+0x48を使う。最小1offset修正を行い、元/L/Rの保存済み遠方列を再実行。全player XYZ・enemy XZ/identity、73/73/72frames、到達直後pause/入力0/余分なframe0を維持。旧Yは同一adapter間で一致していたにすぎず、物理Yの正しさの証明ではなかった。既存RAM/register一致とXZ経路結果は維持する。

private dots-toolsの修正commitは033a57727b28517a8e1858705f37eaaaad8f53a2。原提出と旧失敗記録は保持。認識本番改善・全map予測・一般壁回避は引き続き未完了。


## 15:33 JST — 自然生成・二重登録防止と新しい調査方針

保存済み元ほこら移動列で、自然creatorへの実呼出しと戻り値を捕捉。frame63のmap7402/monster108/table30、戻りslot113、次frameの登録serial2を照合。生成前後のAT seedは同じで、局所18draw後の生成1件として既存replayと一致した。75回のmain RAM比較は以前の計測と一致し、観測側と基準側のregister/field比較も一致。

既存の生存期間管理へこの生成を登録し、同じ生成イベントの再登録を拒否。既存ATSessionへgeneration IDで自動接続し、同じ観測の二重登録拒否と保存復元を確認した。映像由来の同一個体判定や一般的なslot再利用問題を解決したという意味ではない。boot下限0は保持。

同じ局所経路の32回の幾何queryで、既存距離式とnative returnが一致。最初にtable選択へ進める直前は距離41375、次は40591でthreshold40960を跨いだ。実角度12867→12868の1unit差で優先nodeが9→8になる例も確認。初期inventory固定の条件付き比較であり、将来移動・clock・全分岐の自律予測ではない。

Work11の提出実行sandbox053559をhashで特定してレビュー。source/evidence全CRC・124payload hash一致、公式C APIヘッダで構文確認、保存rawの別実装60集計セル一致。表示IoU0.5はV5 7/0/13、dense 3/9/17、dense-realneg 2/0/18で不採用。別設定の同名通信系列が存在するため、先の6/9/14と混ぜず、番号衝突は未解決として保持。研究提出物のみを受け入れ、追加認識モデル試行は打切り方針。

新しい本線はROMに基づくマップ全体の互換描画。3名が共通ボードでアドレス・関数・小問を分担する指示書を提供済み。ブラウザ可能な担当は解析に加えSites描画調査も担当可能、使えない担当は解析に専念。統合・受入はorchestra。ふういんのほこらの霧を比較条件に残す。事前データの手埋めではなくROM/stateから再生成できるスクリプトを成果とする。担当の代理起動はしていない。

private source backup: 2c0e3c64494355f4c53fd32fff8447b772b86831。局所生データは既存Library成果のversion2へ更新し、原ROM/動画/抽出資産をGitへ含めていない。


## 16:38 JST — マップ互換描画の独立再現と全ROMの形式母数

- 対象は全マップ。ふういんのほこら元ステートは最初の動的照合条件であり、全体の終了条件ではない。
- カメラr1: 元ステートを再抽出し、root自身が原ROM/供給observerでGX送信入口を96回再捕捉。透視48packetのeye・projection16word・view12wordが提出実装の再計算と全一致した。停止BP観測であり、スケジュール同等性・画素一致・全マップの証明にはしない。
- 配置r1: 原ROMからcall-streamを再生成、原ステートのnative RAMを新規採取。44モデル/配置・親/参照とworld位置/scale/yaw44件が一致。6frameのdraw consumerをoff2/on1で再実行し、両CPU/scene/instance/IO/image/final RAMの比較一致、339event・drop0・drain非進行。44entryから34draw callへ進む範囲を再現。描画関数の呼出し数を画素可視数にはしない。
- 上記2件の再計算コードは提出実装を使用。ROM trig/literalのGhidra queryは提出物を照合利用しており、別アルゴリズム実装や全静的解析の独立再実施とは区別する。
- 霧: 保存済み抽出スクリプトをrootの原ROM/stateで再実行し、提出の元状態fog JSON全体と一致。write-onlyな密度表のIO readback全0を実際の霧密度にしない。設定元・全map差・pixel適用は引き続き未完。
- 全ROM形式母数: maplist1010record/872fieldCode。実在する全1350 AMBL/AMDJを走査し1422 BMBl/BMDJ streamの構文を取得、archive/member構文エラー0。これは描画成功数ではない。共有ats資源、大文字小文字差、O00a/O00b等を単純な同名ファイル規則から外れるものとして保持し、未解決pathを不存在mapと断定しない。
- 委員から全4328モデル/36632shapeと省略引数/SBC終端対応の追加成果が提出されているが、その新しい版のroot受入はまだ。r1検証済み範囲へ合算しない。
- 本番描画への統合、node/skin/SBC変換、texture/material、fog/effect、可視条件と画素比較は残作業。原ROM/state/RAM/動画/抽出ゲーム資産はGitへ追加していない。


## 17:54 JST — 最終解析成果の受領と描画接続の実装開始

- A r5、C r6が最終成果を提出し担当終了。rootがZIPのSHA/CRCとmanifest（A source96/private232、C source98/private655）の全size/SHAを照合した。これは内容全機能の動的受入ではない。
- ROMからARM9 SDK初期化データを読むbrowser-compatible JSを追加。trig/pivot/material maskの3範囲が元state RAMの値と一致。ゲーム資産や定数表はソースへ埋め込まない。
- 隔離したdefault node/SBC matrix/shape/colorの接続を実装。祠archive39 NSBMDの構文処理を実行、44配置のうち39 static instanceを組み立てた。残る5 special modelは未対応として保持。浮動小数の合成行列はnative幾何一致未検証。
- texture/paletteをauthor指定16byte名で接続し、325 materialで取得、2件は未解決を保持。再現CLIで出力再一致。palette indexや名前補完は使わない。texture接続はまだWeb shaderへ未結線。
- 隔離WebGL診断ページを作成しsyntax確認。クラウドブラウザのlocal preview接続はERR_BLOCKED_BY_CLIENTで遮断され、ブラウザ表示・画素一致は未確認。ページを完成したビューアとして公開していない。
- 全マップという目的を維持。床Yと既存2Dmapクリック接続、runtime可視性、特殊モデル、texture/global material、fog、native clip/rasterが残る。公開本番の認識器は変更していない。
- 復元索引version5とLLVM Library manifestを非公開dots-toolsへ通常バックアップし、remote本文一致を確認した。原ROM/動画/RAM/抽出資産はGitへ含めない。


## 18:21 JST — 霧の提出実体を分離受入、カメラ入口の再照合

- B local9945という未採番の最終成果を確認。新UUIDでもseq1/2の手元とLibraryの異文が報告されており、B3本文とは帰属を自動統合しない。原因・作者・正本は未確定。成果ZIPそのもののSHA/CRCとsource26/private74全payloadを照合して受け入れた。
- rootが原ROMから504bats/正常3528fog命令を再生成。503構造変換、315継承可能、188未指定拒否、1異常命令を再現。静的件数を描画可能map数にはしない。
- 原ステート12frameのoff/off/onをrootが新規採取。392byteのROM生成fog構造が39採取点すべて一致。CPU/context/RAM/IO/image比較一致、12event/drop0、drain非進行。初期化済みstateの継続であり自然map entryの証明ではない。
- 整数fogを固定core切出しC++と再比較し、LUT14,417,920byteと色混合36,896ケースが一致。RGBA6665/depth24/受理済みfragmentのfog maskを要求する接続入口を追加。WebGLの正規化深度をそのまま代用しない。全scene画素一致は未完。
- C r6のplayer→camera入口をrootの既存native採取へ再照合。target/eye96件、透視P/V48件一致。新規96frameの実験とは数えない。
- 既存マップメタデータを再利用するクリック座標→希望player位置→camera接続を追加。元の祠位置への逆変換でeye一致。高さYと現在camera条件は明示入力で、床高自動導出・ブラウザ操作試験・実際の移動は未実施。
- 静的adapterを全669AMDJ/755配置streamへ適用し、5651配置のうち3691静的instanceを組み立て、1960件を未対応として保持。内訳はcol2系1297、BBY444、BB107、flag0x10系112。これは描画数でも互換完成数でもなく、次の未対応箇所を切り分ける実行結果。現在BB/BBYのnative計算接続を調査中。


## 19:27 JST — 環境置換後の復元と再開地点

- 18:47〜18:49 JSTに作業ファイル消失と使用容量減少を確認。直前の公開ソース39ファイルはcommit 15afa62d48eb3bb257ecf30420ebcec860f39322に保存済みで、そこから復元した。旧環境の未保存raw採取結果まで復元したとは扱わない。
- 正式復元索引version5を全文確認し、ROM8part・動画18part・Ghidra12part・LLVM7package・tools/state/save/NTRの計49入力を新規取得、全size/SHA照合。ROMのgzip、5動画tar、Ghidra ZIPの結合・整合性検査も成功した。
- 既存Node/Python/JDKを再利用。原ROMと祠stateのロード、およびSAV importをpause/frame0で確認。Ghidra synthetic smokeと原ROMの新規importが成功（12641関数、analysis timeoutなし）。旧注釈済みDBを再現したという意味ではない。
- 復元したアプリのbuild成功。既存契約チェック268件pass。祠39モデルのstatic geometry再実行成功。ブラウザ表示・画素一致・全マップ描画完成の受入は未実施。
- BB/BBYの通常分岐に限定したGX packet builderを隔離保存。native model-view読戻しと前回packet templateを明示入力とし、未対応inverse/callback/suppressed条件を拒否する。現時点は静的解析由来とidentity入力のsmokeのみで、native動的比較・描画接続は未検証。既存のBB/BBY未対応判定は解除していない。
- 復元指示書のURL置換用ソースは固定版と現行版を分離して取得中。新しいLibrary登録と索引・スケジュール参照更新は未完了。ROM/動画/RAM/抽出資産はGitへ含めていない。


## 20:15 JST — 床候補のnative計算を限定再現

- 復元索引の外部URL9箇所をLibraryソース控えへ置換。掲載先は第7節、古いclone前提も訂正したversion7へ更新し、復旧スケジュールも同じ版・size/SHAを参照する。固定基準と必須ROM8part/動画18partは維持。
- ROM内だけで資産を読む隔離描画診断ページを追加し、CI/deploy成功。明示指定のtexture/materialを接続したが、dotクラウドブラウザのWebGL2初期化が失敗。理由の表示と操作無効化まで画面で確認。ブラウザ描画成功・画素一致とは扱わない。
- col2のnative loader/candidate consumerを調査し、全1350 AMDJ/AMBLにある1178ファイルのheader・28byte record・cell index範囲を読み出せた。これは構造確認であり、床高や描画成功の件数ではない。recordは3頂点とnormalで、4頂点と仮定しない。
- 元ほこらStateから自然に到達した線分/三角形、線分/平面、床候補選択を停止型観測で取得し、JSの整数計算と照合。実際の候補1件で選択index0・交点[0,653,65536]が一致。順位評価のY=656を最終交点Yへ代用すると3FXずれるため、nativeの最終平面計算を保持した。同じ入力の別実行であり、全map・複数候補・非干渉の証明へ拡大しない。
- 02018d5cは元Stateの1frame観測で未到達。この失敗を保存し、到達した別の下位関数と混同しない。field/gridからの候補生成、instance座標変換、上下に重なる床の選択、mapクリックへの自動高さ接続は未完。
