# Work8 post-prefix bounded check — 2026-10-02 15:55 UTC

This does not extend the production replay or BOOT lower bound.

The untouched input SAV and the original recorded boot/Left300/release441 route reproduce the accepted frame2651 boundary: map100, seed1926876651. A fresh native run then observes600additional frames with no input. Four AT calls occur: direction/reset at completedFrames2950 and3198, ending seed3515178439. All four entry/return LCG transitions match; observer drops0. The call tree records12nodes and4accepted events with no drops, but explicitly retains estimated=true and unknownRoot=true. No caller outside the two known NPC direct-LR sites appeared in this interval.

A retrospective source comparison starts from the original Work8 origin/actor fields and preserves its six-call prefix. With the explicitly assumed continuation clock (every second frame2652..3250, delta0/scaledDelta33/phase2), it computes the same four additional frames, callers and seed transitions. Future actor states and random results are not predictor inputs. The new per-dispatch clocks were not measured or source-proven here; this is not independent frozen prediction, whole-state equivalence, or a new certified world minimum. The original controllerFlags mismatch remains unresolved.

The first diagnostic used an incorrect event.lr field and therefore stopped at the first actual NPC call; the corrected run uses the actual regs[14] schema. A separate output-directory collision was rejected before emulator startup and left prior evidence untouched. Both attempts remain in the private checkpoint.

The native capture tool is backed up only in private dots-tools, and raw register/trace records only in the private Library checkpoint. The public files here are the verification summary and conditional comparison source. Reproduce from the restored original Work8 source/evidence layout plus the current private night checkpoint; do not invent alternate save-state sources.

Recognition: a simplification that classifies all automatic components before the8box budget still missed the small H5 enemy and increased false positives relative to V5+CLS. It was rejected, with fixed thresholds unchanged. No new recognition candidate was adopted.

Next bounded AT issue: identify the producer of NPC updater clock arguments before claiming a source-derived continuation clock. Do not keep extending native capture windows merely to accumulate matching counts.
