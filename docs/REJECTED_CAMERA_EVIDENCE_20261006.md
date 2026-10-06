# Preserve rejected camera-registration evidence

Baseline: `09294ad39b80d28b23043e4fefed448b16a9b303`.

## Why this evidence is needed

The actual PTS 1200–1212.3 run retained 92 pixel frames and replayed 91 measured
steps, but ended with zero tracks and `camera-registration-unknown`. Only two
existing-tracker updates occurred. The rejected translation was immediately
discarded by resetting `camera` to null, and later empty-track steps overwrote
`lastFailures`. The original export therefore cannot establish which camera
registration gate failed or reproduce its exact failing frame pair.

This differs from older runs stopped by actual frame gaps. No existing gap is
reinterpreted as observed continuity. The newer run's maximum recorded callback
interval was 302.1 ms; its largest 513 ms browser long task occurred after the
recorded pause boundary. The 16,133.8 ms background measurement is elapsed time,
not synchronous CPU work. It does not establish the cause of either failure.

## Added evidence, unchanged decisions

- `EnemyProposalTracker` still sets `camera=null` on rejection and still resets
  exactly as before. `rejectedCameraAttempt` separately preserves the existing
  dx/dy, residual, texture, reliability flag, original limits, and failed gates.
  Nonfinite residuals are serialized as strings such as `"Infinity"`, with an
  explicit `residualFinite` flag, rather than becoming an ambiguous JSON null.
- `measuredVideoTracking.lossEvidence` retains the first loss, first rejected
  camera registration, and eight recent loss events. Each has exact source/frame
  keys, PTS, original sampled-RGBA hashes, lost tracks, and existing reasons.
  Later empty-track steps and reseeds do not overwrite the first failure.
- Source reset clears this evidence. These records never feed registration,
  classification, reseeding, identity, event, or AT decisions.

## One bounded private reproduction pair

At the first camera rejection, replay owns one previous/current gray+blocked
pair: 2 × (49,152 + 49,152) = 196,608 pixel bytes. No further pair is retained.
The bounded previous-track and current-proposal ROI lists reconstruct the exact
registration masks using `patchTrackingFrame`.

Normal replay snapshots and live display contain no pixel arrays. Only the
existing explicit comparison download includes `measuredTrackingFailurePixels`.
Its frame hashes identify the original sampled RGBA; the gray/blocked arrays are
the deterministic `trackingGray` derivation, not claimed independent RGBA hashes.
The pair is never sent automatically or included as a source asset.

The existing replay-frame `pixelBytes` and storage budgets stay unchanged.
`diagnosticPixelBytes` reports this separate allowance, and
`totalRetainedPixelBytes` reports their sum. Metadata declares the one-pair and
196,608-byte limits. Source reset releases the pair, and exported data owns its
metadata/arrays so consumers cannot mutate the retained evidence.

## Verification scope

Eight synthetic regressions cover legacy null-camera rejection, exact failed
gates, nonfinite JSON preservation, persistence across empty-track steps,
bounded history/reseeding, source reset, reproduction from the exported pair,
unchanged frame-gap rejection, and explicit-download-only pixel export.

No threshold, score, accepted gap, correspondence algorithm, camera assumption,
or scheduling decision changes. This supplies the next actual failed-gate
measurement; it does not repair or certify tracking continuity.
