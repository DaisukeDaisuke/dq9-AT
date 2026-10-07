# Reuse the same frozen mode1 CPU source destination

Production baseline: edbc3846e29ddab4500b0f7bfc535640da773bc9. Task: dd2e9009-018c-4d01-9195-caeaf83a4993.

This is a source-render preparation optimization. It does not establish enemy identity, body-region membership, live phase, AT consumption, or all-input automation.

## Current duplication and minimal change

The automatic mode1 CPU fallback already computes source opaque native RGB6665, depth24, polygon owner, facing, fog and polygon-ID planes before map translucency, MSE, presentation, and fog. The existing renderer can retain those planes and the guarded map/MSE fragment streams. Previously the automatic renderer did not request retention, while the native provider always reconstructed the same source image for a mode1Scene branch.

Three production files change:

- automatic-background-renderer.mjs requests native destination retention during its existing CPU fallback. GPU success is unchanged and produces no substituted CPU destination. Retention failure remains optional and does not change the original image or renderer failure.
- native-body-destination-handoff.mjs extends the existing one-frame CPU mailbox to the explicitly bound mode1/MSE source subset. Its existing lightweight references and native-only early snapshot transport remain in place.
- monster-native-background-destination.mjs tries an available validated envelope before mode1 reconstruction. An absent, expired, malformed, mutated or mismatched envelope uses the original reconstruction path. No preparation budget, ordering, pose/model selection, fitting objective, or threshold changes.

No framebuffer is inferred from final RGB. No source scene object, runtime snapshot, new persistent cache, cross-frame lookup or GPU-derived native state is admitted. The retained destination snapshot is the existing ROM-derived inventory/camera descriptor, not a captured running-game state.

## Validation retained

The producer must be a final successful CPU mode1 render with matching source-derived record/camera, source environment, effect plan and omitted/constructor phase. Native-only payloads are copied, hashed and bound to the exact frozen image, alignment, validity mask and frame/ROM identities.

Adoption still re-runs prepareBoundMode1NativeScene from the original ROM. Its source scene, ordinary material/fog state, ROM effect plan and phase checks are not cached or skipped. Adoption independently checks ordinary and MSE submission-order guards, native alpha controls, fog parameters, plane types/ranges, compact map/MSE stream bounds and payload integrity, then uses the unchanged exact-RGBA binding function. Reused destinations remain byte-identical to ordinary reconstruction, including unavailable/mismatch masks and unknown reasons.

Only existing omitted-effect and source-constructor conditional MSE hypotheses are admitted. Dynamic offsets, runtime enable/fade claims, changed source plans and current-state claims remain unsupported. Invalid reuse cannot convert them into a successful reconstruction.

## Fixed validation

Original ROM: 268435456 bytes, SHA256 3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7.

Fixed source observation: 125.846 seconds, full-frame SHA256 4dc55947c6618f773477b9b626d6c28b085980a700185e11444356da64ece817; gameplay SHA256 2bc4d341088e8199bcd580a400d00b60b19edcce5afd696d141765ac3f5c7094.

For both retained background branches, every original source image byte, known-mask byte and non-additive image diagnostic matches the old render. Every destination array and metadata field matches the old provider. Combined provider preparation changes from 27,250 steps to 4; repeated native raster steps change from 27,244 to 0. No attempts were counted as completed merely because preparation was omitted.

The actual production branch builder and asynchronous recognition job preserve an early native-only snapshot after a new frame expires the mailbox. Repeated native transport retains that owned snapshot. Appearance/export background data carries lightweight references, not native planes. Pending/resume, cancellation, disposal, stale frame, payload/caller mutation, native source guard changes and reconstruction fallback controls pass. A successful GPU path does not invoke CPU fallback. Existing mode2 handoff output and two-step adoption remain exact on a separate retained mode2 input.

The finite saved proposal replay keeps all 256 model/branch/region pairs: 252 original isolated fit/pose/extent records, four prior unsupported pairs, 234 matching scene compositions and 18 explicit scene failures. The invalid-source controls retain their isolated results and the same source error messages. Region292 remains unresolved, and its same-pose original-component gains remain negative. All camera-model identities remain unknown. This is not a new pose search or evidence of improved live recognition.

## Measured work and retention cost

Alternating three runs per branch were fixed in advance. All samples, initial measurements and failed harness invocations are retained. These are Node wall timings with immediate cooperative yields, not browser throughput or hard latency bounds.

| Branch | Old source render median | Retention-enabled source render median | Mailbox clone/hash | Old provider median | Reuse provider median |
| --- | ---: | ---: | ---: | ---: | ---: |
| omitted MSE | 910.8 ms | 927.1 ms | 9.3 ms | 1219.7 ms | 124.1 ms |
| constructor MSE | 1137.0 ms | 1139.3 ms | 8.0 ms | 1363.5 ms | 123.4 ms |

Summing the independently measured median components gives 4631.0 ms old versus 2331.2 ms new across both branches. This is not a single measured end-to-end interval. Early-snapshot cloning, worker serialization and browser scheduling elapsed are not measured in these columns. Producer native-plane packing/copy costs are included in the retention-enabled render. Mailbox cloning/hashing and native provider cloning/source validation/binding are included in their respective columns.

The two payloads contain 1,474,600 and 2,155,336 typed-array bytes, totaling 3,629,936 bytes. These counts exclude JS object metadata, original producer-image arrays and existing early-snapshot/worker/provider-owned copies; they are not peak heap measurements. The mailbox still expires at the next frozen frame. Already projected native requests own only their exact frame's copies for continuation. The existing combined map/MSE compact-stream bound of 16 MiB per destination remains unchanged.

## Integration and remaining limits

The source-only archive excludes ROM, pixels, masks, native planes, decoded plans, model resources and private replay inputs. Complete private comparisons remain separate. See SOURCE_MANIFEST.json, SOURCE_ONLY.patch, VALIDATION_SUMMARY.json and FAILURE_RETENTION.json.

No Git operation, full build, browser run, publication or deployment was performed here. Integration must preserve a single cache-version instance of the handoff mailbox across background producer, native request and native provider imports. Real browser candidate reach and cancellation behavior after integration remain to be measured. The genuine-body recognition problem is still open.
