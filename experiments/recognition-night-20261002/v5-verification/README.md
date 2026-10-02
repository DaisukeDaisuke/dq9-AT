# V5 source and browser verification — 2026-10-02 15:25 UTC

V5 is an isolated, unadopted candidate. The ordinary recognition page is unchanged. The isolated page is `web/experiments/recognition-v5/monster-recognize.html`, added in dec48115452c90afb676dc8f36666f956561c991; count/verification-label correction is4b60cafe14597a8bfe149735e5c0279131564d11. Both CI runs succeeded. All changed source files were read back from the remote and matched.

- Actual ROM reference generation:64/64 rendered inputs and CLS vectors match the fixed original bank exactly.
- Actual source-integrated detector:12/12 H5 box lists match the previously computed CLS-filtered output. H5 is now known regression, not fresh validation.
- Actual cloud Chrome, explicitly CPU/WASM int8: H5-03 player false box removed; H5-04 visible enemy retained [626,15,139,229]. The browser box differs by about1nativepixel from offline output; no exact-coordinate equivalence claim.
- Formerly missed1ninn570s: recovered partial body [791,266,98,113]. Weapon/extremities remain outside the box; not a full-body fix. The430s enemy is still missed.
- Individual detector samples report2029.1,2340.1,2317.8,2711.7ms. These are not general latency or real-time performance guarantees; cold asset/reference preparation is separate.
- Real video start542.197530→pause578.378719. Held observation574.279/#121,0boxes; video paused and no app error. Held pixels/boxes/time remain associated with their own observation. This is lifecycle verification, not clip-level precision/recall.
- The extra classifier initially made inherited kept-count/wording misleading. The correction was deployed and browser-verified:1candidate checked→0kept/1inconclusive, with no species/absence/AT-certification claim.
- Position-log download waiting timed out after15seconds; saved-file completion remains unverified. No repeated retry loop or assertion that the app itself failed.

Private checkpoint retains original failed variants, labels, predictions, two browser screenshots and the derived bank. Its current packaging-corrected version includes both V5 prototype modules required by these scripts; fixed results did not change. Restore through the private additional-input inventory and run scripts from the original Work7 `source/work7` layout; adjust only the local root path after restore. Raw private artifacts are not in this repository.

Next: keep the remaining misses/partial bodies explicit. Do not fit further thresholds to these frames or declare AT navigation complete. Resume bounded AT reproduction from saved worker source evidence; Work9 remains on hold and external workers stay closed.
