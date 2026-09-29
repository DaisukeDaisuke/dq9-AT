# Map resource anchors / G01
Program: dq9_new2.nds (project /dq9_new2.nds; display name dq9_new - コピー.nds)。2026-09-29。静的読解であり、ROM実行でのmap/area観測ではない。
## Stringsとxref（MCP出力を転記）
- 020ef3bc data/pack_lv5/minimap.gp2 -> 020207e8,020211ec,0202140c,0202144c,02021ecc,02021f24,02022064,020220b8,020222f4
- 020ef3d6 data/pack_lv5/minimapt.gp2 -> 020216c4
- 020ef532 minimapbg2 -> 02021dc4
- 020ef588 data/map/w_offset.bin -> 02022308
- 020f16c4 data/map/maplist9.bin -> 0209b60c
## 正式関数名でbatch_decompileした対象
FUN_020207b4, FUN_0202116c, FUN_0202162c, loadMapList9, FUN_02020834, FUN_02020bc8, FUN_02020cf4。ユーザーの例示FUN_overlay_d_03__0217d3b8は対象にしていない。
## 読解
FUN_020207b4はFUN_02012dacの戻り値+0x26からmember名を構成してminimap.gp2を要求し、param1+0x989へnameを保存。書式はDAT_02020828の先にある（未読）。
FUN_02020834は取得memberをcall interpreterに渡す。handler tableはDAT_020208c8が指す。
FUN_0202116cはminimap情報のcall streamを読み、base画像名(param1+0x548)とlayer配列(param1+0x20,stride0x24,+4にname)から追加memberを要求。
FUN_02020bc8とFUN_02020cf4はFUN_0203b594で画像をロード。baseも各layerも同形式。
loadMapList9@0209b5f8には既存注釈あり: handler table020f168c、1038 instructions / opcode0x67 field records1010、F02->map0x4E22 areas5/6、F07->map0x4E27 areas18/19/20。これは既存研究注釈の再利用であり今回の実測ではない。pickupとの関連をmonster spawn判定へ無断流用しない。
## 次の不足
minimap member名/画像形式/配置callのABI。maplist9の既存parser/結果を探してmap-area-fieldの構造を再利用。encounter table切替条件は別に証明する。
