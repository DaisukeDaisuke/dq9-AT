# AT tracking: implementation and evidence boundaries
## Implemented in the WebAssembly application
Existing rand.js ARand is reused unchanged as a reference module. WASM implements the same32bitLCG plus64bit-index skipahead and forward generation. ATRandInt is trunc(max*((rand15-1)/32767.0)), derived from Ghidra and checked against actual-ROM return observations. Weighted outcomes use existing enc.json intervals; enc data is not mined again.
The session begins only from a supplied knowninitialseed. Proven lower bound, a separate hypothesis bound, event log, current map context and an explicit unsearched future are persisted. Map context changes do not reset the sequence. Human input is recorded but adds0 proven calls until that input's exact minimum is evidenced.
Manual monster sightings are hypotheses, not automatically certified natural spawn events. Duplicate observation IDs are rejected. Weighted-outcome matching narrows the observation branch; unresolved unsearched suffix remainspossible. It does not pretend to know the exact current position. A future favorable weighted draw is not a frame countdown or guaranteed spawn.
Save files include the evidence events. Restore replays them rather than trusting savedboundnumbers. A boot exec prefix can move provenlowerbound only if its supplied origin matches the externalinitialseed and every before/after/random/sequence matches the original ARand. Savedstate-origin traces remain researchreplays and cannot be silently promoted to bootproof.
## Not yet connected
Real-time camera map/area/monster observations, certification of naturalspawn vs forcedspawn, automatic continuousboot trace delivery, map-entry minimum calls for pots/barrels/bluechests, monster movement graph consumers and player movement optimization. The initial provenlowerbound remains0 without proofevents; this is explicit, not advertised as completed live navigation.
## Current actual data
metaru-soubi-at32.json is32 actualUpdateAT calls,14ATRandIntreturns and7spawncreation entries from the designated equippedstate. Its startseed is measured from a pausedstate, NOT the user's bootinitialseed. scripts/run-at-replay.mjs exercises production modules on this observation and records every mismatch.
## Checkpoint progression
A01a: combinedWASM and originalARand replay.
A01b: persistentknownseed/conditionalcandidates UI.
A02a: readonlyboot observer from before firstseed consumption, externalknownseed only.
A02b: certify naturalspawn/table/movement/input evidence and maintain the proofchain across maps.
N00: mine candidatepointgraph and coordinate projection, display honest targetareas. Do not infer playerwalkability from enemygraph.
N01: bound-aware futurecomparison with actualrecognizedposition/monsters, redlineguidance and continualreplanning.
