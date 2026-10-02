# NPC clock producer — bounded source/native verification

The NPC clock is not a universal33ms/phase2 constant. Existing ROM instructions identify the actual producer and the dispatcher forwarding its results.

- Registry getter0200f25c uses the original literal020f33d8.
-0200ffac consumes a64-bit elapsed argument, clamps it to50000 source units, divides by1000 into registry+3b8, applies the signed16 Q12 scale at+3bc through float32 operations into+3b4, and computes ratioQ12 using the ROM float17.0 into+3c0.
- It transfers pending count+3c8 into+3c4, clears+3c8, and caps the exposed phase at3. A later interrupt can independently increment pending count; this primitive does not claim global writer exclusion.
-0203e21c reads+3b4 via02010064 into r2 and+3c4 via0201007c into r3 before each02041128 call. Its r1 comes from+3b0, an input-vector pointer, not a raw time delta. Preserve Work8's explicit unused delta0 field; do not reinterpret r1 or rewrite frozen clock packets.
- The overlay caller obtains elapsed hardware ticks, converts their difference using a ROM divisor before0200ffac, or passes0 on an explicit alternate branch. Upstream tick timing, pending-counter production, and invocation scheduling remain separate inputs, not predicted by this primitive.

## Native check

An untouched item-shop SAV and the original recorded boot route reach1910/map108/seed1536043482. The capture follows the first180frames of the same held-Left300 input, ending2090. It is a prefix observation through map entry, not a replacement shorter exit recipe.

The isolated arithmetic was written before this capture. A later API-only edit removed fallback constants; replay of the same recorded inputs remains identical. Four native hook instructions are bound byte-for-byte to the decoded ROM.573events, zero drops,67producer calls and372NPC argument comparisons match the producer arithmetic and forwarded values exactly. No future random results or actor states are primitive inputs. The original SAV is unchanged.

Observed raw/scaled delta, phase, ratio values include:
-33/33,phase2,ratio7951
-50/50,phase3,ratio12047
-29/29,phase2,ratio6987
-35/35,phase2,ratio8432
-31/31,phase2,ratio7469

Elapsed argument29477..322350; pending count2,3,4,5,8,20; scale4096 throughout. In particular, pending20 is capped tophase3, and elapsed322350 is capped before producing50. No claim is made for negative signed scales; the isolated primitive returns unresolved there. Constants are read from the verified ROM by the harness and explicitly supplied, not a universal assumed clock.

Producer and NPC dispatch can have different completed-frame counters within one logical update: producer2051 feeds dispatch2052. Bind by execution order; never add a scheduler tick or tag the NPC update with the producer frame blindly.

## Limits and preservation

This is one fresh native observation, without a new off/on pair. It establishes the observed input/output match and ROM source mapping, not all future clock scheduling, world-state equality, or BOOT lower bound. Existing controllerFlags uncertainty and the conditional33 boundary remain unchanged. No product replay was extended.

The first static query started at a literal cell and returned no defined instruction; a subsequent query used the actual getter. An initial capture import referenced the partial Work8 source archive and failed before emulation; it was changed to the byte-identical miner in the complete staged source tree. Failed logs are retained.

Run capture-clock.mjs only in a restored workspace with the documented original inputs and runtime, then verify-clock.mjs. Native evidence, raw Ghidra responses, ROM/SAV, and project copies remain private. Publish only authored primitive/verifier/report and aggregate verification metadata; back up headless capture/query tools to private dots-tools.
