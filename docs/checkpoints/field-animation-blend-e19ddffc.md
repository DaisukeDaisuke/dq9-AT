# Field animation blend checkpoint — 2026-10-06 07:28 JST

Source-only continuation of d55e4d833c75e3f95563a80ddab78e4778c0cd16. No production import or deployment.

The explicit one/two-clip helper implements source joint blending, shared scaling context, per-term fixed-point truncation, normalization and cross products. Inputs remain explicit source clips, phases, weights, node metadata, SBC and ordinary callback admission.

Measured: all 12 native final joint outputs and 24 intermediate callbacks matched. Original-ARM verification passed 297 scenarios, 3,996 node calls and 14,463 active-channel/flag checks. Parent independently reran 23 source/input guards successfully.

Unverified: live 3300s animation/phase/blend/visibility, complete raster or video parity, all models and complete automation. Rule 1, remapped/custom callbacks and degenerate scratch-dependent rotation remain unsupported. No phase sweep or score threshold change.

Integration: returned poses are post-scaling/post-blending. Feed directly to emitNativeNodeMatrixCommands at corresponding NODEDESC; never apply node scaling again. Preserve existing single-clip behavior and bind cache identity to all explicit terms and decoder revisions.

Only authored helper source and this status are committed. ROM, game resources, captures and raw channel vectors are excluded.
