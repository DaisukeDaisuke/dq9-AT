# ROM-only preview work in progress

## 2026-10-05 main integration
The source checkpoint 25279ae95c3298be12c713d78c460fd8bcbdf4e4 is integrated into main with the existing main daily reports preserved. Publication is authorized; the existing Pages workflow determines deployment success. This document does not claim a completed all-map renderer or browser verification.

The UI takes an NDS ROM, uses the existing map-name CSV, displays a large minimap, and turns clicks into geometric floor candidates and CPU Canvas2D rendering. It contains no JSON input textareas or user metadata parser. View heading and ambiguous floor choices are ordinary controls.

ROM-derived initial camera, field-player height, static placement, texture/palette binding, convention3 texture SRT, BBY pass cache, and initial ordinary mode1 environment are connected. Five sampled final-dungeon scenes produced CPU images without authored metadata JSON. X04M09 zero-light NORMAL was replayed in source command order. A recorded final-dungeon video was inspected; 3F/9F scene structures correspond qualitatively. Camera alignment, dynamic objects, animation, native fog/depth/raster parity and whole-map/general-state coverage remain unverified. Other environment modes and unsupported inputs remain explicit errors.

Browser interaction has not been run for this revision. Earlier browser access was blocked during the staged checkpoint; that historical condition is not a current request for publication approval. Before integration, all 56 preview JavaScript files passed syntax checking, 46 modules and 108 relative imports linked, and the existing CSV/WASM dependencies and MapRenderer initialization were checked. These checks do not replace browser interaction or full rendering verification.

This source expects ../data/map-id-names.csv and ../wasm/map_render.wasm. Game assets are read from the user's local ROM at runtime. No ROM, SAV, RAM, videos, extracted game assets or secrets are included. Preserve the accompanying source licences/notices. Private native-check and image evidence remain separately saved.
