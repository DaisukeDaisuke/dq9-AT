# Explicit native phase sampler checkpoint

This archive contains the five isolated source/test files only. It restores the guarded explicit FX12 sampler, post-scaling joint plan and optional body hook from the earlier e110 checkpoint without replacing the current integer/MSE renderer.

It is not integrated into automatic scheduling or the deployed entrypoint. Current video phase, clock, blend and callback state remain unknown. Integer parity and explicit synthetic phase tests passed at the scope recorded in manifest.json; the isolated standard build and browser workflow have not been run. No video, ROM, extracted assets, raw joints or private measurement outputs are included.
