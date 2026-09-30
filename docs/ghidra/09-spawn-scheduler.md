# Natural spawn scheduler — current C3 analysis

Program: dq9_new2.nds. 2026-09-30. Static candidates below are kept distinct from live validation.

## Source chain
Searched FUN_02074568 and FUN_0201006c by name; obtained canonical names and batch-decompiled. Also obtained full FUN_02074568 disassembly. FUN_0201006c reads dynamic-manager +0x3b8. Its only direct callers returned by Ghidra are FUN_02023df0 and FUN_02074568. The former maintains another timer and does not explain the writer of +0x3b8.

## Instruction anchors
- 020745d0: delta returned in r0, field pointer r8, timer at [r8+8] before ADD/STR.
- 020745dc: updated timer in r0, compare signed with 1000; below returns.
- 020745fc: free-slot result r0, negative returns.
- 020748cc: selected party member r9, negative returns. Iteration at [sp+0x18].
- 02074b38: best direction node r4, candidate count r7, ordered pointers [sp+0x60]. If no positive-dot winner, nonempty candidate list consumes UpdateAT modulo count at02074b4c; no candidates returns/fails this attempt.
- 02074b64: final selected node ID r4.
- 02074dc8: selected table pointer r0 after02075050. Table ID u16+0, flags u32+4.
- 02074df0: CMP r1(timer),r0(threshold); threshold = (7-((flags>>21)&15))*1000. Table selection has already consumed AT.
- 02074e10: final table pointer r11, reached after a passing delay OR exhaustion of the four-attempt loop.
- 02074e20: weighted monster-selection return r0; -1 returns.
- 02074ebc: creation return r0; nonzero alone resets [r8+8] at02074ec4.
- 02074ec8: common exit before stack unwind.

## Important distinction in the four-attempt control flow
A failed delay advances the attempt counter. If no untried eligible party member is available at020748cc, the function RETURNS immediately. But exhausting all four iterations falls through02074e10 and may call the weighted selection if r11 still holds a table. Do not simplify every failed delay to a terminal no-weighted result.

## Runtime factors that remain inputs until reproduced
Story/map activity gate, dynamic-manager delta, slot availability, eligible/untried party members, nearby-monster counts, current-node identity, heading/dot fixed-point values, node occupancy, collision/coordinate interpolation and node flag bit1. Negative/unknown inputs must not be silently replaced by empty/zero.

## First live findings
The read-only C3 metaru_nasi trace recorded actual delta values 50,30,33 (not a fixed33 per frame). At invocation69, timer2325 was compared against3000 for table30 flags8391802; next member search returned-1 and exited with timer2325. First creation input at ATsequence90 was monster3/table30/map7402. Full validation and trace persistence follow; this is state-relative, not proof from boot.
