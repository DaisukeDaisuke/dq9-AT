// Reused verbatim from LocalAI/work/dq9-pickup-static-loader/probe-maplist.mjs. No ROM-dependent data.
function u16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes, offset) {
  return (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0;
}

function parseCalls(bytes) {
  const callCount = u32(bytes, 0);
  const calls = [];
  let offset = 16;
  for (let index = 0; index < callCount; index++) {
    if (offset + 4 > bytes.length) throw new Error(`truncated call ${index}`);
    const opcode = u16(bytes, offset);
    const argumentCount = bytes[offset + 2];
    const typeBytes = Math.ceil(argumentCount / 4);
    const argumentOffset = (3 + typeBytes + 3) & ~3;
    const next = offset + argumentOffset + argumentCount * 4;
    if (next > bytes.length) throw new Error(`call ${index} overruns file`);
    const args = [];
    for (let argument = 0; argument < argumentCount; argument++) {
      const typeByte = bytes[offset + 3 + Math.floor(argument / 4)];
      const type = (typeByte >>> ((argument % 4) * 2)) & 3;
      const raw = u32(bytes, offset + argumentOffset + argument * 4);
      args.push({type, raw});
    }
    calls.push({index, offset, opcode, argumentCount, args});
    offset = next;
  }
  calls.endOffset = offset;
  return calls;
}

function decodeNumber(argument) {
  if (argument.type === 1) return argument.raw | 0;
  if (argument.type === 2) {
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, argument.raw, true);
    return view.getFloat32(0, true);
  }
  return null;
}

function readPoolString(bytes, poolOffset, argument) {
  if (argument.type !== 0 || argument.raw >= u32(bytes, 8)) return null;
  const start = poolOffset + argument.raw;
  let end = start;
  while (end < bytes.length && bytes[end] !== 0) end++;
  return new TextDecoder("shift_jis").decode(bytes.subarray(start, end));
}

function decodeMapRecords(bytes, calls) {
  const poolOffset = u32(bytes, 4);
  return calls.filter((call) => call.opcode === 0x67).map((call) => ({
    callIndex: call.index,
    callOffset: call.offset,
    mapId: decodeNumber(call.args[0]),
    secondaryId: decodeNumber(call.args[1]),
    resource0: readPoolString(bytes, poolOffset, call.args[2]),
    fieldCode: readPoolString(bytes, poolOffset, call.args[4]),
    resource1: readPoolString(bytes, poolOffset, call.args[5]),
    rawArgs: call.args.map((argument) => ({
      type: argument.type,
      value: decodeNumber(argument),
      string: readPoolString(bytes, poolOffset, argument),
      raw: argument.raw,
    })),
  }));
}


export {u16,u32,parseCalls,decodeNumber,readPoolString,decodeMapRecords};
