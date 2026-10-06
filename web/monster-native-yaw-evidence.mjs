// Candidate-local lossless references for NEW yaw failure conditions only.
// Original failure occurrences and explicit winning poses are never rewritten.
const need=(v,m)=>{if(!v)throw Error(m);},clone=v=>structuredClone(v);
const FRAME_KEYS=['romSHA256','recordKey','sourceId','sourceEpoch','timelineSegment','mediaTime','fullRGBA_SHA256'];
const freeze=v=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;};
export function validateNativeYawEvidence(table,binding){
 need(table?.kind==='candidate-native-yaw-conditions-v1'&&Array.isArray(table.conditions),'Native yaw condition table unavailable');
 for(const key of FRAME_KEYS)need(binding.frame?.[key]!==undefined&&binding.frame[key]!==null&&table.binding?.frame?.[key]===binding.frame[key],'Native yaw condition frame differs: '+key);
 for(const key of ['branchId','modelId','regionId'])if(binding[key]!==undefined)need(table.binding?.[key]===binding[key],'Native yaw condition owner differs: '+key);
 need(/^[a-f0-9]{64}$/.test(table.binding.frame.romSHA256)&&/^[a-f0-9]{64}$/.test(table.binding.frame.fullRGBA_SHA256),'Native yaw condition source hashes required');
 return table;
}
export function createNativeYawEvidence(binding){
 const table={kind:'candidate-native-yaw-conditions-v1',binding:freeze(clone(binding)),conditions:[]};validateNativeYawEvidence(table,binding);return{table,indices:new Map()};
}
export function referenceNativeYawFailure(state,record){
 const condition=record?.pose?.yawCondition;if(!condition)return record;
 need(condition.kind==='conditional-native-emitted-yaw-class'&&/^[a-f0-9]{64}$/.test(condition.source?.tableSHA256),'Source-bound native yaw condition required');
 need(!Object.hasOwn(record.pose,'yawConditionRef'),'Native yaw failure has two condition forms');
 const text=JSON.stringify(condition);let index=state.indices.get(text);if(index===undefined){index=state.table.conditions.length;state.indices.set(text,index);state.table.conditions.push(freeze(clone(condition)));}
 // Replace at the same property position so expansion also preserves JSON order.
 const pose=Object.fromEntries(Object.entries(record.pose).map(([key,value])=>key==='yawCondition'?['yawConditionRef',{kind:'candidate-native-yaw-condition-reference',index}]:[key,value]));return{...record,pose};
}
export function expandNativeYawFailure(record,table,binding){
 const ref=record?.pose?.yawConditionRef;if(!ref)return clone(record);validateNativeYawEvidence(table,binding);
 need(ref.kind==='candidate-native-yaw-condition-reference'&&Number.isSafeInteger(ref.index)&&ref.index>=0&&ref.index<table.conditions.length&&!Object.hasOwn(record.pose,'yawCondition'),'Native yaw condition reference unavailable');
 return clone({...record,pose:Object.fromEntries(Object.entries(record.pose).map(([key,value])=>key==='yawConditionRef'?['yawCondition',table.conditions[ref.index]]:[key,value]))});
}
