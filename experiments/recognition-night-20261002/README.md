# Recognition repair checkpoint — 2026-10-02 14:30 UTC

Goal: practical enemy-body boxes for the AT navigator. This is an **unadopted experiment**, not a deployed detector or completion claim.

## Verified
- Reproduced delivered Work7 V2 H4 boxes exactly using the pinned model, ORT CPU 1.23.2 and original preprocessing. Original evidence and failed adoption verdict are retained unchanged.
- Candidate V3 re-encodes larger promising components and splits oversized chroma components using existing warm-component logic. It accepts compact refined support; this trades additional false positives for recovered enemies.
- Previously observed temporal T1190, displayed first two boxes at IoU 0.5: B0 TP17/22 FP42; V2 TP8/22 FP0; V3 TP16/22 FP8. These are development/regression results, not unseen validation.
- Fresh H5: timestamps registered before inference, source-only labels saved before predictions. One accidentally repeated H2 timestamp was marked known regression and excluded from fresh results. Four battle/menu frames were excluded. Seven fresh field frames contain only two enemies.
- Fresh H5 first two boxes, IoU 0.5: B0 TP1/2 FP13; V2 TP1/2 FP1; V3 TP1/2 FP2. V3 has no measured fresh recall gain and one extra false positive. **Do not adopt on these results.**
- Patch applies cleanly (`git apply --check`) to the delivered Work7 archive's `source/` directory.

## Resume
1. Restore the original Work7 archive via the current private worker inventory. Verify its ZIP SHA-256 `a237665609f1988508e520b8b6b7405a75d28667580f6be2727e0131f9a70b92` against the authoritative inventory before use; if different, stop and use the verified inventory value.
2. From its `source/` directory apply `recognition-v3-unadopted.patch`. The patch contains only source/configuration text, no ROM, video, frames, embeddings, or models.
3. Restore private input/evaluation evidence through the authorized input inventory. Preserve original V2 data and fixed labels. `evaluate-h5.mjs` reads sampling metadata, not labels; `score-h5.py` consumes the separate prediction/annotation JSON files.
4. Diagnose the newly exposed false-positive/missed-small-enemy cases before another candidate. H5 is now observed and must be called regression data in later tuning. Do not claim unchanged held-out validation after looking at it.

Full raw predictions/annotations are retained in the active private workspace, not this public source backup. The authoritative input inventory remains private. Scorer expects its two JSON inputs beside the script. Source comments describing H5 as unopened are the frozen pre-inference version, not the current evaluation status.

## Other active integration
- Public main `7e9619fba6222ba9c7596b72d35c257ff27c358c` contains the bounded AT log preview fix. CI succeeded; 50 existing Node checks passed. A real 31,623,295-byte session produces a 6,475-byte preview without altering saved full evidence. Browser post-deploy verification remains pending.
- Work8 entry27 + NPC6 are conditional verified units; boot lower bound remains0. Remaining controllerFlags discrepancy is not resolved, and full world reproduction is not claimed.
- Callstack runtime backup was verified against the private remote. Work9 remains on hold; Work7/8 timers disabled as requested.
