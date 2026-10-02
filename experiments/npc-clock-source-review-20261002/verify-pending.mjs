import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const file='npc-clock-source-review-20261002/private-native-pending/observation.json',bytes=await fs.readFile(file),d=JSON.parse(bytes);assert(!d.error,d.error);assert(d.originalSaveUnchanged);assert(d.drains.every(x=>x.dropped===0));let pending=d.initialPending,betweenEntryAndClear=false;const errors=[],increments=[],producerInputs=[],ambiguous=[];
for(const e of d.events){
 if(e.pc===0x020129dc){
  if(betweenEntryAndClear)ambiguous.push({sequence:e.sequence,reason:'IRQ between producer entry and post-clear observation; exact clear hook needed'});
  const expected=(pending+1)>>>0;
  if(e.words[1]!==pending||e.regs[2]!==expected)errors.push({sequence:e.sequence,expectedBefore:pending,actualBefore:e.words[1],expectedAfter:expected,actualAfter:e.regs[2]});
  increments.push({sequence:e.sequence,frame:e.completedFrames,before:pending,after:e.regs[2]});pending=e.regs[2];
 }else if(e.pc===0x0200ffac){
  if(e.words[1]!==pending)errors.push({sequence:e.sequence,expectedPending:pending,actualPending:e.words[1]});
  producerInputs.push({sequence:e.sequence,frame:e.completedFrames,pending});betweenEntryAndClear=true;
 }else if(e.pc===0x02010000){
  // This hook is after the source clear. This bounded check cannot assign an interrupt interleaved before it.
  if(e.words[1]!==0)ambiguous.push({sequence:e.sequence,reason:'Nonzero pending after source clear; not assumed zero'});
  pending=e.words[1];betweenEntryAndClear=false;
 }
}
const summary={scope:'Observed pending-counter recurrence from initial value plus source-bound callback stores and producer clears; not a forecast of hardware tick timing',captureSHA256:createHash('sha256').update(bytes).digest('hex'),initialPending:d.initialPending,incrementCount:increments.length,producerInputs:producerInputs.length,mismatchCount:errors.length,ambiguousInterleavings:ambiguous.length,firstDifference:errors[0]??null,firstAmbiguity:ambiguous[0]??null,eventCount:d.events.length,dropped:0,originalSaveUnchanged:d.originalSaveUnchanged,bootProof:false,worldResolved:false,newObserverOffOnPair:false};await fs.writeFile('npc-clock-source-review-20261002/PENDING_VERIFICATION.json',JSON.stringify(summary,null,2)+'\n');await fs.writeFile('npc-clock-source-review-20261002/private-native-pending/comparison.json',JSON.stringify({increments,producerInputs,errors,ambiguous},null,2)+'\n');console.log(JSON.stringify(summary));if(errors.length||ambiguous.length)process.exitCode=1;
