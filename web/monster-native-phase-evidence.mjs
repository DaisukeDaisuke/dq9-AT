// Candidate-local lossless references for NEW fractional phase failure conditions only.
// Original failure occurrences and explicit winning poses are never rewritten.
const need=(v,m)=>{if(!v)throw Error(m);},clone=v=>structuredClone(v);
const FRAME_KEYS=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const freeze=v=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;};
export function validateNativePhaseEvidence(table,binding){
 need(table?.kind==='candidate-native-phase-conditions-v1'&&Array.isArray(table.conditions),'Native phase condition table unavailable');
 for(const key of FRAME_KEYS)need(binding.frame?.[key]!==undefined&&binding.frame[key]!==null&&table.binding?.frame?.[key]===binding.frame[key],'Native phase condition frame differs: '+key);
 for(const key of ['branchId','modelId','regionId'])if(binding[key]!==undefined)need(table.binding?.[key]===binding[key],'Native phase condition owner differs: '+key);
 need(/^[a-f0-9]{64}$/.test(table.binding.frame.romSHA256)&&/^[a-f0-9]{64}$/.test(table.binding.frame.fullRGBA_SHA256),'Native phase condition source hashes required');
 return table;
}
export function createNativePhaseEvidence(binding){
 const table={kind:'candidate-native-phase-conditions-v1',binding:freeze(clone(binding)),conditions:[]};validateNativePhaseEvidence(table,binding);return{table,indices:new Map()};
}
export function referenceNativePhaseFailure(state,record){
 const condition=record?.pose?.phaseCondition;if(!condition)return record;
 need(condition.kind==='conditional-source-native-FX12-phase'&&/^[a-f0-9]{64}$/.test(condition.resourceSHA256),'Source-bound native phase condition required');
 need(!Object.hasOwn(record.pose,'phaseConditionRef'),'Native phase failure has two condition forms');
 const text=JSON.stringify(condition);let index=state.indices.get(text);if(index===undefined){index=state.table.conditions.length;state.indices.set(text,index);state.table.conditions.push(freeze(clone(condition)));}
 // Replace at the same property position so expansion also preserves JSON order.
 const pose=Object.fromEntries(Object.entries(record.pose).map(([key,value])=>key==='phaseCondition'?['phaseConditionRef',{kind:'candidate-native-phase-condition-reference',index}]:[key,value]));return{...record,pose};
}
export function expandNativePhaseFailure(record,table,binding){
 const ref=record?.pose?.phaseConditionRef;if(!ref)return clone(record);validateNativePhaseEvidence(table,binding);
 need(ref.kind==='candidate-native-phase-condition-reference'&&Number.isSafeInteger(ref.index)&&ref.index>=0&&ref.index<table.conditions.length&&!Object.hasOwn(record.pose,'phaseCondition'),'Native phase condition reference unavailable');
 return clone({...record,pose:Object.fromEntries(Object.entries(record.pose).map(([key,value])=>key==='phaseConditionRef'?['phaseCondition',table.conditions[ref.index]]:[key,value]))});
}
