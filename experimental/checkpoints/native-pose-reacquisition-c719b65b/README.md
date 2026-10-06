# Experimental prior-pose reacquisition checkpoint

**Do not promote this checkpoint to production on the present measurements.** Root explicitly chose to retain it as an isolated experiment: native score changes do not establish improved detection, body extent, species classification or physical-actor continuity.

Base: `34affb7d60715e03f466380c54311673678d82de`.
Task UUID: `c719b65b-23c5-4709-ab00-50fa639c8c0d`.

## Complete changed-source scope

This phase changes exactly five production paths, not six:

1. `web/monster-native-motion-proposals.mjs` (new)
2. `web/monster-native-auto-support.mjs`
3. `web/monster-native-work-identity.mjs`
4. `web/map-browser-preview/native-body-request.mjs`
5. `web/map-browser-preview/residual-recognition-job.mjs`

The checkpoint ZIP contains all five full source files, a unified patch, this README and the manifest. It excludes inputs, test fixtures, native pixel data, evidence snapshots, game assets, ROM, saves, RAM and credentials. No Git write, browser operation, deployment or publication was performed. The existing body-support collector and map-provenance module are dependencies already present in the named base; they are not changed here.

## Executable mechanism

The normal frozen recognition job now mines its already-retained earlier observations for independently bound, positive native owned-body pose hypotheses. It validates ROM, video source/epoch/segment, earlier PTS, map record, model/variant, owned pixels and original source-pose references. Same-map/model compatibility does not identify a physical actor.

A whitelist transports only prior clip, stored frame, yaw, source scale and compact provenance. Previous world roots are never transported. Current-frame native work identity includes those exact hints, so changing their source evidence invalidates continuation. Malformed optional hint arrays, records, references and poses become rejections instead of terminating the ordinary search.

The worker retains the current-frame appearance-reference pass first. It then tries compatible prior poses before continuing the unchanged generic stored-pose domain. Each temporal candidate is placed afresh from the **current residual, current camera and current ROM floor**. It does not force a monster to remain at an old location, infer animation progression from elapsed video time, select an actor, add a draw or manufacture a birth. Exact duplicate generic pose/scale/yaw evaluations are skipped only after that same hypothesis has already been evaluated in the temporal pass. Other stored poses/headings/scales and all region/model/background alternatives remain.

The old residual selection and all raw regions stay unchanged. This is pose-informed proposal ordering, not a new residual detector, optical-flow tracker or verified current-body reacquisition. A prior pose can be tried against a different actor or non-enemy region; unknown and different-actor alternatives remain necessary.

Prior-pose outcomes are also retained in `placementSupport.priorPose`, including negative/worse scores, separately from the overall best. A failed temporal placement does not terminate generic exploration.

## Budgets and gaps

Per-slice native budgets remain exactly 1500 ms and 128 proposal visits. Source work is cooperative, so 1500 ms is not a hard preemption guarantee. The comparison grants both versions the same total visit count. It does not increase budgets to produce improvements.

Pose storage is bounded to 32 unique map/model/variant/pose hypotheses and 64 provenance references per hint. Omitted counts remain explicit. There is no fitted temporal-gap threshold. Earlier poses are merely hypotheses for a new current placement, even after a long gap; survival, intervening movement, resets, occlusion and new actors remain unknown. No propagation of an old world root occurs.

## Exact c28 fixed-input measurements

Inputs: immutable `BROWSER_1NINN_AUTOPLAY_BODY_c28bcdf.json` plus its matching `BROWSER_1NINN_AUTOPLAY_COMPARISON_c28bcdf.json`. The comparison's exact native RGBA hash and full-frame hash were checked against BODY. Actual ROM and the existing `monster_geometry.wasm` were used.

The prior timeline contains two compatible positive z000c poses at 134.612 s: bind and stand frame 7. The current frame is 170.312 s. Both versions process the same 32 original regions, four model candidates and two current background branches.

At equal 2048 visits:

- Final release-source replay: 256/256 pairs rendered in both; 1708 native proposals in both; positive scores remain **17 -> 17**; 12 best scores improve, **two worsen**, 242 are unchanged.
- Another retained final-core run: 1708 versus 1707 native renders under identical visit and wall-time budgets; 12 scores improve, **three worsen**, 241 are unchanged. This run is preserved, not replaced by the later result.
- The third worse case in that run is residual 630 / background-row-3 / z000c, from -2,107,845 to -2,111,228. Cooperative wall-time boundaries can change how much native raster work fits in a visit budget. No timing-speedup claim is made from these short runs.
- Both runs retain the two worse residual 703 / z000c branches: -1,739,789 -> -1,762,319 and -1,786,410 -> -1,823,735.
- Example score improvement: residual 75 / background-row-2 / z000c, 348,297 -> 586,263. The stand-frame-7 pose is re-placed at current root [151471, -3760, -146580], not its old root. This score improvement does **not** establish that residual 75 is a metal slime, a recovered body or the same earlier actor.
- The final release replay actually evaluates 200 temporal renders across 64 model/region/branch jobs, so this is an exercised proposal producer rather than descriptive-only metadata.

