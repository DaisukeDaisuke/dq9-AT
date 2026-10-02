# Pending counter source follow-up

A bounded static ARM instruction-pattern check found three candidate stores with positive immediate offset 0x3c8. This is not an exhaustive alias/writer proof. Existing Ghidra analysis identifies 0200f894 as initialization to zero and 0200ffd8 as the already verified producer clear.

The remaining 020129dc belongs to FUN_020129a0. It obtains the same registry through 0200f25c, loads registry+0x3c8, increments by one and writes it back. It then ORs bit 1 into the interrupt-check flag location. The existing xref links this callback through a parameter at 02012a3c inside initialization FUN_020129fc, which passes mask1 and a callback literal to FUN_020c85b8. A further read confirms callback literal02012ac0 equals020129a0, and020c85b8 assigns the callback into the mask-selected interrupt table (mask1 selects entry0). The flag base literal020129f8 is027e0000, so the handler sets bit0 at027e3ff8. These are static source bindings. Native callback timing and all possible alias writers remain unverified; this is not an independently measured scheduling source.

The clock primitive remains input-driven. No new replay consumption, BOOT proof, product integration or native measurement is claimed here. One query at adjacent 02010084 had no defined instructions; no mutation or automatic analysis was performed.

Browser follow-up at 16:50 UTC found the prior cloud tab30 expired. Download completion stays unverified; verified earlier browser observations are preserved. This is not evidence of a cloud filesystem reset, and no browser reload/re-inference loop was started.
