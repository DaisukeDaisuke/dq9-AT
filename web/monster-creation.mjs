// Partial natural creator projection. Unknown preconditions suspend; no observed
// creation result, next position, resource result or post-serial is an input.
import {deriveNaturalFreeSlot} from './field-inventory.mjs';
const u32=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
const u16=n=>Number.isInteger(n)&&n>=0&&n<=65535;
const i16=n=>Number.isInteger(n)&&n>=-32768&&n<=32767;
const byte=n=>Number.isInteger(n)&&n>=0&&n<=255;
export const isKnownCreatorType1=c=>Object.hasOwn(c??{},'typeWord')?c.typeWord===1&&!Object.hasOwn(c,'tag'):c?.tag?.knownMask===0x1ff&&c.tag.value===1&&Object.keys(c.tag).length===2;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const xyz=a=>dense(a)&&a.length===3&&a.every(n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647);
const no=reason=>({resolved:false,reason,creationProjectionResolved:false,worldStepResolved:false,minimumATConsumed:0});

/** Native021a23d4. All typed results are required; inactive actors still reserve
 * serials. The chosen pool slot has already undergone source reset at this
 * point, so its serial is derived as zero rather than read from stale memory. */
export function deriveMonsterCreationSerial(input,{resetSlot,resetPointer}={}){
 if(!u16(input?.counter)||!dense(input.slots)||input.slots.length!==48||!dense(input.external)||input.external.length!==4)return no('complete serial counter/48 typed slots/four external records required');
 if(!Number.isInteger(resetSlot)||resetSlot<112||resetSlot>=160||!u32(resetPointer)||!resetPointer)return no('chosen reset slot/pointer required');
 const slots=new Map(),external=new Map(),serialByPointer=new Map();
 for(const r of input.slots){if(!r||!Number.isInteger(r.slot)||r.slot<112||r.slot>=160||slots.has(r.slot)||r.known!==true||!u32(r.pointer)||(r.pointer&&!u16(r.serial)))return no('unknown/duplicate typed serial record');if(r.pointer&&serialByPointer.has(r.pointer)&&serialByPointer.get(r.pointer)!==r.serial)return no('conflicting aliased serial records');if(r.pointer)serialByPointer.set(r.pointer,r.serial);slots.set(r.slot,r);}
 for(const r of input.external){if(!r||!Number.isInteger(r.index)||r.index<0||r.index>=4||external.has(r.index)||!u16(r.serial))return no('unknown/duplicate external serial record');external.set(r.index,r);}
 if(slots.get(resetSlot)?.pointer!==resetPointer)return no('serial registry differs from reset object');
 const attempts=[];let candidate=input.counter;
 // At most52 occupied values; this bound covers the entire native domain,
 // rather than silently imposing a retry budget or choosing a colliding value.
 for(let n=0;n<=0x7ff8;n++){
  if(candidate>0x7ff7)candidate=1;
  let duplicateSlot=null,externalIndex=null;
  for(let slot=112;slot<160;slot++){const r=slots.get(slot);if(r.pointer&&(r.pointer===resetPointer?0:r.serial)===candidate){duplicateSlot=slot;break;}}
  if(duplicateSlot===null)for(let i=0;i<4;i++)if(external.get(i).serial===candidate){externalIndex=i;break;}
  attempts.push({candidate,duplicateSlot,externalIndex});
  if(duplicateSlot===null&&externalIndex===null)return {resolved:true,serial:candidate,counterAfter:(candidate+1)&65535,attempts,atConsumed:0};
  candidate=(candidate+1)&65535;
 }
 return no('serial domain exhausted');
}

/** Native upper-mid binary lookup and linked AI lookup, from raw descriptors.
 * Complete containers are deliberately required for this initial contract. */
