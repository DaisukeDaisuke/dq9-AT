# Original residual support attribution


## Semantics and implementation

The ROI-rescaled thumbnail optimizer still chooses exactly the same full-fit maximum and appearance/body ranking. The original residual component now receives explicit within-component and outside-component SSE, gain, known-pixel and body-pixel accounting. A conditional species binding additionally requires positive gain on that exact original component. Negative, zero, missing, malformed or stale own-component support leaves the original proposed model/species as an explicit unbound alternative.

Production `compareMapBackground` retains the exact binary residual mask and 4-connected component IDs. `originalResidualProposalSupport` uses that same frozen comparison; it verifies the requested component ID, original ROI and pixel count, binary known-pixel mask, full-frame SHA identity, and pointwise residual-mask consistency with actual frozen native video/background RGB and the unchanged original residual split. It reconstructs the component using the original scan order and 4-connectivity. No rectangular-box substitute or generated threshold is used.

The worker fit validates the support identity/mask. The prediction call separately receives the expected current full-frame SHA and component ID, so internally consistent support from another frame/component cannot bind. Map/encounter compatibility is retained for a deferred proposal, including its species and table alternatives, but cannot restore the withheld species binding.

No template-selection change, pose expansion, min-size cutoff, fitted score threshold, absence claim, forced entity split, AT increment or inferred ownership was added. Separate residual components may still be parts of one body. Every original full fit, model ranking, model alias, unknown alternative and source/native failure remains available.

## Actual fixed inputs

Original ROM thumbnails and current source reproduce all 400 saved candidate body fits, including every old fit field (after removing only the newly added attribution and saved pose metadata used to render it).

- PTS 1215.467: 32 regions, 320 unchanged fits, 8 prior conditional bindings become 7. Only region92 z060a is unbound. Full gain remains +178,701; exact original-component gain is −9,299; outside-component gain is +188,000. Original map compatibility and table alternatives remain available.
- PTS 1215.817: 8 regions, 80 unchanged fits, both previous z061c bindings remain conditional. Region22 own gain +5,594,474. The 4×4 region16 own gain +25,550 remains conditional. This is explicitly not a blanket small-fragment rejection.

The remaining background-looking candidates still have positive own-component gain. This patch addresses the demonstrated attribution violation and does not claim correct recognition, complete source pose/ownership coverage, or all-input automation.

Actual replay summaries: diagnostics/ACTUAL_1215_ATTRIBUTION.json and diagnostics/ACTUAL_MOVING_ATTRIBUTION.json. Reproduction script: diagnostics/replay-proposal-attribution.mjs, supplied original private ROM and saved BODY/COMPARISON paths. Saved input files are read only. Existing unsupported animation clips remain unsupported; no fallback animation was invented.

## Tests

Focused regression covers actual component-mask construction, frame-hash and pixel binding, mismatched component/ROI/count/mask/validity, missing support, negative and zero own gain, unchanged full fit, no replacement by a lower full-fit rival, tie/degenerate/background-only guards, preservation of unbound alternatives, and map compatibility not reviving a deferred binding.

Standard build exited 0. All five WASMs are byte-identical to baseline. After the final map-evidence preservation addition, all 56 standard Node commands were rerun and exited 0. The final two actual-ROM replays also passed. No browser/publication action was performed.

