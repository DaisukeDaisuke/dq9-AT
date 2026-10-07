# Contain failure of the added camera-relative hint

This is a separate delta on top of SOURCE_ONLY_CAMERA_RELATIVE_HINT.zip (SHA256 d9a6c198bb3ffad58bc6f3f5879613b16bff45a8ea93943c1fecbf96867cf50e). The original archive is unchanged.

## Confirmed defect

The service's outer source-or-placement catch marked a job done when newly added camera-relative decode / preparePerspectiveBody / placeCompleteBodyOnFloors preparation threw. A controlled existing-service test made only the derived-heading preparation fail while the former direct and stored domain could succeed. All four pairs lost their original domain: zero render calls, although the four errors were retained.

## Minimal correction

An explicit visit-local marker records the relative source-scale index only across decoded geometry and envelope preparation. Success clears the marker before ordinary proposal queuing and rendering. If that added preparation throws, preserve its source error/pose/scale, advance only its relative scale index once, and keep the job active for its next scale, former direct hint and original domain. This does not retry the same failed hint or score a partial render.

All earlier setup errors, original direct/source preparation errors and emitted errors keep their existing semantics. AbortError still propagates before failure containment and never becomes a successful or recoverable proposal.

## Validation

The controlled post-fix service reaches all 128 original direct/stored render calls in exactly their old order. Each pair retains exactly one failed derived preparation. Controls also confirm:

- A failure in placeCompleteBodyOnFloors is contained in the same narrow scope.
- A failed first derived scale does not skip the second scale.
- Original direct-preparation and source-setup errors still terminate their jobs as before.
- AbortError propagates unchanged.
- Successful result rows and the ordinary milestone exactly match the previously frozen camera patch.

These are deterministic source/renderer doubles, not new video fits or general source coverage. The current real-frame negative evidence from the original package is unchanged. No full build, browser, Git or publication was performed.

Apply the original camera patch first, then this delta. The added test accepts a target service path and an optional successful-baseline service path. With EXPECT_BROKEN=1, it confirms the former failure using the old camera-patch service.
