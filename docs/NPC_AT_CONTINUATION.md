# 開始snapshotからの通常NPC継続AT予測

固定baseは `141b979ace67b0372c8dd596a9ec7885800250c8`。`web/npc-at-continuation.mjs` は通常NPCのcontroller更新、actorの移動・flags・角度・elapsed、mode7/8の順序付き候補、方向draw、reset draw、次invocationを計算する純粋なhelper。ATSessionや既存のmonster FSMを変更しない。

新設helperは `npcDirectionCandidates`、`advanceNpcActor`、`projectNpcATContinuation`。controllerのslot順を保持し、特定のNPC ID、map ID、実測frame、候補座標やthresholdを埋め込まない。

## 入力と成立条件

- `origin.json`：開始時のseed/epoch、global mode、slotとpointerの対応、actorの動的状態。`build-npc-origin.mjs` が4MiB開始RAMとROM抽出結果を照合して作る。
- `clocks.json`：外部契約のsourceFrame、delta、scaledDelta、phase。時計packetからのdeltaは外部入力として保持し、actorのelapsed加算にはupdaterが渡すscaledDeltaを使う。phaseは回転更新に使う。sourceFrameは実行前のcompleted-frame番号で、更新後snapshotはsourceFrame+1。
- `actor-rom-data.json`：ROMだけから抽出する静的値。候補vector、三角/atan table、angle limits、配置/移動設定、constructorの定数書込と元位置を含む。
- 完全な通常NPC slot巡回、global mode不変、外部setterなし、同じepochに別AT consumer/seed setterなしを条件として残す。時計や世界全体を再現した証明ではない。

初期化済みactorの現在のflags、XYZ、yaw、elapsed、threshold、speed等は開始RAM由来。ROMの初期値と混ぜない。loaderの条件付き配置履歴は開始時のnative pointer/immutable配置値で照合するが、過去の全interpreter履歴の解決とは扱わない。

`02041128` の先行actor更新 → `0203CD50`/motion/回転 → `0203CE74`時点のflags → elapsed writer → global/controller/placement/actor gates → unsigned elapsed > threshold → 候補 → 方向AT → target書込 → mask8/reset の順。writer時のmask1がsetならelapsed=0、clearならuint32加算。閾値との等値はskip。mask8はresetを省きthreshold=0。mode0は方向/resetをskipする。

角度の低byte切捨ては `0203D314` のMVN、`0203D320`のunsigned CMP、ADDCSから導出した。負数のnearest-256への丸めと読み違えない。mode9/10、未知mode、空候補、alias、特殊actor flags、未支持算術は明示的な未解決境界で止める。`provedMinimumAT` は0のまま。条件付き消費数を全世界のminimumへ加算しない。

## ROM抽出の範囲

`mine-actor-rom.mjs` は指定JP revision-0 ROMのSHA-256を確認し、全FAT resourceを列挙する。全 `.npc` NARC memberとcall、敵のモデルrow/AI定義/マップ種族call、maplist、既知の通常NPC constructorと数値tableを読む。未解釈resourceはhash/位置/理由付きinventoryに残す。全ROMアクターの母数は不明なので `globalActorDenominator:null`、`globalActorCompleteness:false` を出す。

通常NPC、敵、プレーヤー、script生成/その他のカテゴリを別々に記録する。74 archive・1,401通常NPC定義はカテゴリ内の列挙結果。プレーヤーや他scriptの未調査定義数を0と推定しない。`extracted.actorDefinitions:0` は取得件数であり、未知の母数はnull。

各callは `rawCommandHex`、opcode、全引数、packed tagのbyte/bit位置、型・幅・符号、参照先を保持する。`interpretedCallIds` と `unresolvedCallIds` を分け、各引数の `meaningStatus`/理由と適用条件も残す。欠損時は回復済みprefixを残し、未読宣言件数と元spanを記録する。未知値を0で補完しない。JSONで負の0を数値0に正規化しても、元floatのraw IEEE bitsは保持する。

