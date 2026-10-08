# Verified accepted-source body color lineage

Baseline: published 785525d source. Task: 61c2c373-7ce1-488e-b07c-a895a0d1c554.

## Bounded production contract

Mixed native composition previously exposed only the final color writer. A later
partly transparent map or MSE write can retain earlier body RGB while making the
final writer a non-body polygon. That old ownership object remains unchanged,
including its incomplete-visible-contribution flag. The optional RGB-dependency
diagnostic also remains unchanged and is not accepted by a new name.

The compositor now issues a separate `source-accepted-body-color-lineage-v1`
record. The source body RGB operands are the actual shaded RGB6 operands supplied
to already accepted fragment writes. Alpha, depth, polygon IDs, facing, order,
fog masks and all non-body colors stay fixed. The record describes exactly which
displayed RGB555 expressions depend on any such body RGB operand, independently
ranged over 0..63. It is **not** actual ROM/background color contrast, removal of
body geometry, an observed-body mask, current actor state or identity.

This bounded source-expression support may satisfy the existing conditional
camera comparison's source-color-support requirement. It does not alter scores,
legacy predictions, source/model/frame inputs, player/background/unknown
alternatives, original-component attribution, UI competition, or proven AT bounds.
All retained model and camera alternatives must still be present. Every rival
still requires nonempty, nondegenerate known support. A fully evaluated empty
lineage remains distinct from unavailable lineage, but does not pass that gate.

## Source arithmetic and completeness

The three accepted native color branches (opaque body, alpha31 in translucent
lists, and ordinary partial alpha) feed a separate replay. Depth, alpha-zero and
duplicate-ID rejection never feed it. Every accepted color write is replayed with
its actual RGB operands, and with lower/upper body-operand endpoints. The accepted
write count must equal the unchanged renderer's opaque-plus-blended write count.

For enabled blending with nonzero prior alpha, each channel is
floor(((alpha5 + 1) * incoming + (31 - alpha5) * prior) / 32).
Alpha31, disabled blending and zero prior alpha replace the destination.
Every admitted recurrence is coordinate-wise monotone, and all-zero/all-63 body
assignments attain the endpoints. Final RGB6-to-RGB555 truncation and integer fog
are included. Equal displayed endpoints mean no displayed body-operand dependency,
even when a symbolic fractional contribution or final body writer still exists.

The fog path uses the scalar form of the pinned DeSmuME535f676 fog implementation
already used by this renderer. It requires boolean enable/alpha-only flags,
uint32 color, signed32 offset, shift0..15, 32 density bytes in0..127, a 32768-byte
table, used weights0..128, depth24, and binary fog flags. Valid RGB6/alpha5 inputs
and nonnegative convex fog factors cannot wrap or clamp. Unsupported inputs yield
no lineage, without changing renderer success, pixels or scores.

An endpoint calculation alone cannot issue the record. Actual replay must equal
all pre-fog RGBA6665 bytes, post-fog RGBA6665 bytes, and displayed RGB bytes on the
entire admitted in-view footprint. The existing whole-proposal unknown-order,
destination and equal-opaque-depth gates remain mandatory. The new record is
bound to the existing frozen destination frame, source camera and alignment.

A private producer record is keyed by the native result state, surviving the
existing shallow isolated-result wrapper but not a structured/JSON clone. Reading
it rechecks exact displayed bytes, zero outside the footprint, source coverage,
frame and alignment. A sparse output witness avoids retaining another RGB frame.
This is an internal producer/consumer integrity check, not cryptographic authority
against arbitrary code executing in the same JavaScript process.

## Verification and limits

The focused suite checks later map/MSE blending and opaque replacement, RGB555
quantization erasure, blend-disabled/zero-prior-alpha, full/partial/alpha-only fog,
unsupported fog metadata, duplicate IDs, depth rejection, equal depth, unknown
order/destination, byte/coverage mutation, clone/cross-frame reuse, replay mismatch,
and conditional-comparison negative controls. It independently enumerates all64
body RGB6 values over4096 deterministic layered traces. Existing final-writer,
opt-in diagnostic, native original-proposal/UI, MSE, request and viewport suites
remain separate regressions.

32 retained source draws from two existing frozen cases have exact original
renderer fields, pixels, full-fit scores, original-component scores and old
extent summaries. These are regression recipes, not recognition accuracy or
all-input evidence. In one draw, 25 final body-writer pixels correspond to226
surviving displayed source-lineage pixels. Other draws have exactly zero lineage
and zero gain; those rivals still prevent conditional preference.

The private measurement includes composition, full fit, original-component fit
and extent, excluding source preparation. Timings and allocation counts are
reported separately with the patch. Three temporary RGBA planes add589824 bytes;
the producer retains two49152-byte masks and an8-byte sparse witness per in-view
footprint pixel. Extent extraction returns a temporary49152-byte mask copy.

No external C++ oracle, whole native frame equivalence, live browser qualification,
full build, new video accuracy claim, physical-removal proof or complete automation
claim is made by this patch. The integrating task owns combined build/publication.
