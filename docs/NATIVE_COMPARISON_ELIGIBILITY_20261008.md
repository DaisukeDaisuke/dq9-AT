# Complete comparisons and eligible winning bodies

Baseline: 2c7ad1d3ff9c0b19b4cd096be338bb861b1ecdcd.
Task: b07c9a3c-7214-47f0-b660-34d048999f01.

## Contract

A completely known tested rendering can be ranked even when its body-color
support is empty or spatially degenerate. This does not make it an eligible
winning monster. The comparison first retains **every** required model/camera
alternative, verifies that their full compared images and scores belong to one
frozen objective, and orders their unchanged gains. Only the unique positive
leader is then checked for the existing nonempty/nondegenerate body support,
encounter source, original component, appearance consistency and UI competition.

An unknown/incomplete rival blocks preference. A tied leader blocks preference.
A leader with inadequate body support blocks preference; the next-best eligible
body is never substituted. If all known tested gains are nonpositive, the tested
background is preferred, without certifying absence or excluding other poses.

There is no known-null special case, zero-score shortcut or lineage-emptiness
shortcut. A candidate with empty RGB-operand lineage can still change actual
pixels through depth, IDs, MSE or fog. Its real score is preserved, including a
positive score that makes it the leader and therefore blocks body adoption.

## Why gains remain comparable

For the same frozen video V, background B and validity K, the unchanged scorer
uses P = B * (1 - alpha) + renderedRGB * alpha. Outside the rendered footprint,
alpha is zero, so P equals B. Therefore the full fixed-domain improvement

    sum over K of ((V - B)^2 - (V - P)^2)

is exactly the footprint-only gain already computed by the existing scorer.
Different footprint sizes do not create different gain objectives. Every
rendered pixel must be known; unavailable pixels are not omitted to obtain a
favorable partial score. Equal SSE alone says nothing about equal predictions.
Nondegenerate body support is an adoption criterion, not a mathematical
prerequisite for ranking a fully known image in this objective.

## Added bindings only

`monster-native-comparison-support.mjs` carries an internal producer/consumer
contract for successful original-source native renders. It does not change
rendered pixels, source parameters, the score formula, proposal order, retained
best proposals, or source rejection gates.

- The existing destination binder privately retains the exact frozen background
  and validity bytes it received after reconstruction/binding. The lineage
  producer remembers the exact destination binding object and source camera.
  Same-frame labels cannot lend another background to a composed candidate.
- `rasterNativeBody` registers its completed source result and originating program.
  Mixed compositions reuse the verified lineage producer's byte witness. Isolated
  source output uses a private pixel/coverage witness. Imported or changed output
  cannot issue new comparison evidence merely by copying metadata.
- Once per retained comparison tuple, private video/background/validity copies
  are freshly SHA-256 checked against the existing pixel comparison binding.
  Reuse is by that binding, exact input references, frame, camera and alignment.
  The private copies remain the original frozen tuple if caller buffers change.
- For each complete tested raster, the original RGB objective is independently
  replayed against those private copies. Every footprint pixel must be known;
  every score and pixel count must exactly equal the unchanged recorded fit.
- A compact `complete-source-native-comparison-v1` summary links frame, camera,
  alignment, model, proposal, source subset, pixel hashes, counts and score.
  Composed results additionally require byte-exact agreement with the privately
  retained source destination background/validity. Caching that equality uses
  private immutable witness objects, not mutable public metadata.
- The consumer checks the retained branch's background hash and requires matching
  video/background/validity hashes across all current proven rivals. A malformed
  or unavailable new comparison summary cannot fall back to an old body flag.

Legacy records with no new summary keep their prior stricter contract. A mixture
of new comparison evidence and legacy-only rivals is not silently declared one
verified objective. Current production renders receive the new summary, including
an explicit unavailable result if metadata verification fails. Optional proof
failure retains original scores and failures while keeping preference deferred.

Private registrations are internal integrity checks, not cryptographic authority
against arbitrary JavaScript executing inside the same process. Original ROM,
source-program and frozen-request authorization/binding remain the existing
runner's responsibility. No snapshots or source assets are exported in summaries.

The compact candidate view now distinguishes comparison readiness from winning
body-support readiness, while linking to the existing detailed source evidence.
All global unknown/player/background alternatives, incomplete pose/domain flags,
legacy predictions, identity=false and minimum proven AT=0 remain.

## Evidence and limits

The independent native synthetic suite covers inferior degenerate and empty
rivals; positive degenerate leaders; ties; zero gain with different pixels;
empty-lineage indirect fog effects at negative and positive gains; and all-known
negative scores. It also checks changed scores, source pixels/programs, frame,
camera, background and validity binding, mixed comparison domains, unknown
rivals, appearance/component checks and unresolved UI. These are contract tests,
not recognition accuracy tests.

A frozen two-case replay retains all158 original proposal events, score
and extent fields, first-sweep/final native source records and legacy predictions.
Only new comparison metadata and the resulting bounded conditional comparison
change. All158 source comparisons verify. One frozen case now yields its tested
conditional z064a alternative; the other still fails appearance consistency.
Neither result establishes observed identity, broader accuracy, live state,
whole-native-frame equivalence, all-input coverage or completed automation.

The bounded performance measurement uses12 native draws with24 existing isolated
and scene evaluations, three warmup batches and12 alternating rounds per variant.
All original renderer bytes/fields and fit/extent outputs are directly identical
for these12 draws. Native raster, fit, original-component attribution and extent are included; the
new variant also verifies the full comparison. Median batch time was393.01ms
versus427.64ms (1.088x). Source preparation and once-per-branch comparison-context
preparation are excluded. These noisy timings are not a universal overhead bound.

Additional private storage is432KiB per frozen comparison branch,240KiB per
source destination, and240KiB per live isolated raster witness. Weak ownership
bounds these witnesses to the existing branch/destination/raster lifetimes.

The new test is included in `scripts/build.sh`. Combined publication, browser
qualification and any wider accuracy evaluation remain separate responsibilities.
