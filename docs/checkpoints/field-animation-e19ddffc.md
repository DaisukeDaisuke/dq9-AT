# Explicit-state native field-animation helpers

Checkpoint only; not imported by production runtime. Base main e231a729286cb219ac0a5e50983f642f8ab05188 (runtime611fe57).

- monster-native-animation.mjs reads complete rate0 J0AC channels from source bytes and an explicit phaseFx. Source ROM ranges are guarded. Low12phase bits interpolate only when resource flag bit0 permits it; wrapper phase clamps to0..numFrames*4096−1. Sparse rates and model-fallback channels remain unsupported.
- Stored sampled pivot rotations require normalization of the third axis. The prior sampler omits it in some z007b appear samples, yielding 1-unit differences. Preserve old decoder/evaluation results and invalidate source decoder caches if this correction is integrated.
- monster-field-animation-state.mjs derives requested clip names/flags only from explicit source actor mode/transition/posture/registry inputs. It does not infer live state from a clip existing. The reached clock helper uses explicit clock/clip/actor rates and source one-wrap arithmetic with period(numFrames−1)*4096, after the caller establishes its pause/blend/first-tick gates.

Validation:17528 original-ARM rate0channel comparisons over11clips from3models,4784resourceflag variants,2784selector cases,576clock cases,144stopped native callbacks,22same-call nativeclock witnesses,22source/inputguard assertions. These are finite tests, not all-input coverage.

A formal saved state shows appear29→stand0 two-clip weighting before stand advances1192FX/update. This is not synchronized to the3300s video. Source field-state9 can request mode2/attack0a, but state9 is not established in that video.

Integration must combine returned channel nodes with model-node metadata and native scaling, bind clip/phaseFx explicitly, and retain unknown blend/visibility/callback state. Two-clip blending is separate ongoing work. No seconds×30 conversion, guessed live phase, broad automatic pose sweep or species/AT certification is enabled here.

Private input/state/channel/ROM/video assets are not included.
