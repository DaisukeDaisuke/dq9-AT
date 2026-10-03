// JP revision-0 map entry: source predicates and ordered conditional consumers.
// Heap outcomes, loader timing and the history before the supplied origin remain
// unknown. No caller-supplied reached/allocation flag can turn this into proof.
import {NitroFS} from './vendor/nitro-fs.mjs';
import {readNpcMembershipSource,projectNpcDefinitions} from './npc-membership.mjs';
import {readTreasureSource,TreasureEntryKernel} from './treasure-entry.mjs';
import {ARand} from './vendor/arand-reference.mjs';
import {bindMapEntryInstructions} from './map-entry-source-binding.mjs';
const check=(p,m)=>{if(!p)throw Error(m);};
const uint=(n,max=0xffffffff)=>Number.isInteger(n)&&n>=0&&n<=max;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const clone=structuredClone;
const modifiers=new Set([6,8,11,15,18,19,20]);
const values=c=>{check(c&&dense(c.args)&&c.argumentCount===c.args.length,'Complete placement arguments required');return c.args.map(a=>{check(a&&[0,1,2].includes(a.type)&&uint(a.raw),'Malformed argument');return a.raw|0;});};

export async function readMapEntrySource(rom,{mapId=100}={}){
 check([100,108,112].includes(mapId),'Entry resource binding outside C01/map100,108,112');
 const rawNpc=await readNpcMembershipSource(rom,{mapId,archiveCode:'C01'});
 const npc={...rawNpc,place:{...rawNpc.place,parserEndOffset:rawNpc.place.calls.endOffset,calls:[...rawNpc.place.calls]},npc:{...rawNpc.npc,parserEndOffset:rawNpc.npc.calls.endOffset,calls:[...rawNpc.npc.calls]}};
 check(npc.source.fieldCode===({100:'C01',108:'C01M08',112:'C01M12'}[mapId]),'Maplist field-code mismatch');
 const nitro=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
 // C01 is the supported positive treasure load. Absence on108 is deliberately
 // not a global zero-consumption conclusion or a retained-list clear proof.
 let treasure=null,treasureBoundary=null;
 if(mapId===100)treasure=readTreasureSource(nitro,'C01.bin');
 else if(mapId===112)treasure=readTreasureSource(nitro,'C01M12.bin',{randomPassVersion:2});
 else treasureBoundary='C01M08 treasure load/list-clear path not reconstructed';
 return {schema:'dq9-map-entry-source-v1',romSha256:npc.source.romSHA256,mapId,fieldCode:npc.source.fieldCode,npc,treasure,treasureBoundary,instructionBinding:await bindMapEntryInstructions(rom),
  phaseOrder:['treasure-entry','npc-construction'],sourceScope:'ordinary C01 loader; phase order separately bound by source verifier',bootProof:false};
}

export function mapEntryConditionDependencies(source){
 const bits=new Set(),quests=new Set();
 for(const c of source.npc.place.calls){const a=values(c);
  if([14,21].includes(c.opcode))quests.add(a[0]);
  if(c.opcode===17){const count=(a.length-(a.length%2===0?8:7))/2;check(Number.isInteger(count)&&count>0,'Flag argument shape');
   for(let i=0;i<count;i++){const packed=a[i*2]>>>0,kind=packed>>>16,id=packed&65535;check([1,2].includes(kind),'Unknown flag class');bits.add(kind===2&&id>0x3ff?id+0x6fa:id);}}
 }
 return {bits:[...bits].sort((a,b)=>a-b),quests:[...quests].sort((a,b)=>a-b)};
}

// Read only a pre-entry snapshot. Addresses are source-bound runtime addresses,
// not offsets inferred from SAV serialization or from later native outputs.
export function mapEntryPrimitives(ram,source,{frame,ramSha256,epoch}={}){
 check(ram instanceof Uint8Array&&ram.length===0x400000&&uint(frame)&&typeof ramSha256==='string'&&typeof epoch==='string','Bound pre-entry RAM identity required');
 const v=new DataView(ram.buffer,ram.byteOffset,ram.byteLength),u=a=>v.getUint32(a-0x02000000,true),b=a=>v.getUint8(a-0x02000000);
 const dependencies=mapEntryConditionDependencies(source),story=[0x020f8e28,0x020f8e2c,0x020f8e30].map(u);
 check(story.every(x=>uint(x,255)),'Scenario parser-byte conversion outside bounded source');
 const storyBits=Object.fromEntries(dependencies.bits.map(id=>[id,Boolean(b(0x02108814+(id>>3))&(1<<(id&7)))]));
 const questNibbles=Object.fromEntries(dependencies.quests.map(id=>[id,id<0||id>=204?0:(b(0x02108a54+(id>>1))>>((id&1)*4))&15]));
 return {schema:'dq9-map-entry-origin-v1',frame,epoch,ramSha256,mapId:v.getUint16(0x0fb11c,true),seed:u(0x020eee90),story,modeWord:u(0x020f37b4),storyBits,questNibbles,
  provenance:{storyAddresses:[0x020f8e28,0x020f8e2c,0x020f8e30],modeAddress:0x020f37b4,storyBitBase:0x02108814,questNibbleBase:0x02108a54,seedAddress:0x020eee90}};
}

