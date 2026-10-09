// Conditional source components. No frame clock, seed, RAM, or manual counters.
import {ACTOR_ROM_SHA256,decodeActorArm9} from './actor-rom-mining.mjs';
import {decodeMapEntryOverlay} from './map-entry-source-binding.mjs';
import {LOADER_NO_DRAW_BINDINGS} from './source-loader-at-bindings.mjs';
const prepared=new WeakSet();
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const assert=(p,m)=>{if(!p)throw Error(m);};
const descriptions=new Map([
 [0x02036d8c,'actor-handle-clear'],[0x0203d4ec,'NPC-manager-clear'],
 [0x020779a8,'field-actor-reset'],[0x021a3e54,'selected-field-12-slot-reset'],
 [0x021a3278,'loader-reference-clear'],[0x021ce93c,'loader-final-default-branch'],
 [0x02191fb4,'loader-final-flagged-branch'],[0x02041740,'kind2-actor-initializer'],
 [0x02090100,'loader-special-actor-clear'],[0x0207ecd0,'loader-model-list-clear'],
]);
/** Verifies original instruction ranges for reviewed closed direct-call graphs.
 * The graphs include every conditional branch, calls and constant tail veneers.
 * They exclude neither hidden draw sites nor arbitrary iterations. The finite
 * roots reject if their ROM source changes; unresolved dynamic graphs remain so.
 */
export async function createSourceLoaderATComponentReader({rom,romSHA256}){
 assert(rom instanceof Uint8Array&&romSHA256===ACTOR_ROM_SHA256&&await sha(rom)===romSHA256,'Verified original ROM required for loader source components');
 const arm=decodeActorArm9(rom),overlay=decodeMapEntryOverlay(rom),images={arm9:arm,overlay17:overlay};
 const word=pc=>{const im=pc>=overlay.base?overlay:arm,offset=pc-im.base;assert(offset>=0&&offset+4<=im.bytes.length,'Source instruction outside image');return new DataView(im.bytes.buffer,im.bytes.byteOffset,im.bytes.byteLength).getUint32(offset,true);};
 const boundCall=(pc,target)=>{const w=word(pc);assert(w>>>24===0xeb&&((pc+8+((w<<8)>>6))>>>0)===target,'Loader source call target changed');return {image:pc>=overlay.base?'overlay17':'arm9',address:pc,target};};
 const zero=[];
 for(const binding of LOADER_NO_DRAW_BINDINGS){
  for(const range of binding.ranges){const im=images[range.image],offset=range.address-im.base;assert(offset>=0&&offset+range.bytes<=im.bytes.length&&await sha(im.bytes.subarray(offset,offset+range.bytes))===range.sha256,'Loader no-draw source closure changed');}
  zero.push({id:descriptions.get(binding.root),scope:{kind:'one-reached-function-invocation-and-its-source-call-closure',entry:binding.root},calls:{min:'0',max:'0'},seedSetterInComponent:false,conditions:['Reached this original function with valid native objects and normal call/return semantics','No interleaved interrupt, other thread, or independent actor/global consumer is included in this local component'],sourceBindings:binding.ranges,closedInstructionCount:binding.instructionCount,conditionsMeasured:false});
 }
 // Source induction: index starts at 0, increments by 1, and is tested against
 // the immediate slot count. Unknown handle occupancy changes only which zero-
 // draw helper calls occur, never the maximum number of helper invocations.
 const loops=[
  {id:'pre-pool-actor-clear',start:0x021a3cac,increment:0x021a3ccc,compare:0x021a3cd0,call:0x021a3cc8,register:7,helper:0x02036d8c},
  {id:'post-pool-actor-clear',start:0x021a3cec,increment:0x021a3d0c,compare:0x021a3d10,call:0x021a3d08,register:6,helper:0x02036d8c},
 ].map(q=>{assert(word(q.start)===((0xe3a00000|(q.register<<12))>>>0),'Loader counter initialization changed');assert(word(q.increment)===((0xe2800001|(q.register<<16)|(q.register<<12))>>>0),'Loader counter increment changed');const compare=word(q.compare);assert((compare&0xffffff00)===(0xe3500000|(q.register<<16)),'Loader counter bound changed');return {id:q.id,helperEntry:q.helper,invocations:{min:0,max:compare&255},boundSource:{initialize:q.start,increment:q.increment,compare:q.compare},call:boundCall(q.call,q.helper),ATCalls:{min:'0',max:'0'},scope:'helper invocations only; pool calls between these loops are separate',conditionsMeasured:false};});
 const commonController=boundCall(0x0203d668,0x020409bc),controllerDraw=boundCall(0x020409cc,0x02003c30),kind2Initializer=boundCall(0x0203d6ec,0x02041740),modelConstructor=boundCall(0x0203d744,0x02036260);
 assert(word(0x0203d740)===0xe3a02000&&word(0x0203627c)===0xe58d2008&&word(0x020364e8)===0xe59d1008&&word(0x020364ec)===0xe3510000&&word(0x020364f0)===0x0a000002,'Kind2 zero model callback path changed');
 const binding=freeze({schema:'source-loader-AT-components-binding-v1',romSHA256,zero,loops,commonController,controllerDraw,kind2Initializer,modelConstructor});prepared.add(binding);
 return function read(){
  const result=freeze({schema:'conditional-source-loader-AT-components-v1',romSHA256,components:zero,sourceLoopBounds:loops,
   ordering:{disjoint:false,reason:'Function scopes can be nested or repeated; these are replaceable component facts, not an additive total. The two actor-clear loop call groups are disjoint within one cleanup invocation; final branches are mutually exclusive.'},
   kind2:{commonControllerCalls:{min:'1',max:'1'},actorInitializerCalls:{min:'0',max:'0'},scope:'One descriptor after successful controller allocation through the reached common controller and kind2 initializer only',sourceBindings:[commonController,controllerDraw,kind2Initializer,modelConstructor],conditions:['Kind2 descriptor reaches the controller initializer after its allocation succeeds'],modelAndPlacementTailCalls:{min:'0',max:null},wholeDescriptorCalls:{min:'1',max:null},optionalModelCallback:{address:0x020364f4,callerArgument:0,excludedAtThisCall:true},conditionsMeasured:false},
   remainingConsumers:[
    {id:'loader-pool-scheduling',entry:0x021a3be0,calls:{min:'0',max:null},unresolvedSourceSites:[0x020c9858,0x020c8f08,0x020c8ef0,0x020c980c],reason:'Pool mutex wait/wake reaches thread/context callbacks; closed zero-draw helpers do not close scheduling/interleavings'},
    {id:'kind2-model-materialization',entry:0x02036260,calls:{min:'0',max:null},unresolvedSourceSites:[0x020b4614,0x020304f0,0x020304d0,0x0207f388,0x0207f370,0x0207f358],reason:'Model/graphics function-pointer dispatch requires source-target closure; absence of a direct draw in the visited graph is insufficient'},
    {id:'outside-loader-and-other-loader-callees',calls:{min:'0',max:null},reason:'This component reader does not enumerate arbitrary pre-entry/post-entry updates or the full ordinary loader'},
   ],wholeLoaderCalls:{min:'0',max:null},wholeWorldGapResolved:false,sourceClockKnown:false,numericSeedSupplied:false,currentATRecovered:false,unknownAlternativeRetained:true});
  prepared.add(result);return result;
 };
}
export function isPreparedSourceLoaderATComponents(result){return prepared.has(result);}
