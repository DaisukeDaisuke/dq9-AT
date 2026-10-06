# Bounded local-patch rejection evidence

The measured-video replay now retains one additional diagnostic pair: the first completed pair with an existing local registration gate/tie rejection, or a forward/backward mismatch after both registrations succeed. The earlier `insufficient-known-patch-samples` and `patch-texture-unresolved` checks do not select a pair. Selection uses existing rejection stages, with no new threshold, track ID, species, coordinates or video-time filter.

This is failure evidence, not a tracking fix, correspondence fallback or identity certificate. The camera gate, local registration search/radius/cost/tie rules, tracker states and existing yield checks remain unchanged. Source conflicts and temporal gaps still fail normally.

## Contents and privacy

`registerPatch` failures expose `rejectedPatchAttempt` scalar evidence: the rounded ROI; already measured sample count and texture; sample stride and cap; and, when search ran, the selected dx/dy, residual, winning known-overlap count, evaluated-offset count and failed existing gates. Nonfinite residuals are explicit strings in JSON. No new pixel cost is evaluated for this evidence.

The selected pair retains every attempted track on that pair, capped by the existing 32-track budget, including tiny precheck failures and successful correspondences. Each record includes its source ROI and separate forward/backward results with their actual from/to frame keys. A missing backward result means it was not run after forward rejection. Both frames retain exact source/epoch/segment, source PTS, available RGBA hashes and capture timestamp binding.

Only the explicit comparison download calls `localPatchFailurePixelPairSnapshot()` and adds `measuredLocalPatchFailurePixels`. Normal replay state exposes a small first-pair summary/counts; it contains neither gray/blocked arrays nor the detailed attempt ledger. The existing camera export remains separate and unchanged. These actual-video pixels belong only in the private comparison download, never a source checkpoint or Git publication.

## Bounds

- One local pair: 2 × (49,152 gray + 49,152 blocked) = 196,608 retained typed pixel bytes.
- Existing camera pair: at most another 196,608 bytes; combined diagnostic pixel ceiling is 393,216 bytes.
- One per-pair ledger with at most 32 track attempts and at most 64 directional results; no per-offset cost arrays are saved.
- Before selection, the transient per-pair collector also holds at most 32 scalar correspondence results. It is discarded after the pair, or after an invalidated replay generation.
- Source reset releases the local pair and ledger. Reseeding and frame/history eviction do not replace the first pair.
- Pixel accounting excludes object/string overhead and the temporary JS number arrays/JSON created only during explicit download, as with existing camera evidence.
- Diagnostic capture/export errors are isolated and counted; they do not make failed correspondence pass or stop observation.

## Verification scope

The synthetic local suite covers existing prechecks, finite and nonfinite residual rejection, search-boundary rejection, a real backward exact-tie rejection, selection after an earlier tiny-patch failure, all 32 tracks, mixed accepted/rejected tracks, exact pair replay, detached exports, reseeding/eviction/reset, temporal-gap separation, and an injected optional pixel-copy failure. The existing camera, first-gap-timing and pipeline-timing suites remain passing.

A separate baseline differential check compared 240 synthetic correspondence cases and two 32-track replay sequences across three reseeds. After excluding new diagnostic fields/accounting, legacy outputs, all state callbacks, batch/history/classification-anchor state, camera export and reset state were exactly equal. With a deterministic performance clock, the existing clock calls and yield-boundary sequence were equal. This does not establish timing equivalence under real wall-clock load or correctness for all possible videos. A fresh actual browser observation is required to obtain previously unretained local pixels.
