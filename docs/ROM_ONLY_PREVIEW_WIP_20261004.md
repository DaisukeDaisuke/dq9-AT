# ROM-only preview work in progress — 2026-10-04 04:26 UTC

This branch is a source checkpoint, not a deployed or accepted all-map renderer. The published main page has not been replaced by this checkpoint.

The staged UI takes an NDS ROM, uses the existing map-name CSV, displays a large minimap, and turns clicks into geometric floor candidates and CPU Canvas2D rendering. It contains no JSON input textareas or user metadata parser. View heading and ambiguous floor choices are ordinary controls.

ROM-derived initial camera, field-player height, static placement, texture/palette binding, convention3 texture SRT, BBY pass cache, and initial ordinary mode1 environment are connected. Five sampled final-dungeon scenes produced CPU images without authored metadata JSON. X04M09 zero-light NORMAL was replayed in source command order. A recorded final-dungeon video was inspected; 3F/9F scene structures correspond qualitatively. Camera alignment, dynamic objects, animation, native fog/depth/raster parity and whole-map/general-state coverage remain unverified. Other environment modes and unsupported inputs remain explicit errors.

Browser interaction has not been run for this revision: the cloud-browser documentation-read call was rejected by permission review, and the specific permission request is pending. Source syntax/import closure, numerical source-over behavior, ROM resource binding and selected CPU render checks have been run; these do not replace browser verification.

This source snapshot expects the existing main site's ../data/map-id-names.csv and ../wasm/map_render.wasm. Game assets are read from the user's local ROM at runtime. No ROM, SAV, RAM, videos, extracted game assets or secrets are included. Preserve the accompanying source licences/notices.

The current source-only native-check and image results remain in the private work checkpoint. The last accepted main version remains separate; this branch is not a claim of a deployed fix.