未圧縮データにはfile/member/offset/absolute ROM offsetを付ける。ARM9 BLZ内の値には展開後address/offset、圧縮span、encoded literalのROM位置系譜を付ける。意味の幅と元格納幅が違う低8/16bit変換はtransformを残す。配置変換は生引数とinitializer/tableの入力位置を参照する。条件付きallocationとranked-chain選択は確定扱いしない。

map-id-names.csvは指定hash/size/BOMを検査し、mapIdで照合する。同名を統合しない。ROMだけ/CSVだけのIDをmanifestに出し、CSVを全マップ一覧と仮定しない。抽出器の引数はROM/CSV/outputのみで、SAV/RAM/future traceを受け取らない。

## 実行

Node 24.19.0、Python 3.12で検証。通常のPython標準library以外の依存は不要。下記は公開repoの固定baseへpatchを適用したdirectoryから実行する。ROM、指定CSV、evidenceは私的directoryへ置く。

```sh
node scripts/test-npc-at-continuation.mjs
node scripts/test-actor-rom-mining.mjs
node scripts/mine-actor-rom.mjs /private/ORIGINAL.nds /private/map-id-names.csv /private/mined
node scripts/verify-actor-mining.mjs /private/ORIGINAL.nds /private/mined /private/mined/verification.json
python3 scripts/validate-actor-schema.py schemas/actor-rom-mining.schema.json /private/mined/actor-rom-data.json /private/mined/schema-verification.json
node scripts/build-npc-origin.mjs /private/case/origin.ram /private/case/origin-capture.json /private/mined/actor-rom-data.json /private/new-case
cp /private/case/clocks.json /private/new-case/clocks.json
node scripts/run-npc-prediction-isolated.mjs /private/new-case/origin.json /private/new-case/clocks.json /private/mined/actor-rom-data.json /private/new-case/frozen /private/capture/events.json
node scripts/compare-npc-continuation.mjs /private/new-case/origin.json /private/new-case/frozen /private/capture /private/new-case/comparison
```

予測子processのNode permission modelはmodel/CLI/origin/clocks/minedのみread許可し、future fileのread拒否を検査する。凍結projectionと入力hashを保存してから、別の比較processがfutureを読む。既知traceの再検証であり、blind testとは呼ばない。schema validatorは添付schemaで使用するkeywordだけを実装し、未知keywordを拒否する。一般のJSON Schema全仕様実装ではない。

候補vectorの追加native profileは `compare-npc-candidate-vectors.mjs origin.json FROZEN_DIR VECTOR_CAPTURE_DIR REPORT.json COPY_SOURCE_RESPONSE.json`。copy命令の元registerをROM hash/命令bytesで検証済みGhidra responseから導出し、順序、source index、XYZ、選択ordinalを直接照合する。primary profileとのCPU/RAM一致を流用せず、別bootで確認する。

`bash scripts/build.sh` は既存回帰と新規synthetic testを実行する。新しいC変更はない。AT identifyの固定hash guardは維持する。native capture、必要RAM/raw events、抽出結果、map CSV、Ghidra response、生成実行物は公開patchへ含めない。私的成果物内の結果報告と再現手順に、実行終了code・凍結hash・未対応範囲を記録する。

## 既存AT画面から使う

AT追跡の「起動連続trace / 実測replay」を開き、「開始snapshotからのNPC継続予測」でorigin.json、clocks.json、actor-rom-data.jsonを選択する。3ファイルはローカルWorkerで読み、ネットワーク送信しない。条件付きdraw、終了seed、停止境界を独立表示し、既存ATSessionの証明済み下限・観測仮定下限はいずれも変更しない。予測結果JSONを保存できる。入力差替え・クリアは古い処理結果の表示を無効にする。

再利用APIはweb/npc-at-replay.mjsのcreateNpcReplayInput(origin, clocks, mined)とreplayNpcContinuation(input)。AT Workerは{type:'npc-continuation', input}を受け取り、既存{type:'replay', trace:input}経路でも同じ計算を呼ぶ。input.formatはdq9-npc-replay-v1。この入力JSONは既存のtrace読込からも利用できる。ROM抽出値はresources、動的状態はorigin、外部時刻はclocksとして分離する。これは入力の整合性検査と条件付き計算であり、JSONの真正性や原点以前の履歴の証明ではない。
