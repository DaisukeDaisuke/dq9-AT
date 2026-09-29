import {ARand} from './vendor/arand-reference.mjs';
const hex=n=>'0x'+(Number(n)>>>0).toString(16).padStart(8,'0');
export function parseSeed(value){let n;try{if(!/^(?:0x[\da-f]{1,8}|\d{1,10})$/i.test(String(value).trim()))throw Error();n=BigInt(String(value).trim());}catch{throw Error('既知initial AT seedを0x付き16進数または10進数で入力してください');}if(n<0n||n>0xffffffffn)throw Error('seedは32bit unsignedです');return Number(n);}
export function atRandomInt(random,max){if(!Number.isInteger(random)||random<0||random>32767||!Number.isInteger(max)||max<1||max>32767)throw Error('ATRandInt input outside confirmed positive range');return Math.trunc(max*((random-1)/32767));}
export class ATKernel {
 constructor(instance){this.e=instance.exports;this.heap=Number(this.e.__heap_base.value);if(!this.e.at_advance)throw Error('AT対応WASMがありません。ビルドを更新してください');}
 seedAt(seed,position){position=BigInt(position);if(position<0n||position>0xffffffffffffffffn)throw Error('AT index outside64bit');return this.e.at_advance(seed,position)>>>0;}
 generate(seed,position,count){if(!Number.isInteger(count)||count<1||count>1000000)throw Error('探索窓は1..1000000です');const p=this.heap,size=count*8;if(p+size>this.e.memory.buffer.byteLength)this.e.memory.grow(Math.ceil((p+size-this.e.memory.buffer.byteLength)/65536));const before=this.seedAt(seed,position);this.e.at_generate(before,count,p);return new Uint32Array(this.e.memory.buffer,p,count*2).slice();}
}
export function selectFieldTables(rows,timeValue,areaMask){const eligible=rows.filter(r=>{const mode=(r.flags>>>0)&7;return (mode!==0||timeValue!==0)&&(mode!==1||timeValue===0);});const preferred=eligible.filter(r=>{const mask=(r.flags>>>13)&255;return !mask||!!(mask&areaMask);});return (preferred.length?preferred:eligible).map(r=>r.tableId);}
export function monsterForRandom(table,random){const n=atRandomInt(random,Number(table.maxRand));const matches=table.data.filter(m=>n>=Number(m.start)&&n<=Number(m.end));if(matches.length!==1||matches[0].trapMonster)return {value:n,monster:null,reason:matches.some(m=>m.trapMonster)?'trap-rule-unresolved':'table-interval-unresolved'};return {value:n,monster:matches[0]};}
export class ATSession {
 constructor(seed,kernel){this.seed=parseSeed(seed);this.kernel=kernel;this.lowerBound=0n;this.conditionalBound=0n;this.createdAt=new Date().toISOString();this.events=[];this.ids=new Set();this.map=null;this.candidates=null;this.hypotheses=[];}
 setMap(map){this.map=map;this.events.push({kind:'map-context',map,lowerBound:String(this.lowerBound)});}
 noteInput(input){this.events.push({kind:'human-input',input,lowerBound:String(this.lowerBound),minimumProvenCalls:0});}
 observeMonster({id,tableId,monsterId,source='human',naturalConfirmed=false},tables,window=50000){
  if(!id||this.ids.has(id))throw Error('観測IDが空または重複です。同じ出現を二重加算しません');
  const table=tables[String(tableId)];if(!table)throw Error('既存enc.jsonにテーブルがありません');
  const entry=table.data.find(m=>Number(m.monsterId)===Number(monsterId));if(!entry||entry.trapMonster)throw Error('このmonsterは通常weighted選択として処理できません');
  // A visible monster alone does not prove the natural weighted path. Keep a separate conditional branch.
  const before=this.conditionalBound,min=naturalConfirmed?2n:1n,start=before+min-1n,pairs=this.kernel.generate(this.seed,start,window),positions=[];
  for(let i=0;i<window;i++){const r=monsterForRandom(table,pairs[i*2+1]);if(Number(r.monster?.monsterId)===Number(monsterId))positions.push(String(start+BigInt(i+1)));}
  const first=positions.length?BigInt(positions[0]):start+BigInt(window)+1n;
  this.conditionalBound=first;this.ids.add(id);
  this.candidates={observationId:id,kind:'last-weighted-draw-position',searchedFrom:String(start+1n),searchedThrough:String(start+BigInt(window)),positions,unsearchedTailFrom:String(start+BigInt(window)+1n),tailPossible:true,currentMayBeLater:true};
  const event={kind:'monster-observation',id,tableId:Number(tableId),monsterId:Number(monsterId),source,naturalConfirmed,window,conditionalBefore:String(before),conditionalAfter:String(first),provenLowerBound:String(this.lowerBound),condition:'observation corresponds to a distinct chronological weighted draw from this table; naturalConfirmed additionally assumes the natural field path',map:this.map};
  this.events.push(event);this.hypotheses.push(event);return this.snapshot();
 }
 ingestBootTrace(trace){
  // Only a contiguous exec stream explicitly originating at the external known boot seed can move the proof bound.
  if(trace.origin!=='boot-known-initial'||Number(trace.initialSeed)!==this.seed||trace.startPosition!=='0')throw Error('起動からの既知seed traceが必要です。途中state観測を起動証明へ変換しません');
  let seed=BigInt(this.seed),count=0n;
  for(const item of trace.updates){const before=seed,[after,random]=ARand(seed);if(BigInt(item.before)!==before||BigInt(item.after)!==after||BigInt(item.random)!==random||BigInt(item.sequence)!==count+1n)throw Error('AT exec連続性が途切れています。既存下限は保持します');seed=after;count++;}
  if(count<this.lowerBound)throw Error('古いtraceで下限を後退させません');
  this.lowerBound=count;this.conditionalBound=this.conditionalBound<count?count:this.conditionalBound;
  this.events.push({kind:'verified-boot-exec-prefix',count:String(count),finalSeed:hex(seed),source:trace.source??null,trace:structuredClone(trace)});return this.snapshot();
 }
 static restore(saved,kernel,tables){
  if(saved?.format!=='dq9-at-session'||saved.version!==1||!Array.isArray(saved.events))throw Error('対応する保存セッションではありません');
  const s=new ATSession(saved.initialSeed,kernel);s.createdAt=saved.createdAt;
  for(const event of saved.events){
   if(event.kind==='map-context')s.setMap(event.map);
   else if(event.kind==='human-input')s.noteInput(event.input);
   else if(event.kind==='monster-observation')s.observeMonster(event,tables,event.window??50000);
   else if(event.kind==='verified-boot-exec-prefix'){if(!event.trace)throw Error('起動traceが保存されていないため下限を再評価できません');s.ingestBootTrace(event.trace);}
   else throw Error('未対応の証拠イベント: '+event.kind);
  }
  if(String(s.lowerBound)!==saved.lowerBound||String(s.conditionalBound)!==saved.conditionalBound)throw Error('保存値と証拠の再評価結果が一致しません');
  return s;
 }
 forecast(tables,tableIds,targetIds,window=50000,{conditional=false}={}){
  const start=conditional?this.conditionalBound:this.lowerBound,pairs=this.kernel.generate(this.seed,start,window),targets=new Set(targetIds.map(Number)),results=[];
  for(const tableId of tableIds){const table=tables[String(tableId)];if(!table)continue;const hits=[];for(let i=0;i<window;i++){const outcome=monsterForRandom(table,pairs[i*2+1]);if(outcome.monster&&targets.has(Number(outcome.monster.monsterId))){hits.push({position:String(start+BigInt(i+1)),offset:i+1,seed:hex(pairs[i*2]),random:pairs[i*2+1],value:outcome.value,monsterId:Number(outcome.monster.monsterId),monsterName:outcome.monster.monsterName});if(hits.length===20)break;}}results.push({tableId:Number(tableId),hits});}
  return {basis:conditional?'conditional-observation-branch':'proven-lower-bound',from:String(start+1n),through:String(start+BigInt(window)),results,unsearchedTailPossible:true,interpretation:'These are favorable weighted-draw positions, not a guaranteed current position or a frame countdown. Table-selection and monster-movement AT must also be modeled.'};
 }
 snapshot(){return {format:'dq9-at-session',version:1,initialSeed:hex(this.seed),origin:'external-known-seed-from-boot',createdAt:this.createdAt,lowerBound:String(this.lowerBound),conditionalBound:String(this.conditionalBound),map:this.map,candidates:this.candidates,events:this.events,exactCurrentPosition:false,unboundedFuturePossible:true};}
}
export function replayObservedTrace(observation,kernel,tables){
 const pairs=kernel.generate(Number(observation.startSeed),0n,observation.updates.length),mismatches=[];let seed=BigInt(observation.startSeed);
 for(let i=0;i<observation.updates.length;i++){const [sequence,after,random]=observation.updates[i],[next,expected]=ARand(seed);if(sequence!==i+1||Number(next)!==after||Number(expected)!==random||pairs[2*i]!==after||pairs[2*i+1]!==random)mismatches.push({kind:'UpdateAT',sequence});seed=next;}
 for(const [sequence,max,result] of observation.intCalls){const random=pairs[2*(sequence-1)+1],actual=atRandomInt(random,max),wasm=kernel.e.at_randint(random,max);if(actual!==result||wasm!==result)mismatches.push({kind:'ATRandInt',sequence,result,actual,wasm});}
 const spawns=[];for(const [sequence,monsterId,tableId,mapId] of observation.spawnCreationEntries){const outcome=monsterForRandom(tables[String(tableId)],pairs[2*(sequence-1)+1]);const agrees=Number(outcome.monster?.monsterId)===monsterId;if(!agrees)mismatches.push({kind:'spawn',sequence,monsterId,actual:outcome.monster?.monsterId});spawns.push({sequence,monsterId,tableId,mapId,value:outcome.value,agrees});}
 return {format:'dq9-at-replay-result',sourceOrigin:observation.origin,updates:observation.updates.length,intCalls:observation.intCalls.length,spawns,mismatches,finalSeed:hex(seed),bootProof:false};
}
