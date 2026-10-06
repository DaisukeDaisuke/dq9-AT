# DQ9 AT Navigator — 2026-10-07

Previous record: [2026-10-06](DAILY_REPORT_20261006.md).

## 00:28 JST — Reuse only completed identical minimap searches

- The actual late-frame browser trace at1239.433 ran four registrations totaling1139.8ms. ROM inspection confirms that the F01/H03 references across maps20001/20043 have identical256×224 RGBA. These aliases still require separate map bindings, world coordinates and floor evaluation, but their image registration inputs repeat.
- A single request-local slot now reuses only a completed search with exact matching reference pixels/dimensions, frame pixels/dimensions, exclusions and original matcher/WASM implementation identity. Each result is an owned copy with per-map/descriptor metadata rebound, including initial fallback metadata. Explicit provenance says no new search was performed and retained timing belongs to the original computation. Unknown/unresolved results remain unknown/unresolved. Incomplete/budget-exhausted searches are never reused. Existing candidate task yields and independent matcher budgets remain intact.
- Fixed libyuv BT.709-limited decoding at original PTS1239433 matches the browser full-frame hash9428232f…689d5 and gameplay hash3adeca1c…b4a3f. On those exact pixels with actual ROM/WASM, mean Node time for four jobs is1201.9→303.5ms: one completed search and three reuse hits. All non-timing registration/map/world/floor outputs match, excluding the explicit new reuse provenance. This is not a new browser timing result.

## Exact local-tracking failure remains unresolved

- Fixed libyuv conversion plus the unchanged pixel-center sampler also reproduces browser gameplay hashes at1200.017 and1200.35; the available full-frame hash at1200.017 matches. The auxiliary canonical analysis conversion differs and was not substituted. No color parameters were fitted.
- On the exact sparse pair, target track-5-2 fails residual only: production best(-6,0),27.328571 versus maximum14; all350 samples are known, texture24.018154 passes minimum2. Exhaustive unchanged±16 search finds(-12,-1),27.162857 and still fails. All31 lost-track ROI/reasons and the sole remaining track reproduce.
- Streaming21 real intervening frames without interpolation retains the candidate through13 transitions to1200.233,216ms, then rejects1200.233→1200.250: unique forward optimum(-5,0),13.397143 and unique backward optimum(+4,0),12.711429 are not exact inverses. Exhaustive searches confirm no missed optimum or tie. The sprite remains visible while its shape changes; animation, sampling and included background contributions are not individually isolated. The tracker still does not retain the endpoint. No threshold, inverse tolerance, radius or production tracking gate was changed to fit this case.
- Source-only replay harnesses and private evidence are saved separately. ROM, video, decoded pixels and private restoration metadata are excluded from Git. Latest browser validation is pending; current AT and full automatic recognition remain unverified.
- Final integrated standard build passes69 direct Node commands. All five WASM files remain identical;24 changed-module import edges use a coherent revision. Final source matches the passing isolated build byte-for-byte; only this report was added. Deployed verification remains pending.
