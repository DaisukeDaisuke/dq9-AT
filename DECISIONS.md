# 決定仕様
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
