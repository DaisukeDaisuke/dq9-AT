// Compare frozen source prediction with bounded native observations. This is a
// local execution check, never a boot-prefix producer or allocator simulation.
import {ARand} from './vendor/arand-reference.mjs';
const need=(p,m)=>{if(!p)throw Error(m);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function compareMapEntryObservation(packet,projection,evidence){
 const differences=[],checks=[];const check=(field,expected,actual,context={})=>{checks.push(field);if(!equal(expected,actual))differences.push({field,expected,actual,...context});};
 try{
  need(evidence?.schema==='work8-entry-observation-v1'&&Array.isArray(evidence.events)&&Array.isArray(evidence.comparisons),'Raw bounded observation required');
  need(evidence.epoch===packet.origin.epoch&&evidence.originRamSha256===packet.origin.ramSha256,'Observation origin/epoch differs from prediction');
  need(evidence.startFrame===packet.origin.frame&&evidence.endFrame===packet.schedule.endFrame,'Closed input window differs');
  let inputFrame=evidence.startFrame;const expectedInputs=packet.schedule.segments.map(s=>{const row={atFrame:inputFrame,buttons:s.buttons};inputFrame+=s.frames;return row;});
  check('input.schedule',expectedInputs,evidence.inputChanges);need(inputFrame===evidence.endFrame,'Input schedule does not close at endpoint');
  const profiles=new Map(evidence.profiles.map(p=>[p.profileSerial,p])),last=new Map();
  for(const e of evidence.events){const p=profiles.get(e.profileSerial);need(p&&p.sites.some(s=>s.address===e.pc),'Unbound observer PC');const previous=last.get(e.profileSerial)??-1;need(e.sequence===previous+1,'Observer sequence gap');last.set(e.profileSerial,e.sequence);}
  const window=evidence.events.filter(e=>e.completedFrames>=evidence.startFrame&&e.completedFrames<evidence.endFrame),used=new Set(window.map(e=>e.profileSerial));
  for(const id of used){const p=profiles.get(id);need([0x02003c30,0x02003c54,0x02003c64].every(pc=>p.sites.some(s=>s.address===pc)),'Updater entry/return/setter profile incomplete');}
  if(Array.isArray(evidence.drains)){for(const d of evidence.drains){need(d.dropped===0&&d.beforeFrame===d.afterFrame&&d.count<1024,'Dropped/truncated events or observer drain advanced emulation');}
   const windowDrains=evidence.drains.filter(d=>d.frame>evidence.startFrame&&d.frame<=evidence.endFrame);need(windowDrains.length===evidence.endFrame-evidence.startFrame&&windowDrains.every((d,i)=>d.frame===evidence.startFrame+i+1),'Missing/duplicate frame drains');}
  const cs=evidence.comparisons.filter(c=>c.frame>=evidence.startFrame&&c.frame<=evidence.endFrame);
  need(cs.some(c=>c.frame===evidence.startFrame)&&cs.some(c=>c.frame===evidence.endFrame),'OFF/ON comparison endpoints absent');
  need(cs.every(c=>c.registersEqual&&c.stateEqual&&c.pixelsEqual&&c.valid&&(!c.ramHashes||c.ramEqual)),'OFF/ON difference');
  check('seed-setter.count',0,window.filter(e=>e.pc===0x02003c64).length);
  const pairs=[];let open=null;
  for(const e of window){if(e.pc===0x02003c30){need(!open,'Nested/unclosed AT updater');open=e;}
   else if(e.pc===0x02003c54){need(open,'AT return without entry');const [after,r]=ARand(BigInt(open.words[0]));
    check('AT.before-at-return',open.words[0],e.regs[3],{ordinal:pairs.length+1});check('AT.after',Number(after),e.words[0],{ordinal:pairs.length+1});check('AT.random',Number(r),e.regs[0],{ordinal:pairs.length+1});check('AT.return-caller',open.regs[14],e.regs[14],{ordinal:pairs.length+1});
    pairs.push({entry:open,return:e});open=null;}}
  need(!open,'AT interval open at endpoint');check('draw.count',projection.draws.length,pairs.length);
  for(let i=0;i<Math.min(projection.draws.length,pairs.length);i++){const p=projection.draws[i],n=pairs[i],ctx={ordinal:i+1,phase:p.phase,consumer:p.consumer,sourceFrame:n.entry.completedFrames};
   check('draw.before',p.before,n.entry.words[0],ctx);check('draw.after',p.after,n.return.words[0],ctx);check('draw.random',p.random,n.return.regs[0],ctx);check('draw.caller',p.lr,n.entry.regs[14],ctx);
  }
  const w=evidence.stateWitness;need(w&&w.ramSha256&&w.mapId===packet.source.mapId,'Closed-state witness missing');
  check('NPC.descriptor-order',projection.membership.definitions.map(d=>[d.storedId,d.kind]),w.descriptorOrder);
  const nativeByOrdinal=new Map(w.drawStates.map(x=>[x.ordinal,x]));
  for(const p of projection.draws){const n=nativeByOrdinal.get(p.ordinal);need(n,'Missing observed consumer state');const ctx={ordinal:p.ordinal,consumer:p.consumer};
   if(p.consumer==='treasure-kind1'){check('treasure.id',p.entryId,n.id,ctx);check('treasure.value',p.output.value,n.value,ctx);check('treasure.flags',p.output.flags&p.output.knownFlagsMask,n.flags&p.output.knownFlagsMask,ctx);}
   else{check('NPC.id',p.npcId,n.id,ctx);check('NPC.kind',p.kind,n.kind,ctx);if(p.threshold!==undefined)check('NPC.threshold',p.threshold,n.threshold,ctx);if(p.actorPhase!==undefined)check('NPC.actorPhase',p.actorPhase,n.actorPhase,ctx);}
  }
  check('end.seed',projection.seedAfter,cs.at(-1).seed);
  check('controller.closed-count',projection.draws.filter(x=>x.consumer==='npc-controller-initialize').length,window.filter(e=>e.pc===0x020409d0).length);
  return {schema:'work8-entry-comparison-v1',matches:!differences.length,firstDifference:differences[0]??null,differenceCount:differences.length,checks:checks.length,orderedPairs:pairs.length,seedBefore:projection.seedBefore,seedAfter:projection.seedAfter,observedMinimumLocalCalls:pairs.length,bootProof:false,
   observer:{continuousSequence:true,rawDrainsAvailable:Array.isArray(evidence.drains),dropped:Array.isArray(evidence.drains)?0:null,legacyDropChecks:'capture asserts dropped0 at every drain; raw drain rows required for complete observer certificate',OFFONComparisons:cs.length,fullRAMComparisons:cs.filter(c=>c.ramHashes).length},differences};
 }catch(error){return {schema:'work8-entry-comparison-v1',matches:false,firstDifference:{field:'observation-boundary',reason:error.message},differenceCount:differences.length+1,differences,bootProof:false};}
}
