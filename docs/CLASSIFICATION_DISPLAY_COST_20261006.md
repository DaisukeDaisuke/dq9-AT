# Classification display work, 2026-10-06

This change removes repeated construction of hidden classification diagnostics.
It does not change recognition, scores, accepted frame gaps, capture timestamps,
tracking continuity, stored observations, or export content.

## Measured source-relevant work

The production display functions were invoked in Node with two actual private
browser observation exports, using a counting DOM fixture. These are JavaScript
timings and node counts, not browser layout/accessibility timings.

| Actual input | Retained sightings/rankings | Old completed display nodes | New initially closed display nodes |
| --- | --- | --- | --- |
| 49,773,984-byte observation export | 32 / 320 | 6,191 | 18 |
| 26,469,440-byte observation export | 19 / 190 | 3,685 | 19 |

The old closed display additionally serialized 2,922,176 and 1,737,711 JSON
characters, respectively, on each refresh. The new closed JSON display performs
zero projections and serializations. In the first input, its normal uncompleted
summary construction previously created 6,188 nodes and 971,959 characters even
while its details were closed. The new path creates 15 nodes and 307 characters.

All recursively expanded text matched the old production display exactly for
both inputs, including the completed-frame display. The full observation JSON
SHA-256 remained identical before and after rendering, opening all nested
details, and preparing the lazy display. The export handler still serializes
the owned observation object directly; it never exports the display projection.

## Implementation

- Build each nested ranking/native-support level on first opening only.
- Reuse the same mounted summary for the same value and completed-frame identity.
  The cache is weakly keyed by that mounted root, so clearing it does not retain
  a cancelled classification through the long-lived host.
- Project and serialize JSON only while its details are open. Coalesce pending
  updates into one task using the newest value. Closing clears the text; reopening
  projects the latest value.
- Clear/dispose invalidate pending work. Remounting the same JSON host disposes
  its prior controller and removes its listener.

Nine synthetic regressions cover these lifecycle cases, unchanged export data,
and exact on-demand display projections. They run from the standard build.

## Limits

Opening all diagnostics still creates all requested content. An open JSON view
still serializes the latest projection, once per coalesced display update. This
is not a general-purpose virtualized UI or a browser stall diagnosis.

The actual exports also take nontrivial time to ownership-clone: one Node sample
of the larger input took 64 ms for its sightings and 194 ms for the full bundle.
Those ownership/storage operations are unchanged. The earlier observed replay
gap remains an actual missing-observation boundary and must still invalidate
correspondence. This patch does not prove continuous tracking or full automation.

No private ROM, pixels, videos, or observation exports are included in this patch.
