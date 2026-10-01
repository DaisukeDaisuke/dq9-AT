# Approximate player map coordinates

The existing local ROM and video pipeline keeps one frozen capture identity through screen detection, ROM-font text hypotheses, nominated map images, marker components, registration and coordinate alternatives. It does not infer held keys, facing, elapsed game updates, or AT consumption.

## One visible party panel

Automatic screen detection can corroborate a map using the first party panel when the other three slots are empty. The panel must have a dark interior, bright text and both light borders. Parchment, map-title evidence, rectangle boundaries, score and ambiguity gates still apply. A visible map beside a menu may have a valid layout; that is not permission to classify the scene as moving field gameplay.

## Scrolling and bounded registration

Every point is transformed using that frame's registration offset and actual rounded reference resize dimensions. Raw screen-centroid differences are not world displacement. All text-nominated references receive their existing coarse passes before any unresolved reference receives a denser integer-translation pass. Dense work shares the original deadline, checks it between rows, and stops after at most 65,536 translations. Interrupted or capped work remains unknown. Similarity thresholds are unchanged and are not calibrated probabilities.

The registration search covers its supplied image, scale and overlap domain only. Other scale, layout, map, marker-identity and unsearched text hypotheses remain possible. There is no global map search or map-ID oracle.

## Chunk and local fields

The format is a signed 32-bit fixed-point word divided by 4096, not IEEE float16:

```
raw = signedChunk * 65536 + unsignedLocal16
world = signedChunk * 16 + unsignedLocal16 / 4096
```

A negative raw word uses floor-based chunks. An interval from raw −1 through +1 retains chunk −1/local 65535 and chunk 0/local 0…1 separately. Display caps retain the complete signed chunk range and omitted count; they do not exclude omitted chunks.

Each nominated descriptor supplies its own image origin and scale. Shrine and other maps can have different scales. The vertical map axis is game Z; actual height Y is separate and remains unobserved. A floor label does not determine metric height.

The UI shows outward-rounded approximate X/Z ranges and separate per-chunk unsigned-local16 ranges. These are heuristic component/registration error envelopes with uncalibrated coverage, not certified world bounds or recovered memory values. Alternative maps, peaks, identities and positions outside those envelopes remain possible. They must not automatically prune AT states.

## Validation boundary

The solo failure and three coarse-registration misses were found on one ten-frame development interval. The staged correction reuses those pixels; it is not a fresh held-out accuracy result. Existing four-party and layout-negative fixtures, synthetic guard tests, encoding boundary tests and capture identity regressions remain separate evidence. No ROM, video, decoded frame, native-memory packet or private coordinate output is bundled with these sources.
