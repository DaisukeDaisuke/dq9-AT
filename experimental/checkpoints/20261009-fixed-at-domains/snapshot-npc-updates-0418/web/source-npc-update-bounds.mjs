// A per-source-invocation bound, never a video-seconds or frame-rate estimate.
import {ACTOR_ROM_SHA256} from './actor-rom-mining.mjs';
import {readArm9SdkImage} from './map-browser-preview/rom-arm9.mjs';
import {decodeMapEntryOverlay} from './map-entry-source-binding.mjs';
import {NPC_UPDATE_BINDING} from './source-npc-update-binding.mjs';
const prepared=new WeakSet(),need=(p,m)=>{if(!p)throw Error(m);};
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export async function createSourceNPCUpdateBoundReader({rom,romSHA256}){
 need(rom instanceof Uint8Array&&romSHA256===ACTOR_ROM_SHA256&&await sha(rom)===romSHA256,'Verified original ROM required');const sdk=readArm9SdkImage(rom),o=decodeMapEntryOverlay(rom),images=[...sdk.segments.map(s=>({address:s.address,bytes:s.bytes})),{address:o.base,bytes:o.bytes}];
 for(const b of NPC_UPDATE_BINDING.sourceImages){const im=images.find(s=>s.address===b.address&&s.bytes.length===b.bytes);need(im&&await sha(im.bytes)===b.sha256,'NPC update source changed');}
 return function read(){const result=freeze({schema:'source-conditional-NPC-update-AT-bound-v1',romSHA256,
  scope:{entry:0x02041128,return:0x0204143c,unit:'one reached ordinary NPC controller invocation'},calls:{min:'0',max:'2'},
  conditions:['Ordinary actor pointer at controller+0x14 is present; auxiliary actor pointer at+0x10 is null','Native descriptor and linked route entries are valid, and helpers return normally','No other actor, global, interrupt or other-thread AT consumer or seed setter is included in this local invocation'],
  sourceBinding:NPC_UPDATE_BINDING,branches:{timerNotDue:{min:'0',max:'0'},movementOnlyOrResetOnly:{min:'0',max:'1'},movementAndReset:{min:'0',max:'2'}},
  upperBoundReason:'One direction draw at02041630 or one route draw at020416e4, never both; at most one threshold reset at02041220. Earlier ordinary actor update0203cd50 contributes zero.',
  invocationCount:{min:'0',max:null,reason:'No game-update count is inferred from timestamps, video samples or renderer frames'},
  windowCalls:{min:'0',max:null},compositionRule:'For a separately source-bounded total of N admitted ordinary controller invocations, this family contributes at most 2*N calls. Other families remain separate.',
  unresolvedAlternatives:[{family:'kind2-or-kind5-controller-update',sourceSite:0x020bf4c4,reason:'Queued graphics-resource callback via task+0xc is outside this ordinary actor branch'},{family:'auxiliary-actor-update',sourceSite:0x02041428,reason:'Non-null controller+0x10 branch is not covered'},{family:'other-world-consumers',reason:'Selected-field scheduler, other actors and all unrelated consumers require their own source bounds'}],
  conditionsMeasured:false,sourceClockKnown:false,wholeWorldGapResolved:false,currentATRecovered:false,unknownAlternativeRetained:true});prepared.add(result);return result;};
}
export function isPreparedNPCUpdateBound(result){return prepared.has(result);}