export function deriveMonsterCreationResources(species,resources){
 if(!Number.isInteger(species)||species<0||species>4095)return no('weighted species outside supported native domain');
 const model=resources?.models,ai=resources?.ai;
 if(!Number.isInteger(model?.declaredCount)||model.declaredCount<0||model.declaredCount>4095||!u32(model.basePointer)||!dense(model.entries)||model.entries.length!==model.declaredCount)return no('complete model descriptor array required');
 for(let i=0;i<model.entries.length;i++){const r=model.entries[i];if(!r||r.pointer!==model.basePointer+i*20||!u32(r.pointer)||!i16(r.speciesKey)||!i16(r.widthShort)||!i16(r.heightShort))return no('invalid model descriptor/range');}
 let lo=0,hi=model.declaredCount-1,found=null;const modelVisits=[];
 while(model.basePointer!==0&&lo<=hi){const mid=lo+((hi-lo+1)>>1),r=model.entries[mid];modelVisits.push(mid);if(r.speciesKey===species){found=r;break;}if(species<r.speciesKey)hi=mid-1;else lo=mid+1;}
 if(!u32(ai?.head)||!dense(ai.records))return no('AI list context required');
 const records=new Map();for(const r of ai.records){if(!r||!u32(r.pointer)||!r.pointer||records.has(r.pointer)||!u32(r.next)||!i16(r.species)||!u32(r.flags)||!byte(r.byte2)||!Number.isInteger(r.signedByte3)||r.signedByte3< -128||r.signedByte3>127)return no('invalid AI descriptor');records.set(r.pointer,r);}
 let ptr=ai.head,selected=null;const aiVisits=[],seen=new Set();
 while(ptr){if(seen.has(ptr)||!records.has(ptr))return no('AI list cycle or missing linked descriptor');seen.add(ptr);const r=records.get(ptr);aiVisits.push(ptr);if(r.species===species){selected=r;break;}ptr=r.next;}
 return {resolved:true,model:found?structuredClone(found):null,ai:selected?structuredClone(selected):null,modelVisits,aiVisits,atConsumed:0};
}

/** Reached021a2bb8 bounded current-map path. The caller supplies an actual
 * candidate and hero pre-position; normalize/atan precedes terrain. Return
 * failure0 is distinct from unknown, and success does not support future
 * state0/mode5 updates or make the visual state complete. */
