# 決定仕様
## D007（2026-09-30）: フィールドノードと自然生成表
path.gp2の静的グラフは全件採掘する。node IDと配列indexは別、edgeの順番はROM順のまま保持。mapコードからP名へ変換する実loaderを使用。未圧縮16命令の先頭0x10をLZ10と誤認しない。既存typed-streamパーサを先に適用して識別する。enemy graphはplayer walkmeshではない。
## D008: エリア・時間候補とAT再現範囲
encfldからmap/table/flagsの不足参照だけを取得し、出現分布は既存enc.jsonを使う。時間不明・area不明は候補を併合し、一意と扱わない。table候補1件でも1消費。生成失敗のtable-only消費、monster移動の直接AT%count、weightedのATRandIntを分ける。占有・移動フラグ不明は未解決とする。連続2消費の候補はそのbranchへ到達した条件下でありフレーム予告ではない。
## D009: 映像と証明の分離
ROMフォントは投入NDSからメモリ内生成する。既存font_akinatorのGPU scorer、既存vision.jsのcamera取得方式を再利用。マップ名の上位候補は未校正であり、選択は表示mapを変えるだけ。映像候補・入力断はminimumProvenCalls0で保存し、既存AT証拠/下限を失わない。全文字・自位置・3D認識が完了したと偽らない。
## D010: Codespace同期と配備
指定fuzzy-goggles-r4vqvwgrw943p5r9でビルド/実測replay。コード・資料・ビルド成果をフォルダ単位で往復同期し、hashで差異を確認してからCodespaceでfull pushする。protocolは利用者所有のため上書きしない。

## D001: 先行スコープ
P0は全mapを対象としたmap metadataと上画面map assetのブラウザ内採掘・表示。ふういんのほこら1Fは実測の具体例であり対応mapを限定しない。map→encounterを1対1固定しない。area切替の未解決を明示する。
## D002: データ境界
解析済CSV/JSONはコピー・ホスト可能。ROM/state/ゲーム由来画像・3D・フォントはローカル入力から実行時取得し公開ディレクトリやリポジトリへ事前同梱しない。
## D003: 出典と確度
マイニング出力はROM path、container entry、offset/size、既存CSV行やGhidra関数名を保持する。静的確定、実測確認、候補、未解決を分ける。未知のarea/座標を捏造しない。
## D004: AT
seed推定/setAT経路を追加しない。起動から既知seedを追跡。下限は証明イベントだけで前進し、不明な消費は候補へ。P0でATナビ完成を装わない。
## D005: 実装と配信
既存JS parserを再利用。WASMを実計算に使用する方針で、既存parserを単に再実装するためのWASM化はしない。Codespace /workspaces/dq9-ATでbuildし専用portへ公開する。
## D006: 通信
protocol.txtは約10分間隔の作業中pull。開始時の内容:「読み込めてるよ」「10分に1回ぐらい読んでね」。既存staged変更を維持。
