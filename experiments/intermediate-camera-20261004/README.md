# Isolated intermediate camera chain

This compact component accepts an existing camera estimator and consecutive256x192 gray/mask/blocked frames. It retains recognition-anchor and latest frame state, plus one transient incoming copy. It does not retain a full-frame history or fabricate enemy observations.

Every intermediate motion must pass the unchanged estimator. Identity, serial continuity and increasing timestamps are checked; camera and recognition gaps retain the existing .5s bound. Composed endpoint displacement must pass the original clippedSAD/support/residual checks. A source change, missing camera frame, failed step or failed endpoint remains unknown. No actor identity, birth, absence or AT certification follows.

Actual349-frame historical video replay verified allRGBA hashes/timestamps and30original recognition anchors.28/29registration intervals exactly reproduced prior offline composition. The final residual14.157 still fails the14gate. This is known-clip evidence and no live capture/classification performance claim. Timings of push/take exclude decode, preprocessing and recognition.

No production import is enabled. The current video observer's250ms sample gate does not automatically supply intermediate frames; live integration and source-switch/cancellation behavior remain unverified. Missing enemy observations must still break associations even when camera motion is known.
