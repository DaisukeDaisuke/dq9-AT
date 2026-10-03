# Work8 controllerFlags first-difference attribution

Original itemshop SAV and original route were reused without RAM/state injection. Target controller 0x0236fdb8 is NPC7/slot9 in the saved Work8 case. The first frame-level transition is 0→1 at end frame2105, not only the terminal2651 previously compared.

## Writer and branch
- Stopping write breakpoints identify clear-bit0 store02040b4c, direct clear of bit0x40000 at021a59c8, then set-bit0 store02040b5c.
- The setter02040b54 is called at overlay_d_17:021a5ad4 by021a58fc. ARM source confirms load / OR1 / store / return.
- A separate non-stopping original-route run observes 274 setter entry/store/return triplets for the target. First triplet has completedFrames2104, memory0 before store and1 at return. Frame counter therefore agrees with frame-level post2105 transition.
- All4722 observer events had contiguous sequence and drop0;1122 target-relevant events retained. Endframe2651/map100/seed1926876651 and flag1 agree with the original Work8 witness. This is not a new full-RAM OFF/ON pair.
- Focused non-stopping branch sampling observes insideActiveRegion=false, threshold6144. X distance7991,7205,6419 rejects before Z at completedFrames2098/2100/2102; at2104, X5633 and Z6062 both pass inclusive <=6144. Calls repeat2106/2108. Six source comparison decisions match. No absent Z value was invented for short-circuited branches.

## Consequence for replay
The difference is an external proximity updater changing the controller skip bit, not a mismatch in the ordinary NPC random arithmetic. Source currently models the ordinary leaf with an external-setters condition; this condition is now specifically attributable. Do not simply force flag1 at frame2105 or mask the failing field from comparison. The source comparison helper requires resolved current player/controller geometry, radius and active-region state; it does not predict those upstream inputs. NPC7's mode0 already skips the ordinary draw tail, so the accepted conditional33 and BOOT0 remain unchanged.

## Failed attempts retained
The observer words API restricts to canonical main-RAM addresses. First stack-word observation request rejected027e addresses. A proposed023e alias check compared unequal; that alias was not used. The successful focused capture uses registers at actual comparison instructions and no guessed stack data. Stopping-breakpoint and non-stopping evidence remain separate.

## Reproduction
Run capture-flag-frames.mjs, capture-flag-writer.mjs, capture-flag-observer.mjs and capture-proximity-registers.mjs from the restored workspace root, each with a new private output directory. They use the already verified runtime/asset lock and originalSAV copy. Original capture paths intentionally refuse overwrite. verify-proximity.mjs replays saved private-proximity-registers/observation.json without another native capture. The standalone controller-proximity.mjs is an isolated source leaf, not yet production integration.
