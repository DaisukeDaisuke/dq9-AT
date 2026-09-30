# Video capture identity

Player, text and map observations from a captured frame share one immutable capture stamp. Media time is captured before asynchronous layout or text recognition. Changing the reference map, source or ROM while recognition is pending discards stale work instead of relabeling old pixels with the new context.

The regression uses synthetic pixels and deferred promises with the real capture coordinator/input adapters. It covers normal media advancement, reference changes during both waits, source/seek invalidation, queued reads, and nested stamp immutability. It does not certify video decoding, recognition accuracy, WebGPU execution or AT identification.

Run: `node --experimental-vm-modules scripts/check-video-panel-capture.mjs`

This correction changes observation provenance only. A sighting still proves zero random draws by itself.
