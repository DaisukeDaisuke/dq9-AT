/* Raw Ghidra batch_decompile output, dq9_new2.nds, 2026-09-29.
   See 03-area-selection.md for separately recorded interpretation. */
int FUN_0209b79c(int *param_1,uint param_2)
{
  uint uVar1;
  int iVar2;
  iVar2 = 0;
  while (true) {
    if (param_1[1] <= iVar2) return 0;
    if (param_2 == *(ushort *)(*param_1 + iVar2 * 0x10)) break;
    iVar2 = iVar2 + 1;
  }
  uVar1 = (uint)*(byte *)(*param_1 + iVar2 * 0x10 + 0xe) << 0x1a >> 0x1c;
  if (uVar1 == 8) return 0;
  return 1 << uVar1;
}
int FUN_0209db40(int param_1,int param_2,uint param_3)
{
  int iVar1;
  int iVar2;
  iVar1 = 0;
  while (true) {
    if (*(int *)(param_1 + 0xc0) <= iVar1) return 0;
    iVar2 = param_1 + iVar1 * 0x20;
    if ((((uint)(param_2 == 0) == (*(uint *)(iVar2 + 4) & 7) ||
          ((*(uint *)(iVar2 + 4) & 7) == 2)) &&
         ((param_3 & (uint)(*(int *)(iVar2 + 4) << 0xb) >> 0x18) != 0))) break;
    iVar1 = iVar1 + 1;
  }
  return iVar2;
}
