// Bounded source slice: 0208e9d4/0208f088 construct a source-ordered record list;
// 0208fa7c enumerates enabled slots and writes one phase per successful allocation.
// No frame schedule, loader readiness, terrain projection or runtime allocator.
const u32 = n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const dense = a => Array.isArray(a) && Array.from({length:a.length}, (_, i) => Object.hasOwn(a,i)).every(Boolean);
const require = (yes, reason) => { if (!yes) throw Error(reason); };

export function decodePickupRows(calls) {
  require(dense(calls), 'Complete dense call stream required');
  const rows = [];
  for (const call of calls) {
    require(call && dense(call.args), 'Malformed call');
    if (call.opcode === 100 || call.opcode === 101) {
      require(call.argumentCount === 1 && call.args.length === 1 && call.args[0].type === 0 && u32(call.args[0].raw), 'Malformed metadata call');
      continue;
    }
    require(call.opcode === 102 && call.argumentCount === 32 && call.args.length === 32, 'Unsupported pickup script opcode or argument count');
    require(call.args.every(a => a && a.type === 1 && u32(a.raw)), 'Only integer pickup record arguments are supported');
    require(rows.length < 256, 'Record list exceeds this bounded source contract');
    const args = call.args.map(a => a.raw);
    rows.push({sourceIndex:call.index, groupId:args[0] & 127, itemId:args[1] & 65535,
      kind:args[2] & 3, sourcePointCount:args[7] & 15,
      sourceXYZ:Array.from({length:8}, (_,i) => args.slice(8+i*3,11+i*3).map(v => (v << 12) | 0))});
  }
  return rows;
}

export function projectPickupMaterialization(input, candidateSeed, kernel) {
  let seed = candidateSeed;
  const events = [], rows = [], allocations = [];
  const finish = (resolved, reason, extra={}) => ({resolved, reason, seed:u32(seed)?seed:null,
    consumed:events.length, minimumConsumed:events.length, maximumConsumed:resolved?events.length:null,
    events, rows, allocations, worldResolved:false, frameTimingKnown:false, terrainResolved:false,
    seedReset:false, scope:'Reached 0208fa7c record loop and phase writes only', ...extra});
  try {
    require(u32(seed), 'Explicit candidate seed required');
    for (const key of ['recordLoopReached','completeSourceOrderedRows','runtimeWordsStableUntilRead','sourceRowsBoundToLoadedList','phaseRangeBoundToLoadedDescriptor','noInterveningATConsumers','noSeedSetter']) {
      require(input?.conditions?.[key] === true, 'Unestablished '+key);
    }
    require(dense(input.records) && input.records.length <= 256, 'Complete record list required');
    require(input.runtimeWords && typeof input.runtimeWords === 'object', 'Runtime pickup state words required');
    require(kernel?.generate && kernel?.e?.world_pickup_phase, 'Existing AT and pickup phase kernel required');
    let allocationIndex = 0;
    for (let rowIndex = 0; rowIndex < input.records.length; rowIndex++) {
      const record = input.records[rowIndex];
      require(record && Number.isInteger(record.groupId) && record.groupId >= 0 && record.groupId <= 127, 'Unknown record group ID');
      require(Object.hasOwn(input.runtimeWords, String(record.groupId)) && u32(input.runtimeWords[record.groupId]), 'Unknown runtime state word for group '+record.groupId);
      const word = input.runtimeWords[record.groupId];
      if ((word >>> 31) === 0) {
        rows.push({rowIndex,groupId:record.groupId,active:false,slotCount:0,enabledMask:0});
        continue;
      }
      // Count is dynamic save state, not the ROM point count. Group >=98 forces 8.
      const slotCount = record.groupId >= 98 ? 8 : ((word >>> 9) & 15);
      const enabledMask = (word >>> 17) & 255;
      rows.push({rowIndex,groupId:record.groupId,active:true,slotCount,enabledMask});
      for (let slot = 0; slot < slotCount; slot++) {
        if ((enabledMask & (1 << slot)) === 0) continue;
        let success;
        if (input.conditions.allRequiredAllocationsSucceed === true) success = true;
        else if (Array.isArray(input.allocationResults) && Object.hasOwn(input.allocationResults,allocationIndex)) success = input.allocationResults[allocationIndex];
        require(typeof success === 'boolean', 'Allocation outcome unknown at index '+allocationIndex);
        allocations.push({rowIndex,slot,index:allocationIndex++,success});
        if (!success) return finish(true, 'Native allocation failure returns before this draw', {returnedEarly:true});
        const {lower,upper} = input.phaseRange ?? {};
        require(Number.isInteger(lower) && Number.isInteger(upper) && lower >= 0 && upper <= 0x7fffffff && upper > lower, 'Unsupported or unknown positive phase range');
        const before = seed;
        const pair = kernel.generate(seed,0n,1);
        seed = pair[0];
        const random = pair[1];
        const event = {ordinal:events.length+1,rowIndex,groupId:record.groupId,slot,
          nativeItemIndex:((rowIndex & 255)*8)+slot,kind:'pickup-materialize',before,after:seed,random,phase:null};
        events.push(event); // The AT draw is already consumed if phase projection fails.
        event.phase = kernel.e.world_pickup_phase(random,lower,upper) >>> 0;
      }
    }
    return finish(true, 'Source-ordered enabled pickup slots materialized', {returnedEarly:false});
  } catch (error) {
    return finish(false,error.message);
  }
}

// This gate proves only the tail after an already-reached descriptor-mode check.
export function projectNpcModeZeroGate({descriptorGateReached,descriptorPresent,mode}={}) {
  if (descriptorGateReached !== true || typeof descriptorPresent !== 'boolean' ||
      (descriptorPresent && (!Number.isInteger(mode) || mode < 0 || mode > 255))) {
    return {resolved:false,consumed:0,maximumConsumed:null,reason:'Descriptor gate inputs unknown'};
  }
  if (!descriptorPresent || mode === 0) return {resolved:true,consumed:0,maximumConsumed:0,
    skipsTimer:true,scope:'02041190 to 02041344 only; preceding actor update and epilogue are excluded'};
  return {resolved:false,consumed:0,maximumConsumed:null,reason:'Nonzero mode needs later gates and movement context'};
}
