/* Ghidra batch_decompile result, dq9_new2.nds, 2026-09-29.
 * RAW DECOMPILER OUTPUT (not production code). Runtime AT pointer requires reading literal DAT_02003c58.
 * Do not replace rand.js or guess ATRandInt floating-point semantics from the imported comment alone.
 */
uint UpdateAT(void)
{
  uint uVar1;
  uint uVar2;
  uVar1 = DAT_02003c60;
  uVar2 = *DAT_02003c58 * DAT_02003c5c + 0x3039;
  *DAT_02003c58 = uVar2;
  return uVar1 & uVar2 >> 0x10;
}
void ATRandInt(undefined4 param_1,undefined4 param_2,undefined4 param_3,undefined4 param_4)
{
  int iVar1;
  undefined8 uVar2;
  undefined8 uVar3;
  iVar1 = UpdateAT();
  uVar2 = IntToDouble64(param_1);
  uVar3 = IntToDouble64(iVar1 + -1);
  uVar3 = Double64Division((int)uVar3,(int)((ulonglong)uVar3 >> 0x20),0,DAT_02031ef8,param_4);
  Double64Multiplication((int)uVar2,(int)((ulonglong)uVar2 >> 0x20),(int)uVar3,(int)((ulonglong)uVar3 >> 0x20));
  Double64ToInt1();
  return;
}
