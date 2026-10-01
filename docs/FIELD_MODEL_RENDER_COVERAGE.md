# Field-model CPU render coverage

The bounded private-ROM audit now renders all 256 exact `enc.json` model groups (260 monster IDs), using explicitly selected `_f` assets. No model, species alias, missing animation, or unsupported feature is silently omitted.

## What changed

- Reuse the existing Nitro texture decoders for indexed formats 1, 2, 3, 4 and 6. Check the texture block and every referenced palette index. A 256-color format does not require 256 populated colors when fewer indices are used
- Read TEX0 palette size as a 16-bit length; the adjacent flags are not part of its length. Correct the 256-color palette slice size
- Preserve Nitro dictionary names byte-for-byte instead of decoding them as UTF-8. Respect padded texture dimensions while retaining original material dimensions
- Apply the field assets' XSI translation-only texture matrices. Other SRT modes and generated normal/vertex coordinates still fail explicitly
- Preserve camera-dependent SBC BB/BBY transformations, stack operations and descendants as bounded render-state expressions; evaluate them for each template view
- Preserve polygon boundary masks through WASM triangulation so alpha-zero wireframe materials do not acquire quad diagonals. CPU previews render wireframe boundaries and source-over texture/material alpha
- Invalidate persistent rendered-feature banks through a new renderer dependency revision

The extended CPU path has no DINO dependency. The existing WebGPU preview now explicitly rejects extended billboard, translucent and wireframe material models until those GPU changes are separately validated. Existing supported opaque GPU models retain their current path.

## Evidence

The actual private-ROM CPU audit checks 24 views per bind pose: eight yaws at pitches 15°, 45° and 75°. All 6,144 views contain visible pixels; none touch the tile border. All 5,232 views from the 218 previously supported model groups are byte-identical to the previous renderer.

The separate `stand.nsbca` midpoint check renders 223/256 groups. The remaining 33 are reported individually: 19 model/animation object-count incompatibilities, 12 unsupported incomplete/sparse-rate curves and two missing stand clips. Animation decoding is unchanged. Bind-pose coverage must not be described as complete animation coverage.

The source-only synthetic regression suite has 715 checks, including malformed bounds/bindings, byte names, five texture formats, translation, BB/BBY, wireframe quad boundaries, fractional alpha and explicit GPU guards. The existing recognition, animation, explorer and page tests also pass. This is focused verification, not an aggregate-build or native-game visual-equivalence claim.

## Reproduce

Build only monster geometry:

```sh
bash scripts/build-monster.sh
node scripts/test-monster-render-coverage.mjs
```

Run the private audit with the exact target JSON (`models` maps each model ID to every associated species ID):

```sh
node scripts/audit-monster-field-rendering.mjs private.nds target.json private-output [baseline-web-directory]
```

The optional baseline argument independently renders the previously supported assets and compares every RGBA byte. The audit writes private raw images only in the explicit output directory; do not publish these with the source code.

## Scope and remaining limits

These are static unlit previews for dataset preparation. Lighting, native fixed-point rasterization, exact translucency sorting and one-pixel wireframe coverage are not claimed to match game hardware. Twenty-four sampled directions are not every continuous angle. The selected `_f` variant's field role remains explicitly unverified. Unsupported compressed textures, texture SRT modes, billboard skinning and GPU matrix restores inside a billboard shape still fail closed.

No aggregate build, publication, model training, inference accuracy, browser WebGPU pixel check or user-GPU performance measurement is claimed here.

## References

- Existing 0BSD apicula integration, revision `3d4e91e14045392a49c89e86dab8cb936225588c`: `src/nitro/model.rs`, `src/nitro/render_cmds.rs`, and `src/nds/decode_texture.rs`
- Nitro SBC BB/BBY semantics: [source reference](https://github.com/ntrtwl/NitroSystem/blob/d636fb5d2b212e8736f09859fff447be2bd0ac85/libraries/g3d/src/sbc.c)
- XSI texture translation semantics: [source reference](https://github.com/ntrtwl/NitroSystem/blob/d636fb5d2b212e8736f09859fff447be2bd0ac85/libraries/g3d/src/cgtool/xsi.c)

The 38 original failures were failures of this browser pipeline, not evidence that the standalone apicula application fails to load those models. The archive/extraction layer was unchanged.
