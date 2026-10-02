# Local-ROM replay: complete UpdateAT source binding

The browser's existing `createFirstSpawnReplay` entry now verifies the loaded Japanese revision 0 ROM before creating either its ordinary first-spawn or fresh-F06 replay. Previously, changing the arithmetic immediate inside UpdateAT still produced a ready replay using the unchanged arithmetic model. That production call-site gap was reproduced, not inferred from the diagnostic checker alone.

The fixed SHA-256 `cbfee76031542ac6b2e5afd72b008ed813a78170951afcb76b2eed13b1c5c462` covers the contiguous 52 bytes at ARM9 address `0x02003c30`: all 10 instructions (40 bytes), then all 3 referenced literals (12 bytes). It was established from the original ROM whose SHA-256 is `3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7`, independently compared with the reviewed source. It is not learned from an incoming packet or claimed digest. No ROM instruction bytes, RAM, Ghidra responses, or game assets are distributed by this addition.

`verifyATSourceRom` uses the existing header-directed ARM9 decoder, checks region/revision and the full leaf digest, and rejects mismatches before resource allocation or AT calculation. The replay constructor remains synchronous. Its narrowly scoped SHA-256 implementation handles exactly 52 bytes and is checked against Node's independent SHA-256 on 256 synthetic inputs. Successful results are not cached by mutable ROM buffer identity.

## What the binding does not prove

- It binds this arithmetic leaf, not every caller or the entire ROM
- A reached UpdateAT entry/return pair is one physical draw; its wrapper is not another draw
- Reached nonempty table selection and reached weighted selection are distinct draws, including a table selector with max=1
- Caller reachability, the interposed branches and seed-writer exclusion remain separate obligations
- A matching arithmetic sequence does not prove no intervening seed setter. Even a same-value setter is a boundary
- Scene/table construction includes seed setters on offline branches. Offline status alone cannot certify a common seed epoch
- No current seed, current position, global lower bound or cross-map increment is established by passing this hash check

`ATSession.setMap` is driven by the map browser selection and explicitly does not assert a physical transition; selecting another display map must not reset a seed. The separate physical transition replay already accepts an explicit conditional `noSeedSetter` assumption. This patch does not upgrade that assumption to source proof, add a new magic preservation flag, or alter existing session serialization.

## Verification

`node scripts/test-at-source.mjs` runs the portable synthetic/hash/call-site guards in the normal build. Supplying a local original-ROM path additionally checks the fixed hash, the original arithmetic mutation, mutations in every one of the 52 instruction/literal bytes, in-place mutation after success, byte-offset views, and unchanged original input. The real ROM is optional, stays local and is not written by the test. Positive replay compatibility is additionally compared on the existing original-state F06 input and the established connected-origin fixture; those private inputs are not bundled with this document.
