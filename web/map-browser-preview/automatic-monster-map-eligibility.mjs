// Purpose-scoped admission to the encfld-backed monster pipeline, not a claim
// that a map contains no monsters, causes no AT calls, or is the current map.
import {decodeEncounterContexts,contextsForMap,ENCOUNTER_CONTEXT_PATH} from '../encounter-context.mjs';
import {decodeCalls} from './minimap-preview.mjs';
import {u32} from './vendor/call-stream.mjs';
const need=(ok,reason)=>{if(!ok)throw Error(reason);};

// decodeCalls/ decodeEncounterContexts are intentionally permissive for mining.
// Negative workflow admission additionally needs a complete supported stream:
// an empty/truncated/unknown command cannot stand in for an absent map group.
export function readMonsterWorkflowEncounterContexts(project){
 try{
  const bytes=new Uint8Array(project.nfs.readFile(ENCOUNTER_CONTEXT_PATH));
  need(bytes.length>=16,'Truncated encfld header');
  const count=u32(bytes,0),pool=u32(bytes,4),poolSize=u32(bytes,8);
  need(count>0&&pool>=16&&pool<=bytes.length&&poolSize<=bytes.length-pool,'Invalid or empty encfld stream');
  need(u32(bytes,12)===2,'Unsupported encfld stream header');
  const calls=decodeCalls(bytes);let end=16,group=false,row=false,flags=false,entries=0;
  const finishRow=()=>need(!row||(flags&&entries>0),'Incomplete encfld table row');
  for(const c of calls){
   need(c.offset===end,'Discontinuous encfld call stream');
   end=c.offset+((3+Math.ceil(c.argumentCount/4)+3)&~3)+c.argumentCount*4;
   need(end<=pool,'encfld call overlaps string pool');
   for(const [i,a]of c.args.entries()){
    if(a.type===0){const start=pool+a.raw;need(a.raw<poolSize&&bytes.subarray(start,pool+poolSize).includes(0),'Invalid encfld string reference');}
    else need((a.type===1||a.type===2)&&Number.isFinite(c.values[i]),'Unsupported encfld argument');
   }
   const ints=n=>c.args.length===n&&c.args.every(a=>a.type===1);
   if(c.opcode===100||c.opcode===101)need(!group&&c.args.length===1&&c.args[0].type===0,'Unsupported encfld metadata');
   else if(c.opcode===105){finishRow();need(ints(5)&&c.values[0]>=0,'Unsupported encfld map group');group=true;row=false;}
   else if(c.opcode===104){finishRow();need(group&&ints(1)&&c.values[0]>=0,'Unsupported encfld table reference');row=true;flags=false;entries=0;}
   else if(c.opcode===102){need(row&&!flags&&ints(1),'Unsupported encfld table flags');flags=true;}
   else if(c.opcode===103){need(row&&flags&&c.args.length===2&&c.args[0].type===1&&(c.args[1].type===1||c.args[1].type===2),'Unsupported encfld table entry');entries++;}
   else throw Error('Unsupported encfld opcode '+c.opcode+' at '+c.offset);
  }
  finishRow();
  need(end<=pool&&pool-end<16&&bytes.subarray(end,pool).every(x=>x===255)&&bytes.subarray(pool+poolSize).every(x=>x===255),'Incomplete encfld call/pool boundaries');
  const contexts=decodeEncounterContexts(calls);
  need(contexts.groups.length>0&&contexts.groups.every(g=>g.rows.length>0)&&!contexts.warnings.length,'Empty or unsupported encfld contexts');
  return{status:'decoded',contexts,source:{path:ENCOUNTER_CONTEXT_PATH,bytes:bytes.length,callCount:calls.length,summary:contexts.summary}};
 }catch(error){return{status:'unknown',contexts:null,source:{path:ENCOUNTER_CONTEXT_PATH},reason:error.message};}
}

export function monsterMapWorkflowEligibility(source,mapId){
 const common={kind:'encfld-monster-workflow-eligibility',purpose:'automatic-monster-recognition',mapId,source:source.source,mapCandidateRetained:true,monsterPresenceKnown:false,absenceCertified:false,minimumProvenATCalls:0};
 if(source.status!=='decoded'||!Number.isInteger(mapId))return{...common,status:'unknown',skipBackground:false,reason:source.reason??'Map ID unavailable',groups:[],scope:'Unknown context availability retains the existing background route.'};
 const groups=contextsForMap(source.contexts,mapId);
 // Keep every story/time/area row. Do not use contextRows(), which selects only
 // unconditional groups, or load the model catalog/inference runtime here.
 return{...common,status:groups.length?'eligible':'no-encfld-group',skipBackground:groups.length===0,groups:structuredClone(groups),reason:groups.length?'ROM encounter-context branches available':'No group for this candidate in the completely decoded encfld stream',scope:'Only encfld-backed automatic monster work is gated. Missing groups do not establish monster absence, current map identity, map entry, or zero AT consumption.'};
}

export function createAutomaticMonsterMapGate(project){
 let source=null;
 return(mapId)=>monsterMapWorkflowEligibility(source??=readMonsterWorkflowEncounterContexts(project),mapId);
}
