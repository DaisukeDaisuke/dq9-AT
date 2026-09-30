import {monsterForRandom} from './at-core.mjs';
// Strict pure leaf decisions for the navigator. Unobserved runtime state remains unknown.
export class FieldATKernel {
 constructor(kernel){this.kernel=kernel;this.e=kernel.e;if(!this.e.field_table_candidates)throw Error('フィールドAT対応WASMをビルドしてください');}
 tableCandidates(rows,timeValue,areaMask){
  if(!Number.isInteger(timeValue)||!Number.isInteger(areaMask))throw Error('time/areaが不明です');
  if(rows.some(r=>!Number.isInteger(r.flags)))throw Error('未解析のtable flagsは選択できません');
  const p=this.kernel.heap,n=rows.length;this.reserve(n*8);const memory=new Uint32Array(this.e.memory.buffer,p,n*2);memory.set(rows.map(r=>r.flags>>>0));const count=this.e.field_table_candidates(p,n,timeValue,areaMask,p+n*4);return Array.from(new Uint32Array(this.e.memory.buffer,p+n*4,count),i=>rows[i]);
 }
 reserve(bytes){const size=this.kernel.heap+bytes;if(size>this.e.memory.buffer.byteLength)this.e.memory.grow(Math.ceil((size-this.e.memory.buffer.byteLength)/65536));}
 movement({graph,currentIndex,armed,currentOccupied,occupiedIndices,tableAreaMask,seed,position}){
  const node=graph?.nodes[currentIndex];if(!node||!node.neighbors.length)return {resolved:true,consumed:0,nodeId:node?.id??null,nextIndex:currentIndex,reason:'no-neighbor'};
  if(typeof armed!=='boolean')return {resolved:false,minimumConsumed:0,reason:'runtime movement flag 0x40 is unknown'};
  if(!armed){if(typeof currentOccupied!=='boolean')return {resolved:false,minimumConsumed:0,reason:'current-node occupancy unknown'};return {resolved:true,consumed:0,nodeId:node.id,nextIndex:currentIndex,nextArmed:!currentOccupied,outputFlag:currentOccupied?1:0,reason:'initial-current-node-return'};}
  if(!Number.isInteger(tableAreaMask)||!occupiedIndices)return {resolved:false,minimumConsumed:0,reason:'movement table area or occupancy unknown'};
  const neighbors=node.neighbors.map(i=>graph.nodes[i]),n=neighbors.length,p=this.kernel.heap;this.reserve(n*12);
  const memory=new Uint32Array(this.e.memory.buffer,p,n*3);memory.set(neighbors.map(x=>x.areaMask));memory.set(node.neighbors.map(i=>occupiedIndices[i]===true?1:occupiedIndices[i]===false?0:2),n);
  const count=this.e.field_neighbor_candidates(p,p+n*4,n,tableAreaMask,p+n*8);if(count<0)return {resolved:false,minimumConsumed:0,reason:'eligible-neighbor occupancy unknown'};
  if(!count)return {resolved:true,consumed:0,nodeId:node.id,nextIndex:currentIndex,reason:'no-unoccupied-eligible-neighbor'};
  const order=Array.from(new Uint32Array(this.e.memory.buffer,p+n*8,count));
  const [nextSeed,random]=this.kernel.generate(seed,position,1),selected=order[this.e.field_movement_index(random,count)],nextIndex=node.neighbors[selected];
  return {resolved:true,consumed:1,nodeId:graph.nodes[nextIndex].id,nextIndex,nextSeed,random,eligibleIndices:order.map(i=>node.neighbors[i]),reason:'direct-UpdateAT-modulo-not-ATRandInt'};
 }
 naturalTail({seed,position,rows,timeValue,areaMask,weightedReached},tables){
  const candidates=this.tableCandidates(rows,timeValue,areaMask);if(!candidates.length)return {resolved:true,consumed:0,reason:'no-time-eligible-table'};
  const pairs=this.kernel.generate(seed,position,2),index=this.e.at_randint(pairs[1],candidates.length),row=candidates[index];
  if(!row)return {resolved:false,minimumConsumed:1,reason:'table-selection index outside resolved domain'};
  const selection={tableId:row.tableId,tableSeed:pairs[0],tableRandom:pairs[1],candidates:candidates.map(r=>r.tableId),delayThreshold:(7-((row.flags>>>21)&15))*1000};
  if(weightedReached!==true)return {...selection,resolved:weightedReached===false,consumed:weightedReached===false?1:undefined,minimumConsumed:1,reason:weightedReached===false?'table-only-attempt':'weighted-branch-unobserved'};
  const table=tables[String(row.tableId)];if(!table)return {...selection,resolved:false,minimumConsumed:1,reason:'existing-enc-distribution-missing'};
  const outcome=monsterForRandom(table,pairs[3]);return {...selection,resolved:!!outcome.monster,consumed:2,monsterSeed:pairs[2],monsterRandom:pairs[3],...outcome,creationSuccessUnknown:true};
 }
 forecastNaturalTails({seed,position,rows,areaMasks,timeValues,targetIds,window=50000},tables){
  if(!Number.isInteger(window)||window<2||window>1000000)throw Error('探索窓は2..1000000です');
  const targets=new Set(targetIds.map(Number)),scenarios=[];
  // Candidate lists are fixed by the explicitly supplied map/area/time scenario.
  for(const areaMask of areaMasks)for(const timeValue of timeValues){const candidates=this.tableCandidates(rows,timeValue,areaMask);scenarios.push({areaMask,timeValue,candidates,hits:[],unavailableTables:candidates.filter(r=>!tables[String(r.tableId)]).map(r=>r.tableId)});}
  const pairs=this.kernel.generate(seed,position,window);
  for(const s of scenarios){if(!s.candidates.length)continue;for(let i=0;i<window-1&&s.hits.length<20;i++){const row=s.candidates[this.e.at_randint(pairs[i*2+1],s.candidates.length)],table=tables[String(row?.tableId)];if(!table)continue;const o=monsterForRandom(table,pairs[(i+1)*2+1]);if(o.monster&&targets.has(Number(o.monster.monsterId)))s.hits.push({tablePosition:String(BigInt(position)+BigInt(i+1)),monsterPosition:String(BigInt(position)+BigInt(i+2)),offset:i+1,tableId:row.tableId,monsterId:Number(o.monster.monsterId),monsterName:o.monster.monsterName,value:o.value});}}
  return {format:'dq9-natural-tail-forecast',basis:'conditional-on-reaching-table-then-weighted-tail',scenarios:scenarios.map(s=>({...s,candidates:s.candidates.map(r=>r.tableId)})),unsearchedTailPossible:true,frameTimingKnown:false,interpretation:'Candidate table+weighted tails only. Earlier failed attempts, movement draws, occupancy, camera and input scheduling are not skipped or asserted zero. No live movement instruction or proven lower-bound increment.'};
 }
}
