# Current-image map tracking

The video panel acquires map-image candidates from the ROM font Akinator and the nominated map references. Once an image leads with an accepted registration, subsequent frames compare only that image. Each tracking request uses the current frozen pixels, scroll alignment and marker candidates. It does not run font recognition or compare the other map images again.

The upper-screen rectangle remains tied to the selected video source and dimensions. A cheap map-name-panel detector gates analysis, including when the text crop was selected manually. A frame without that panel suspends coordinates. It does not start expensive font recognition. This is a conservative visual gate, not a general battle/menu classifier.

Tracking uses the existing coarse six-seed registration, a 250 ms deadline, and the unchanged score >= 0.65 and peak-margin >= 0.08 rules. It does not run a dense fallback. A failed, ambiguous or unfinished match immediately suspends current coordinates and attempts font plus nominated-image reacquisition from the same frozen frame when its name panel is present. No three-frame wait is added. Unfinished map acquisition also prevents redundant font requests while its Worker reply is pending.

A retained image remains a hypothesis. Shared image aliases, previous unsearched font candidates and other map images remain possible. Known map IDs bound to the same reference but absent from the acquisition text are explicitly retained as unknown aliases. An identical-image transition can therefore remain undetected, including a transition to a fixed-display house. Tracking never claims unique map identity, current superiority over untested images, actor facing, a birth event or AT consumption. Fixed minimap display anchors keep their existing guard against conversion into physical world coordinates. The acquisition stamp is kept separately from every fresh capture stamp.

Automatic acquisition and tracking results also join the original player capture before its trajectory sample is completed. The additive `partyCoordinates` field in the trajectory export preserves the existing factored marker × map-image × registration-peak alternatives, per-map physical/fixed-anchor bindings, unknown maps and full capture stamp. It does not choose a player slot or promote an image estimate to an exact world coordinate. The player coordinate panel uses the same conditional range renderer as the map-result panel. A manual-reference reply cannot delay or replace an already completed automatic sample; manual-only observations retain their existing path. Unknown-only automatic results still wait for a pending manual-reference comparison so its fallback candidates are preserved. Automatic continuity uses the retained automatic map alternatives and capture epochs, independently of manual-reply arrival order.

Failed acquisition releases the waiting sample without automatic factors. A retained-image mismatch keeps the same captured frame open through reacquisition, rather than appending two samples. Source invalidation and mismatched capture stamps reject late results; an older valid completion may enter the export without overwriting a newer frame's UI. Exported snapshots and incoming result objects do not share mutable coordinate data.

With no WebGPU, the existing explicit CPU one-frame text action can acquire an image. After that completes, releasing the frozen frame allows the inexpensive retained-image path to run. If the image changes, another explicit CPU acquisition is required. Source replacement, seek, ROM/reference changes, relevant settings changes and cancellation invalidate the retained hypothesis.

## Validation and limits

Portable tests cover repeated-call counts, same-frame reacquisition, unknown scenes, full capture identity, cancellation, source/ROM changes, aliases, the fixed-anchor guard and CPU release. A four-frame synthetic control sequence performs one font acquisition and three single-image requests. No extra manual-reference registration is dispatched on those tracking frames.

Three existing private Sanmarou development frames were checked without threshold tuning. The acquired D09M01 image scores 0.939 at 75 seconds and 0.859 on a later same-image frame at 115 seconds. The different D09M02 image at 80 seconds has the same displayed map name but scores 0.372 and is rejected. Actual retained-image calls evaluated 2,686 translations, took roughly 9 ms in the local Node/WASM measurement, and made zero font calls. These are nonchronological fixture checks, not continuous identity proof or a browser/GPU performance guarantee.

The similarity gates are not calibrated probabilities. Other maps can have similar imagery, and coarse registration can miss a correct alignment. A single retained reference is a speed optimization with explicit uncertainty, not an exhaustive recognition guarantee.

Run the portable checks with:

```
node --experimental-vm-modules scripts/check-video-panel-capture.mjs
node scripts/test-map-coordinate-fallback.mjs
node scripts/test-map-marker-coordinate.mjs
```

No private ROM, map image, video frame or inference result fixture is included in the published source changes.
