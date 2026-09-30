# Upper-map registration — C3

The existing NDS MapProject/MapRenderer supplies the selected composed map; CameraInput supplies the actual upper-screen ROI. New map_position.c performs opaque-pixel grayscale normalized cross-correlation, coarse-to-fine translation with explicit scale hypotheses. map-position.mjs exposes candidate peaks and margin; position-worker.mjs uses an independent WASM memory from the AT worker. No game images are included in repository assets.

Actual observation: map7402 descriptorD04M02.bmmp,224x256 ROM reference; live upper screen resized128x96 and luma5 quantized for transfer. Best at scale0.5, dx8/dy-72, correlation0.8577815, distinct-peak margin0.2956244. Single actual-sample elapsed11.0808ms in local execution; not a general browserFPS guarantee. Image bounds and scores recorded in docs/observations/actual-map-position.json; pixel data only under private.

UI: select a ROM map, connect the camera, set the upper-screen ROI, then enable マップ位置照合. Default scale0.5 corresponds to1 ROM pixel per native256px DS upper-screen pixel with the matching frame reduced128px. Other scales are explicit hypotheses. The selected map name ROI is masked from the image match. The current GUI calibration has not been exercised via browser automation; the actual pixels ran through the same production matcher.

Acceptance .65 correlation/.08 peak margin are heuristic gates, not calibrated confidence probabilities. There may be lookalike maps or clipped/feature-poor frames. Unresolved results keep candidate peaks and do not create AT proof.

This implementation tracks the image alignment/scroll. It does not yet identify the player arrow or convert image pixels to world coordinates. Neither a green image-bound box nor a matching map name proves current player/world position. No human route is inferred from the monster movement graph. World transform, player-marker template from ROM, actual displacement checks and passability remain the next navigation gap.