export function deriveMapEntryMembership(source,origin){
 const decisions=[],nodes=new Map();let npcPrevious=-1,quest4=-1,quest8=-1;
 const result={resolved:false,decisions,placementCandidates:[],definitions:[],provedMinimumAT:0,bootProof:false,
  conditions:['empty destination placement/definition lists after source loader clear','complete source interpreter under valid successful placement/definition allocations'],rankedPlacementGeometryResolved:false};
 try{
  check(source?.schema==='dq9-map-entry-source-v1'&&origin?.schema==='dq9-map-entry-origin-v1','Typed source/origin required');
  check(dense(origin.story)&&origin.story.length===3&&origin.story.every(x=>uint(x,255))&&uint(origin.modeWord),'Scenario/mode primitive required');
  const story=origin.story[0]*1000+origin.story[1]*10+origin.story[2],mode=origin.modeWord!==0;
  const modePass=n=>n===0?mode:n===1?!mode:true;
  const q=n=>{check(Object.hasOwn(origin.questNibbles,n)&&uint(origin.questNibbles[n],15),'Missing quest primitive '+n);return origin.questNibbles[n];};
  const qp=(id,s)=>{const n=q(id),state=n&3;switch(s){case 0:return state===2;case 1:return Boolean(n&4);case 2:return state===3;case 3:return state===1;case 4:return Boolean(n&8)&&state===0;case -1:return state===0;default:throw Error('Unbound quest selector '+s);}};
  for(const c of source.npc.place.calls){const a=values(c),n=a.length,op=c.opcode;if(modifiers.has(op)){decisions.push({callIndex:c.index,opcode:op,action:'membership-neutral-modifier',geometryUnresolved:true});continue;}
   let mi,pass=true;
   if(op===3){check([2,6,7].includes(n),'Opcode3 shape');mi=0;}
   else if(op===4){check([6,10,11].includes(n),'Opcode4 shape');mi=4;pass=a.slice(0,3).every((x,i)=>x===origin.story[i])&&modePass(a[3]);}
   else if(op===5){check([9,12,13,14].includes(n),'Opcode5 membership shape');mi=7;pass=a[0]*1000+a[1]*10+a[2]<=story&&story<=a[3]*1000+a[4]*10+a[5]&&modePass(a[6]);}
   else if(op===14||op===21){mi=op===14?3:9;check((op===14?[5,9,10]:[11,15,16]).includes(n),'Quest placement shape');const id=a[mi+1],qid=a[0];
    if(id!==npcPrevious){npcPrevious=id;quest4=-1;quest8=-1;}
    const previous=op===14?quest8:quest4,state=q(qid)&3;
    const precedenceSkip=previous!==qid&&previous>=0&&![1,2].includes(state)&&(q(previous)&3)===3&&state===3&&qid<previous;
    pass=!precedenceSkip&&qp(qid,a[1]);
    if(op===14)pass=pass&&quest4<=0&&modePass(a[2]);
    else pass=pass&&a[2]*1000+a[3]*10+a[4]<=story&&story<=a[5]*1000+a[6]*10+a[7]&&modePass(a[8]);
   }else if(op===17){const count=(n-(n%2===0?8:7))/2;check(Number.isInteger(count)&&count>0,'Opcode17 shape');mi=count*2+1;
    for(let i=0;i<count;i++){const p=a[i*2]>>>0,kind=p>>>16,raw=p&65535,id=kind===2&&raw>0x3ff?raw+0x6fa:raw;check([1,2].includes(kind)&&Object.hasOwn(origin.storyBits,id)&&typeof origin.storyBits[id]==='boolean','Missing/unknown story bit');pass=pass&&origin.storyBits[id]===Boolean(a[i*2+1]);}
    pass=pass&&modePass(a[mi-1]);
   }else throw Error('Unsupported placement opcode '+op);
   check(c.args.slice(0,mi+2).every(x=>x.type===1),'Integer placement controls required');
   const target=a[mi]>>>0,id=(a[mi+1]>>>0)&255,hasPosition=n>mi+2;let action='condition-failed';
   if(op===3&&target!==source.mapId)action='other-map-noop';
   else if(pass){if(target!==source.mapId||!hasPosition){nodes.delete(id);action='conditional-remove';}
    else{const alternatives=nodes.get(id)??[];alternatives.push({id,sourceCallIndex:c.index,sourceCallOffset:c.offset});nodes.set(id,alternatives);action='conditional-insert-or-ranked-alternative';}
    if(target===source.mapId){if(op===14)quest8=a[0];if(op===21)quest4=a[0];}}
   decisions.push({callIndex:c.index,opcode:op,targetMapId:target,id,hasPosition,predicatePass:pass,action});
  }
  result.placementCandidates=[...nodes].map(([id,alternatives])=>({id,alternatives}));
  const d=projectNpcDefinitions({mapId:source.mapId,calls:source.npc.npc.calls,placementNodes:result.placementCandidates});check(d.projectionResolved,d.reason);
  result.definitions=d.conditionalDefinitions;result.definitionDecisions=d.definitionDecisions;result.resolved=true;
 }catch(error){result.reason=error.message;}
 return result;
}

