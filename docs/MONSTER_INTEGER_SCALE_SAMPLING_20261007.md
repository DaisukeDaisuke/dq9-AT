# Bounded integer-frame scale support

The NSBCA reader additionally accepts scale curves with start 0, rate 1,
width 2 (signed FX16 pairs), an even frame count, and end equal to
numFrames - 2. Admission is structural; there is no model or animation-name
special case. Translation and rotation still require the previous complete
rate0 layout. Other sparse scale layouts remain explicitly unsupported.

Each scale and inverse-scale member is independently expanded to one exact
source integer value per frame. The inverse member is preserved rather than
recomputed as a reciprocal. The final odd frame uses its separately stored
pair. Accepted expanded resources receive
integerFrameExpansion = source-rate1-fx16-scale-pairs-v1.
Complete rate0 resources retain their prior object shape and values.

The legacy readNativeRate0Animation entry point returns a distinct
source-native-integer-scale-animation-v1 kind for expanded resources.
The sampler accepts only integer phaseFx values in
0 <= phaseFx < numFrames * 4096 with phaseFx divisible by 4096.
It rejects fractions and out-of-range inputs before clamping or interpolation.
This restriction also applies when the resource's fractional flag is off.
Existing rate0 clamping, flags and fractional behavior are unchanged.
The native phase-domain preparer retains one explicit unsupported result
instead of enumerating fractions for an integer-only resource.
Explicit integer joint-plan calls remain available.

The affected z019b_f attack0a resource has 28 frames. Original ARM execution
matches all 168 scale/inverse values and 3,612 active channel values across
336 joint evaluations, stopping before the model-scale callback. Separately,
25 previously supported resources remain deep-equal across 374 integer
frames and 1,122 fractional phases. These are local source comparisons,
not live actor-state, gameplay phase, native GPU or video recognition evidence.

Portable test: node scripts/test-monster-sparse-scale.mjs.
Optional actual-ROM integration tests: test-native-explicit-phase.mjs and
test-native-phase-runner.mjs, each with the local ROM path argument.
The original-ARM harness and source-function annotation are maintained
separately from this application repository.

Old animation/template caches must not be reused across the coordinated
module revision. Full integration, build and deployment are separate steps.
