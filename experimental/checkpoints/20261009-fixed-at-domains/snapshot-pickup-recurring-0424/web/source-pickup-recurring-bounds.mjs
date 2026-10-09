// Recurring pickup words are global. The materializer's map-code eligibility
// must never be used to suppress this separate consumer family.
import {ACTOR_ROM_SHA256} from './actor-rom-mining.mjs';
import {readArm9SdkImage} from './map-browser-preview/rom-arm9.mjs';
import {decodeMapEntryOverlay} from './map-entry-source-binding.mjs';
import {PICKUP_RECURRING_BINDING} from './source-pickup-recurring-binding.mjs';
const owned=new WeakSet(),need=(p,m)=>{if(!p)throw Error(m);};
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export async function createSourcePickupRecurringBoundReader({rom,romSHA256}){
 need(rom instanceof Uint8Array&&romSHA256===ACTOR_ROM_SHA256&&await sha(rom)===romSHA256,'Verified original ROM required');const sdk=readArm9SdkImage(rom),o=decodeMapEntryOverlay(rom),images=[...sdk.segments.map(s=>({address:s.address,bytes:s.bytes})),{address:o.base,bytes:o.bytes}];
 for(const b of PICKUP_RECURRING_BINDING.sourceImages){const im=images.find(x=>x.address===b.address&&x.bytes.length===b.bytes);need(im&&await sha(im.bytes)===b.sha256,'Pickup recurring source changed');}
 return function read(){const r=freeze({schema:'source-recurring-pickup-AT-invocation-bound-v1',romSHA256,scope:{entry:0x0208f588,return:0x0208f938,unit:'one reached recurring pickup updater invocation'},calls:{min:'0',max:'2'},currentMapIndependent:true,
  sourceCursor:{range:[0,99],step:'At most one current group processed; successful step increments cursor modulo100',specialIndices:{range:[98,99],calls:{min:'0',max:'1'}}},
  sourceGates:[{sourceSite:0x0208f648,target:0x0202c0cc,meaning:'network/session gate'},{sourceSite:0x0208f680,secondSite:0x0208f68c,meaning:'accumulator and cursor gate'},{sourceSite:0x0208f6b4,meaning:'global pickup-word enabled/story gate'},{sourceSite:0x0208f78c,meaning:'current group countdown gate'}],
  conditions:['Updater cursor and global pickup-word storage follow the original initialization/increment contract','Native objects/list entries are valid and this invocation returns normally','No interleaved consumer or seed setter is included in this local invocation'],
  sourceBinding:PICKUP_RECURRING_BINDING,invocationCount:{min:'0',max:null},windowCalls:{min:'0',max:null},compositionRule:'For N separately source-bounded updater invocations, this family contributes at most 2*N AT calls; a non-F map does not imply zero.',
  materializerAbsenceImpliesRecurringAbsence:false,conditionsMeasured:false,sourceClockKnown:false,wholeWorldGapResolved:false,currentATRecovered:false,unknownAlternativeRetained:true});owned.add(r);return r;};
}
export function isPreparedPickupRecurringBound(result){return owned.has(result);}