export function projectMapEntry(source,origin,kernel){
 const draws=[],phases=[],membership=deriveMapEntryMembership(source,origin);let seed=origin?.seed;
 const finish=(resolved,reason,boundary=null)=>({schema:'dq9-map-entry-projection-v1',resolved,reason,boundary,epoch:origin?.epoch,originFrame:origin?.frame,fromMapId:origin?.mapId,toMapId:source?.mapId,
  seedBefore:origin?.seed,seedAfter:seed,conditionalConsumed:draws.length,provedMinimumAT:0,maximumActualAT:null,bootProof:false,worldResolved:false,draws,phases,membership,
  conditions:['source loader follows ordinary C01 phase order with no intervening seed setter/other AT','treasure load and valid source-ordered construction complete','NPC setup/controller/ordinary-actor allocations valid and complete; later resource failures can stop the list','source predicates unchanged until read'],
  firstActualUnknown:'destination loader progression and allocation outcomes; prediction is a conditional local sequence',unknownSuffix:['normal controller clock/invocations','NPC nonordinary branches','interaction and other world consumers']});
 const draw=(consumer,lr,fields)=>{const before=seed,[next,r]=ARand(BigInt(seed));seed=Number(next);const row={ordinal:draws.length+1,phase:'npc-construction',consumer,entryPC:0x02003c30,returnPC:0x02003c54,lr,before,after:seed,random:Number(r),...fields};draws.push(row);return row;};
 try{
  check(uint(seed),'Origin seed required');check(membership.resolved,membership.reason);
  check(source.phaseOrder?.join(',')==='treasure-entry,npc-construction','Unsupported source phase order');
  check(source.treasure,'Treasure/list-clear source boundary: '+source.treasureBoundary);
  const tr=new TreasureEntryKernel(kernel).consume({seed,position:0},source.treasure,{loadComplete:true});
  for(const o of tr.outputs){if(o.consumed){const pair=kernel.generate(seed,0n,1);draws.push({ordinal:draws.length+1,phase:'treasure-entry',consumer:`treasure-kind${o.kind??1}`,entryPC:0x02003c30,returnPC:0x02003c54,lr:0x02031eb4,before:seed,after:pair[0],random:pair[1],entryId:o.entryId,sourceOrder:o.sourceOrder,output:o});seed=pair[0];}}
  phases.push({phase:'treasure-entry',conditionalConsumed:tr.consumed,outputs:tr.outputs,physicalBlueIdentityKnown:false});
  if(!tr.resolved)return finish(false,tr.reason,{phase:'treasure-entry',reason:tr.reason});
  const first=draws.length;
  for(const d of membership.definitions){
   const init=draw('npc-controller-initialize',0x020409d0,{npcId:d.storedId,kind:d.kind,sourceCallIndex:d.sourceCallIndex});init.threshold=init.random%2000+2000;
   if([0,1].includes(d.kind)){const actor=draw('npc-ordinary-actor-initialize',0x0203ccf0,{npcId:d.storedId,kind:d.kind,sourceCallIndex:d.sourceCallIndex});actor.actorPhase=Math.trunc(Math.fround(Math.fround((actor.random%200)/100)*4096));}
   else if(d.kind!==2)return finish(false,'Nonordinary NPC kind needs additional branch closure',{phase:'npc-construction',npcId:d.storedId,kind:d.kind,afterClosedConditionalControllerDraw:true});
  }
  phases.push({phase:'npc-construction',definitions:membership.definitions.length,conditionalConsumed:draws.length-first});
  phases.push({phase:'pickup-entry',conditionalConsumed:0,reason:'C01 map-code gate rejects ordinary F/R01M07 materializer; retained resource/list and other consumers remain outside this statement'});
  return finish(true,'Source predicates and supported treasure/NPC initializer sequence projected under explicit loader/heap conditions');
 }catch(error){return finish(false,error.message,{phase:phases.at(-1)?.phase??'membership'});}
}