No independently labeled body/species accuracy or missed-actor count was measured for this fixture. More positive supports, fewer misses and correct individual tracking have not been demonstrated.

## A/B and old failures

Both actual `BROWSER_PARTIAL_A_34affb7.json` and `BROWSER_PARTIAL_B_34affb7.json` describe current 76.579 s, at native slices 7 and 13. They retain 55 earlier classified observations. Three positive prior poses belong to map:23:1764, while current candidates belong to map:359:34904 with different models. The producer correctly returns **zero usable hints**, and the native request payload is exactly the baseline payload. No pixels from a later comparison were substituted for 76.579 s.

The fixed 5306.5 s legacy BODY/COMPARISON has zero prior classified observations. At equal 512 visits, all **105 native-best records are exactly identical**, 104 pairs are rendered, 412 native proposals are evaluated and positive scores remain 5. Residuals 17 and 31 stay separate. All five residual-51 negative outcomes remain exactly unchanged. This preserves an old failure; it does not repair it.

The existing 3300, later-3300, 5306.5 and 5330 fixed BODY snapshots also contain zero earlier classified observations. They cannot demonstrate temporal reacquisition without additional bound earlier evidence.

### Exact existing labeled-miss dependency

The existing 3300 s miss has immutable BODY/COMPARISON and independent spatial probes 99/120/131/141, plus previously captured 3299->3300 video evidence. These probes were explicitly not certified as one actor or as species ground truth. To test this producer on that same established miss, the missing input is earlier same-source/map native owned-body support with its bound earlier camera/background and source pose, obtained from that preceding sequence. Borrowing another source's pose, inventing a prior, relabeling probe unions as a body, or using a different frame's pixels would not fill the dependency.

## Verification and retained failures

- 21 producer, provenance, transport, job-wiring and malformed-input checks pass.
- Three exact-production-service lifecycle tests with controlled source dependencies pass: appearance-first ordering, fresh current root placement, worse temporal scores retained, generic-domain continuation, source invalidation, temporal-placement failure isolation and no-hint behavior.
- Four previous emitted-service regression checks pass with the no-hint path.
- All five changed source files pass syntax checks.
- Actual c28 and legacy ROM/pixel replay results are described above.
- An initial test setup used the map-render WASM where the geometry WASM was required and produced `monster_reset is not a function`. Both failed reports remain under `SETUP_FAILURE_*_WRONG_WASM.json`; they are not scientific measurements. The verified geometry WASM SHA256 is `790e0c696106196492c17b836069faf9624e57091c175ba11781eb756dfe6d7a`.
- A copied older frozen-work test was invoked without its required CLI arguments and did not run. It is not counted as a passed check. Its original higher-wall-budget workflow was not used to support this proposal.

Local evidence records (not in the source-only ZIP): `evidence/RELEASE_COMPARISON.json`, `REAL_COMPARISON.json`, `LEGACY_COMPARISON.json`, `LABELED_FAILURE_PARITY.json`, `FIXED_LABEL_PRIOR_DEPENDENCIES.json`, `POSE_HINT_TESTS.json`, `POSE_SERVICE_TESTS.json`, full baseline/patched native outcomes and all failed/earlier runs. Original fixed inputs are untouched.

## Reproduction

From the existing workspace root:

```sh
node connect-moving-tracks-c719b65b/reacquisition-34affb7/tests/pose-hints.test.mjs
node --experimental-vm-modules connect-moving-tracks-c719b65b/reacquisition-34affb7/tests/pose-service.test.mjs
node --experimental-vm-modules connect-moving-tracks-c719b65b/reacquisition-34affb7/tests/legacy-test-emitted-service.mjs
node connect-moving-tracks-c719b65b/reacquisition-34affb7/tests/measure-reacquisition.mjs <runtime-web-directory> <output-json> 2048
```

The full input/test workspace is required for these measurements. The source-only ZIP is a restorable experimental delta against the specified base, not a standalone game-data distribution. Runtime integration, reverse cache-query invalidation and publication have deliberately not been performed, under root's decision to preserve production ordering.
