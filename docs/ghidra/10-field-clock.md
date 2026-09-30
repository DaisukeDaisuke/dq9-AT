# Field timing source — C3, 2026-09-30

Static source: Ghidra dq9_new2.nds, functions searched/located then batch-decompiled. This analysis concerns frame elapsed time, NOT an alternate initial AT seed or reseeding method.

## Dynamic manager delta
`FUN_0201006c(manager)` reads +0x3b8; natural spawn02074568 adds this to its timer+8.
Search `str` operand `#0x3b8` identified main writers0200ff80 and0200ffac, rather than inferring a constant from the accessor.
`FUN_0200ff80` initializes +3b4=33, +3b8=33, scale16+3bc=4096, +3c4=2, +3c0=8192.
`FUN_0200ffac(manager,elapsedLow,elapsedHigh)` clamps elapsed u64 to50000 then divides by1000 to set the unscaled +3b8. The division callee0200cda0 was decompiled: unsigned64 division, narrowing to the32-bit division path when both high words are0. Scaled +3b4 and +3c0 are other outputs and are not the spawn getter.
Read constants02010058: `50c30000 00008045 00008841` =50000, float4096, float17.

## Field-loop caller
`FUN_overlay_d_17__0218c2a8` initializes the manager and repeatedly calls0200ffac at the end of the field loop. It subtracts a retained64-bit timer sample, multiplies the difference by64000, divides by a fixed constant at its0218d430 literal, then supplies elapsed low/high. Under the alternate global gate, it passes0 instead.
The timer sampler has a pre-existing Ghidra label `GenerateInitialSeed`, but its repeated use here is as elapsed-time sampling. That label is not evidence of AT reseeding.
Four direct callers of0200ffac were listed: overlay_d_15__02194058, overlay_d_17__0218c2a8, overlay_d_19__0218c1c8, overlay_d_21__0218c21c. Overlay17 is the field path investigated.

## Conditional entry RNG
The same field-loop setup includes UpdateAT under dynamic mode0 and a separate ATRandInt(2) conditioned on mode and held button bits0x100/0x200. These are not unconditionally credited to the boot lower bound; exact control/input evidence is required.

## Runtime validation status
501 saved scheduler invocations,4053 event rows in metaru-nasi-scheduler-c3.json, replay completely with0 mismatches through production FieldScheduler plus Codespace-built WASM. Across all three actual traces257 UpdateAT,163 ATRandInt returns and19 creation inputs match.
Timer delta in that actual trace includes50,30,33; a fixed33 model would diverge immediately. Scheduler branch/AT/timer decisions are reproduced, while member selection, direction/geometry and elapsed-time inputs are still actual captured inputs. This is not a claim of complete autonomous frame simulation.

Next direct observation: hook0200ffac entry and its +3b8 store result, correlate supplied elapsed to floor(min(elapsed,50000)/1000), then remove measured-delta dependence at that layer. Runtime comparison must precede promotion of new arithmetic to exact status.
