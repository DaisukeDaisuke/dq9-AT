# File-video lifecycle diagnostic source checkpoint

Base runtime: eb44154dfd03299c0fa634767c5a2e300aaf525c.

This directory preserves the complete proposed module, the exact pre-change module, the patch, and the controlled comparison harness. It is not imported by the deployed application. It adds bounded diagnostic records only; it does not change timestamp comparison, reset, seek or callback scheduling rules. The actual browser reset cause remains unproven.

From the repository root:

```sh
mkdir -p experimental/checkpoints/clock-lifecycle-20261006/evidence
node experimental/checkpoints/clock-lifecycle-20261006/tests/test-clock-lifecycle.mjs
```

The 15 checks use synthetic event/callback inputs. They do not prove that Chromium produced the injected cancelled-callback sequence. Full runtime source and build files remain at the repository root, not in this checkpoint directory. No ROM, SAV, RAM, video, extracted game asset or credential is included.
