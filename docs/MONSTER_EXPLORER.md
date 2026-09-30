# Conditional monster movement explorer

Open `monster-explorer.html` from the published site. This separate experimental page executes the source-derived movement, terrain and lifetime kernels. It does not replay a recorded trajectory and is not a complete AT navigator.

## Inputs stay on your device

Select your own supported Japanese NDS image. Map graph, trigonometric tables and collision geometry are extracted in the browser. No ROM, save, video, memory dump or recorded actor is included in this page or uploaded by it.

## Declare the experiment

The first profile is a hypothetical single actor on map7402. Choose a graph edge, initial XYZ, actual heading, seed, speed and body dimensions. Select collision members and explicitly declare their order and zero transforms. Party presence/positions, other actors, anchors, controller state, clock and external AT advances are experimental inputs, not facts inferred from the ROM. The preset is not an automatic initializer for every monster species.

You may initialize the starting height from the selected terrain as an explicit setup operation. Later positions are calculated by the model. Settings changes require reinitialization; unsupported or unknown branches stop execution at the last resolved position and AT prefix.

## Controls and limits

AI-only, walking-ground and logical-cycle actions have different scopes. A supported logical cycle uses AI, outer lifetime, then walking-ground order. Deactivation ends the trajectory at its last live position rather than the cleared pool coordinates. Owned AT consumption is shown separately from user-declared external advances.

Unsupported alert/chase, collision, rotated/tiled terrain, dynamic anchors, scripts, other actor types and post-reset initialization must remain unresolved. A resolved conditional step does not prove full-world scheduling, all-map support or video-based AT identification.

## Build and checks

Run `bash scripts/build.sh` to build the existing kernels plus the separate movement WASM. Run `node scripts/test-monster-explorer.mjs` for source-only orchestration checks. An optional local ROM path may be supplied to that test for an additional local numerical smoke test; do not commit the ROM or generated private data.

The standalone movement build uses clang and wasm-ld, has no imported WASM functions, and reads game resources only at runtime. Native differential validation and independent arithmetic/guard tests cover specific guarded paths; this page retains those boundaries.
