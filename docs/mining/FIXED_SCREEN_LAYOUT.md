# Fixed upper-screen geometry

Automatic mode detects the DS upper-screen rectangle on the first successful frame and retains the normalized rectangle for the same input source and pixel dimensions. The status explicitly says the screen is fixed. Seek, backward playback time, ROM changes and reference-map changes invalidate observations without repeating rectangle detection. A new file, camera reconnection, dimension change, range reset or explicit 再検出 requires a new acquisition. Manual ranges retain their existing behavior.

Local-file source IDs change on load. Their source epochs also change on seek, so epochs remain part of frame provenance rather than geometry identity. Camera epochs identify reconnects. Each observation retains the immutable acquisition frame/time separately from its current captured frame/time.

Failed initial detection remains unknown and may retry on a later sampled frame. It does not schedule its own retry loop. After acquisition, a missing automatic name frame marks the map observation unknown and discards pending map/position ownership while retaining the screen rectangle. Geometry retention is not a claim that a map is visible. The map image, scrolling, marker candidates and text are still evaluated for the current frozen frame. A layout rearrangement inside an unchanged video resolution needs explicit 再検出 or a manual range.

This changes acquisition cadence, not glyph scores, registration thresholds, map identity, world-coordinate calibration or AT accounting. No frame-rate or latency improvement has been measured in a browser for this change.

Validation: the real panel control flow passes 173 Node DOM/canvas/Worker assertions. These include actual file-adapter seeking events, source replacement, camera generation, dimensions, manual/redetect/reset, ROM/reference retention, delayed replies, unknown scenes, immutable capture identity and cancellation. A separate independent adapter check covers backward-time discontinuities. The aggregate source build passes with the installed Emsdk 3.1.6 toolchain. Browser QA remains separate.
