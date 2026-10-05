# Lossless native evidence sharing checkpoint — 2026-10-06 07:30 JST

Base runtime 611fe57, parent main e231a729. Checkpoint only; production cache finalization and browser recheck are pending.

Two source changes intern exactly equal immutable-by-usage failure records within a job, preserving every occurrence and ordered JSON value, and clone each whole attachment graph once to retain sharing. Hash collisions require exact recursive equality; unsupported record shapes bypass sharing. No score, candidate domain, threshold or budget changes.

Measured in the fixed 5330s full request: 55,995 failure occurrences, 942 exact unique records after 100 slices. Serialized graph 11,775,477 to 2,586,812 bytes; JSON unchanged. Real worker/MessagePort run past 10,000 visits: post-GC main heap approximately 209 to 108 MB. This does not establish the cause of the earlier Chromium error 4 or prove it fixed.

Parent checks: 19 lossless eligibility/collision checks and attachment sharing/isolation passed; three deterministic service cases produced byte-identical complete JSON snapshots/events before and after. Initial harness invocation omitted its output path and failed at writeFileSync after computation; corrected invocation passed, with no product edit.

Remaining: cache graph finalization, post-finalization checks, runtime publication and actual browser continuation. All original failure evidence and unverified video state are preserved. Only source and this status are in Git.
