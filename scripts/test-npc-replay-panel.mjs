// Production UI must not accept native origin/clock snapshots. The previous
// upload-controller behavior is intentionally retired, not made optional.
// Pure synthetic replay arithmetic remains covered by test-npc-at-replay.mjs.
import assert from 'node:assert/strict';
import {attachNpcReplayPanel} from '../web/npc-at-replay-panel.mjs';
import {PRODUCTION_AT_INPUT_NOTICE,assertProductionATCommand} from '../web/production-at-input-policy.mjs';
let checks=0,calls=0,reads=0,saves=0;
const root={textContent:'',innerHTML:'',querySelector(){reads++;throw Error('snapshot input must not be bound');}};
const panel=attachNpcReplayPanel(root,{send(){calls++;throw Error('snapshot must not be sent');},save(){saves++;}});
assert(root.textContent.includes(PRODUCTION_AT_INPUT_NOTICE));checks++;
assert(root.textContent.includes('入力は受け付けません'));checks++;
assert(!root.innerHTML.includes('type="file"'));checks++;
panel.clear();panel.clear();assert.equal(calls,0);assert.equal(reads,0);assert.equal(saves,0);checks+=3;
const poison=new Proxy({}, {get(){reads++;throw Error('native input inspected');}});
for(const type of ['npc-continuation','npc-continuation-files'])for(const flags of [{},{debug:true},{mode:'diagnostic'}]){assert.throws(()=>assertProductionATCommand({type,...flags,origin:poison,clocks:poison}),e=>e.name==='ProductionATInputPolicyError');checks++;}
assert.equal(reads,0);checks++;
console.log(JSON.stringify({suite:'npc-replay-panel-production-rejection',checks,passed:true,visualBrowserQA:false,legacySnapshotUIIntentionallyUnavailable:true}));