export function projectMonsterCreation(request,context,kernel){
 const fail=reason=>({resolved:true,creationProjectionResolved:true,created:false,result:0,reason,atConsumed:0,worldStepResolved:false});
 if(context?.creatorReached!==true||context.globalWord!==0||!u16(request?.mapId)||!Number.isInteger(request.species)||request.species<0||request.species>4095||!u16(request.tableId)||!byte(request.nodeId)||request.routeFlags!==0||!xyz(request.candidateXYZ)||!xyz(context.heroXYZ)||!u32(context.controllerPointer)||!context.controllerPointer)return no('supported natural current-map creator entry required');
 if(!u16(context.managerMapId)||context.managerMapId!==request.mapId||!dense(context.fields)||context.fields.length!==4)return no('complete current-map field binding required');
 let field=null;for(let index=0;index<4;index++){const f=context.fields[index];if(!f||f.index!==index||!u16(f.mapId)||!u32(f.pointer)||!f.pointer)return no('unknown field lookup primitive');if(f.mapId===request.mapId){field=f;break;}}
 if(!field)return fail('native field lookup absent');
 if(!u16(field.flags)||!u16(field.creationCounter))return no('field group/counter unknown');
 if(field.resources?.models?.containerPointer!==field.pointer+0x2f4||field.resources?.ai?.containerPointer!==field.pointer+0x300||field.tables?.containerPointer!==field.pointer+0x5c)return no('resource/table containers not bound to selected field');
 const resources=deriveMonsterCreationResources(request.species,field.resources);if(!resources.resolved)return resources;
 if(!resources.model||!resources.ai)return {...fail('native model or AI lookup absent'),resources};
 if(!dense(context.inventory?.slots)||context.inventory.slots.some(r=>!r||!Number.isInteger(r.slot))||new Set(context.inventory.slots.map(r=>r.slot)).size!==context.inventory.slots.length)return no('valid generic slot inventory required');
 let allocation;try{allocation=deriveNaturalFreeSlot(context.inventory,{group:field.flags&3});}catch{return no('invalid natural inventory');}
 if(!allocation.resolved)return no('first free slot unresolved');if(allocation.freeSlot<0)return {...fail('native allocator exhausted'),allocation};
 const slot=allocation.freeSlot,record=context.inventory.slots.find(r=>r.slot===slot);
 if(!u16(record?.headerFlags))return no('chosen typed-monster header unknown');
 if(!(record.headerFlags&0x20))return {...fail('chosen generic slot not typed monster'),allocation};
 // Optional generic template lookup uses signed species, no active/type filter.
 if(!dense(context.templates))return no('generic template lookup prefix required');
 let template=null;for(let index=0;index<12;index++){const t=context.templates[index];if(!t||t.slot!==7+index||t.registryKnown!==true||!u32(t.pointer))return no('template prefix incomplete');if(t.pointer){if(!i16(t.species))return no('template species unknown');if(t.species===request.species){template=t;break;}}}
 if(!template)return no('template-absent animation path outside supported projection');
 const visual=template.visualContext;
 if(!u32(template.modelPointer)||!template.modelPointer||!u32(template.componentListPointer)||!template.componentListPointer||!u16(template.actor178)||visual?.complete!==true||!dense(visual.components)||!visual.components.length)return no('complete selected template component context required');
 let component=template.componentListPointer;const componentSet=new Set();
 for(const c of visual.components){if(!c||c.pointer!==component||!u32(c.pointer)||!c.pointer||componentSet.has(c.pointer)||!isKnownCreatorType1(c)||!u32(c.next))return no('unsupported or incomplete template component chain');componentSet.add(c.pointer);component=c.next;}
 if(component!==0)return no('template component list incomplete');
 // Caller provides source-enumerated write ranges, not a successful-render
 // result. Every derived visual write must be disjoint from projected storage.
 const layout=visual.layout,protectedRanges=visual.protectedRanges;
 const range=r=>r&&u32(r.start)&&Number.isInteger(r.size)&&r.size>0&&r.size<=0x1000000&&r.start+r.size<=0x100000000;
 if(!layout||layout.modelPointer!==template.modelPointer||!u32(layout.geometryPointer)||!layout.geometryPointer||!u32(layout.materialBlockPointer)||!layout.materialBlockPointer||!byte(layout.geometryCount)||layout.dictionaryCount!==layout.geometryCount||!u16(layout.entryOffset)||layout.entryStride!==4||!dense(layout.records)||layout.records.length!==layout.geometryCount)return no('complete supported model/material dictionary required');
 const ranges=[{start:template.modelPointer+0xa2,size:2}];
 for(let i=0;i<layout.records.length;i++){const r=layout.records[i];if(!r||r.index!==i||!u32(r.relativeMaterialOffset)||r.entryPointer!==layout.materialBlockPointer+8+layout.entryOffset+4*i)return no('material dictionary binding unknown');ranges.push({start:layout.materialBlockPointer+r.relativeMaterialOffset+12,size:4});}
 if(!ranges.every(range)||!dense(protectedRanges)||!protectedRanges.every(range))return no('complete visual write/protected storage ranges required');
 const serialContext=context.serialContext;
 if(!u32(serialContext?.registryAddress)||!serialContext.registryAddress||!dense(serialContext.slots)||serialContext.slots.length!==48||!dense(serialContext.external)||serialContext.external.length!==4)return no('raw serial registry/range context required');
 const rawRanges=[],rawByPointer=new Map();
 for(const r of serialContext.slots){if(!r||!u32(r.rawPointer)||(r.rawPointer&&!u16(r.rawHeader))||r.pointer!==(r.rawPointer&&(r.rawHeader&32)?r.rawPointer:0))return no('raw and typed serial presence inconsistent');if(r.rawPointer){const prior=rawByPointer.get(r.rawPointer);if(prior&&(prior.rawHeader!==r.rawHeader||prior.serial!==r.serial))return no('conflicting aliased raw serial object');rawByPointer.set(r.rawPointer,r);rawRanges.push({start:r.rawPointer,size:0x198});}}
 for(const r of serialContext.external){if(!u32(r?.pointer)||!r.pointer)return no('external serial address unknown');rawRanges.push({start:r.pointer,size:2});}
 const overlaps=(a,b)=>a.start<b.start+b.size&&b.start<a.start+a.size;
 const counterRange={start:0x021d7a94,size:2},fieldCounterRange={start:field.pointer+6,size:2};
 if(overlaps(fieldCounterRange,{start:0x020eee90,size:4})||overlaps(fieldCounterRange,{start:0x020fed44,size:4}))return no('field increment aliases AT/global-mode storage');
 if(rawRanges.some(r=>overlaps(r,counterRange))||overlaps(counterRange,{start:field.pointer,size:0x314})||overlaps(counterRange,{start:serialContext.registryAddress+8+112*4,size:48*4}))return no('serial counter aliases scanned or incremented storage');
 const externalRanges=serialContext.external.map(r=>({start:r.pointer,size:2}));
 if(externalRanges.some((r,i)=>externalRanges.some((other,j)=>j<i&&overlaps(r,other))||rawRanges.some(other=>other.size===0x198&&overlaps(r,other))))return no('external serial storage alias outside supported layout');
 const required=[{start:0x020fed44,size:4},{start:template.modelPointer+0x54,size:4},{start:layout.geometryPointer,size:0x20},{start:layout.materialBlockPointer,size:8+layout.entryOffset+4*layout.geometryCount},...rawRanges,{start:serialContext.registryAddress+8+112*4,size:48*4},{start:resources.model.pointer,size:20},{start:resources.ai.pointer,size:20},{start:template.pointer,size:0xb0},...visual.components.map(c=>({start:c.pointer,size:44})),{start:record.pointer,size:0x198},{start:field.pointer,size:0x314},{start:0x020eee90,size:4},{start:0x021d7a94,size:2}];
 const resetRange={start:record.pointer,size:0x198};
 if(rawRanges.some(r=>r.size===0x198&&r.start!==resetRange.start&&r.start<resetRange.start+resetRange.size&&resetRange.start<r.start+r.size))return no('nonidentical serial objects overlap reset pool record');
 const liveDependencies=[{start:0x020fed44,size:4},{start:field.pointer,size:0x314},{start:0x020eee90,size:4},{start:0x021d7a94,size:2},{start:serialContext.registryAddress+8+112*4,size:48*4},...serialContext.external.map(r=>({start:r.pointer,size:2})),...field.resources.models.entries.map(r=>({start:r.pointer,size:20})),...field.resources.ai.records.map(r=>({start:r.pointer,size:20})),{start:template.pointer,size:0xb0},{start:template.modelPointer,size:0xa4},...visual.components.map(c=>({start:c.pointer,size:44})),{start:layout.geometryPointer,size:0x20},{start:layout.materialBlockPointer,size:8+layout.entryOffset+4*layout.geometryCount}];
 if(!liveDependencies.every(range)||liveDependencies.some(p=>resetRange.start<p.start+p.size&&p.start<resetRange.start+resetRange.size))return no('pool reset aliases live creator dependencies');
 for(const r of required)if(!protectedRanges.some(p=>p.start<=r.start&&p.start+p.size>=r.start+r.size))return no('visual audit omits protected actor/field/AT/serial storage');
 for(const w of ranges)for(const p of protectedRanges)if(w.start<p.start+p.size&&p.start<w.start+w.size)return no('visual write aliases projected state');
 // Selected encounter table is itself looked up from ordered raw rows.
 const tables=field.tables;if(!Number.isInteger(tables?.declaredCount)||tables.declaredCount<0||tables.declaredCount>6||!dense(tables.rows)||tables.rows.length!==tables.declaredCount)return no('complete table container required');
 let row=null;for(const r of tables.rows){if(!r||!u16(r.id))return no('table ID unknown');if(r.id===request.tableId){row=r;break;}}
 let itemScale=4096;if(row){if(!u16(row.declaredCount)||!dense(row.items)||row.items.length!==row.declaredCount)return no('complete selected table items required');for(const item of row.items){if(!item||!u16(item.speciesWord)||!i16(item.scale))return no('table item unknown');if((item.speciesWord&4095)===request.species){itemScale=item.scale;break;}}}
 if(context.graphBindingVerified!==true||!dense(context.graph?.nodes)||context.graph.nodes.length>255||context.graph.nodes.some(n=>!n||!byte(n.id)))return no('ROM graph binding unknown');
 const nodes=context.graph.nodes.map((n,index)=>({...n,index})).filter(n=>n.id===request.nodeId);if(nodes.length!==1)return no('native node-ID/index mapping unresolved');
 if(context.terrain?.mapId!==request.mapId||context.terrain.mapAux444!==0)return no('current-map terrain binding unknown');
 const orientation=kernel.state2EntrySteering(request.candidateXYZ,context.heroXYZ);if(!orientation.resolved)return no(orientation.reason);
 const terrain=kernel.terrainHeight(request.candidateXYZ,context.terrain);if(!terrain.resolved)return no(terrain.reason);
 const serial=deriveMonsterCreationSerial(context.serialContext,{resetSlot:slot,resetPointer:record.pointer});if(!serial.resolved)return serial;
 const scale=Number((BigInt(itemScale)*266n+2048n)>>12n)&65535,ai=resources.ai;
 const actor={header:35,species:request.species,registryIndex:slot,mapId:request.mapId,xyz:[request.candidateXYZ[0],terrain.height,request.candidateXYZ[2]],angle:orientation.targetAngle,targetAngle:orientation.targetAngle,currentNodeIndex:nodes[0].index,targetNodeId:request.nodeId,tableId:request.tableId,serial:serial.serial,width:resources.model.widthShort*4,height:resources.model.heightShort,scaleHalfwords:[scale,scale,scale],state:0,previousState:1,stateTimer:0,activeElapsed:0,updateCounter:0,movementByte:5,previousMovementByte:0,speed:0,actorFlags:4,ai138to13c:[0,3,6,9,12].map(shift=>(ai.flags>>>shift)&7),ai140:ai.byte2,ai144:ai.signedByte3,routeFlags:0,controllerPointer16c:(context.controllerPointer+0x2fe0)>>>0,animationEventIndex:65535,actor178:template.actor178};
 return {resolved:true,creationProjectionResolved:true,created:true,result:slot,actor,animationBinding:{templatePointer:template.pointer,modelPointer:template.modelPointer,componentListPointer:template.componentListPointer,records:visual.components.map(c=>({pointer:c.pointer,...(Object.hasOwn(c,'typeWord')?{typeWord:c.typeWord}:{tag:structuredClone(c.tag)}),nextPointer:c.next})),visualWriteRanges:structuredClone(ranges),protectedRanges:structuredClone(protectedRanges),scope:'creator-validated structural binding; future constancy is an external precondition'},serialCounterAfter:serial.counterAfter,fieldCreationCounterAfter:(field.creationCounter+1)&65535,resources,allocation,templatePointer:template.pointer,orientation,terrain,serial,atConsumed:0,worldStepResolved:false,visualStateResolved:false,futureActorTicksPermitted:false,remaining:['state0/mode5 update','visual/fade and material state','birth-to-world inventory generation integration']};
}
