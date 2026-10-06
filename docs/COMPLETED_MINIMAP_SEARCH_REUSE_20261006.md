# Reuse exact completed minimap searches within one frozen-frame probe

## Evidence and dependencies

The c 2ae main-entry browser export records four synchronous minimap registrations at PTS 1239.433, totaling 1139.8 ms inside a 1204 ms task. The later b 639 descriptor-yield change is preserved; its browser validation remains pending. This work uses approved offline source/ROM/video inspection only.

The supplied ROM composes F01.bmmp and H03.bmmp for map IDs 20001 and 20043 to identical 256×224 RGBA, SHA256 2b6ee222ec911baa0476169704af6cc0fa87d409dd5e7666d87a68f37dd7a0ba. `MapPositionMatcher` uses reference RGBA-derived luminance/alpha and dimensions, frame luminance, exclusions and fixed search options. Its map ID and descriptor fields only label the returned evidence. The WASM map_registration function consumes provided reference/alpha/frame/mask arrays, dimensions and search bounds, with no map ID or external mutable scoring state.

Exact offline reproduction at PTS 1239.433 uses the system libyuv I420ToARGBMatrix with kYuvH709Constants, BGRA→RGBA channel order and the existing gameplay sampler. Both full-frame and gameplay hashes match the browser export exactly: full 9428232f2fc254041f453e30ec77726cdd3a789c19e81bcaeb1d3e4951a689d5; gameplay 3adeca1c91ccb2e7d51f596ff3be1a8d6624cf7d7ec0aa53ab33d482cc5b4a3f. Decoder showinfo confirms PTS 1239433 in the original millisecond time base. No fitted conversion is used; raw pixels remain private.

On those exact pixels, actual ROM maps/floors/WASM and the existing b639 upper-preparation-reuse path, eight four-descriptor Node runs have exact non-timing output parity. After the first pair of runs, mean total time is 1201.9 ms baseline and 303.5 ms with completed-registration reuse (one search, three reuse hits). Unresolved outcomes remain unresolved. This is an offline source microbenchmark, not a measurement of new browser capture continuity. Earlier approximate FFmpeg-RGBA experiments are separately labeled in private evidence and are superseded for the exact-pixel parity claim.

## Scope

An existing private same-frame upper-preparation token now holds one completed registration reuse slot. It has the token's same source object, source ID/epoch/segment/serial/PTS/full-hash binding and per-probe lifetime. Standalone calls without a valid token use the old path. Existing task yields between descriptors stay in place.

Reuse additionally requires the original MapPositionMatcher class methods, same matcher/exports/memory/heap base/scoring function, exact reference dimensions and RGBA bytes, exact frame dimensions and RGBA bytes, and exactly equal ordered exclusion rectangles. No hash-only equivalence is accepted. The per-call wrapper's fixed coarse/dense options and 1500 ms deadline are unchanged. Only a result with budgetExhausted=false and planComplete=true, including any initial fallback result, is retained. Incomplete/time-budget/translation-budget outcomes always run the ordinary search. `translationDomainComplete:false` remains unchanged: completing the current bounded plan is not proof of all possible translations.

The slot retains owned input copies and one owned result, bounded to reference RGBA≤8 MiB, frame RGBA≤49,152 bytes, and 256 finite exclusion boxes; larger input keys use the ordinary path. A new miss replaces the previous slot. Nothing is retained across probes, sources or frames. The fixed-source contract still excludes generic callers mutating source RGBA without updating its stamp.

Every reuse hit receives a fresh owned result. Only mapId and descriptor labels are rebound, including nested fallback.initialRegistration. Registration outputs, unresolved states, candidates, scores, margins, limits and completeness flags remain unchanged. Map binding, coordinate/floor queries, aliases and all candidate alternatives are recomputed independently. A `sameFrameCompletedSearchReuse` field identifies the original search's map/descriptor and states that its measured timing fields describe the original computation; no new search is claimed. Matcher.setReference still runs for every descriptor, preserving current reference state.

## Verification

Focused tests use the real WASM registration implementation to check resolved coarse and unresolved dense reuse, nested metadata, owned result/input copies, mutation/invalidation, budget-exhausted retry, fresh request lifetime and generic/custom matcher fallback. Existing upper-preparation, task-yield, minimap, lifecycle and tracking tests are rerun. Exact output comparison excludes only elapsedMilliseconds, remainingMillisecondsAtDenseStart, and the explicit reuse evidence. Publication and actual browser validation are separate pending steps.
