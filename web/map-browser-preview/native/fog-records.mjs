/** DQ9 YDQJ rev0 environment fog records. No embedded game data.
 * Provenance: ARM9 0207c470 (callback 0x69), 02051d00 (first-four inheritance),
 * 02052eb4 (initial application). See REPORT and private raw instruction evidence.
 * This is NOT a map/time/event selector or a renderer.
 */
export const RECORD_BYTES = 0x38;
export const RECORD_COUNT = 7;

function integerArg(arg, label) {
  if (!arg || arg.type !== 1 || !Number.isInteger(arg.raw)) {
    throw new TypeError(`${label}: expected an observed type-1 integer argument`);
  }
  return arg.raw >>> 0;
}

/** Lower one well-formed callback69. Reject malformed/other typed inputs explicitly. */
export function lowerFogCall(call) {
  if (call.opcode !== 0x69 || call.argumentCount !== 15 || call.args?.length !== 15) {
    throw new RangeError('callback69 requires 15 arguments; no fabricated zero defaults');
  }
  const a = call.args.map((v, i) => integerArg(v, `arg${i}`));
  if (a[0] > 6) throw new RangeError(`fog index ${a[0]} outside supported observed 0..6`);
  const bytes = new Uint8Array(RECORD_BYTES), d = new DataView(bytes.buffer);
  d.setUint32(0, a[1] !== 0 ? 1 : 0, true); // specified, NOT GPU enable
  d.setUint32(4, a[3], true);
  d.setUint32(8, a[4], true);
  d.setUint32(12, a[5], true);
  d.setUint16(16, a[2] & 0xffff, true); // +18/+19 are ctor-zeroed padding
  d.setUint32(20, a[14], true);
  for (let i = 0; i < 8; ++i) d.setUint32(24 + 4 * i, a[6 + i], true);
  return {index: a[0], bytes, callIndex: call.index, callOffset: call.offset};
}

/** Collect all seven records; other environment opcodes remain the caller's raw evidence.
 * A malformed fog call makes ready=false even when seven other calls decoded successfully.
 */
export function lowerEnvironmentFog(calls) {
  const records = new Uint8Array(RECORD_BYTES * RECORD_COUNT), seen = new Set();
  const recordSources = [], issues = [], modes = [];
  for (const c of calls) {
    if (c.opcode === 0x64 || c.opcode === 0x67) {
      const valid = c.argumentCount === 1 && c.args[0]?.type === 2 ||
        c.opcode === 0x67 && c.argumentCount === 0;
      if (!valid) issues.push({callIndex:c.index, callOffset:c.offset, error:'unsupported mode argument shape'});
      modes.push({mode:c.opcode === 0x64 ? 2 : 1, callIndex:c.index, callOffset:c.offset,
        rawFloatBits:c.args[0]?.raw ?? null});
    }
    if (c.opcode !== 0x69) continue;
    try {
      const r = lowerFogCall(c);
      if (seen.has(r.index)) issues.push({callIndex:c.index,error:`repeated record ${r.index}; last store retained`});
      records.set(r.bytes, r.index * RECORD_BYTES); seen.add(r.index);
      recordSources.push({index:r.index,callIndex:r.callIndex,callOffset:r.callOffset});
    } catch (e) { issues.push({callIndex:c.index,callOffset:c.offset,error:e.message}); }
  }
  if (seen.size !== RECORD_COUNT) issues.push({error:`only ${seen.size}/7 explicit records`});
  if (modes.length !== 1) issues.push({error:`${modes.length} mode commands; sequencing requires review`});
  return {records, mode:modes.at(-1)?.mode ?? null, modes, recordSources, issues, ready:issues.length === 0};
}

/** Verify the instruction graph, not per-map fog values. The apparent zero-density
 * branch is unreachable: the inner body runs with r5=0..2, but tests r5==3.
 * Without a specified predecessor, execution falls through to the same copy.
 */
export function readTimeFogInheritanceRules(sdk) {
  const address=0x02051d00, length=0x110, bytes=sdk.read(address,length);
  let hash=2166136261;
  for(const byte of bytes) hash=Math.imul(hash^byte,16777619)>>>0;
  if(bytes.length!==length || hash!==0x2cbcb765) throw new Error('Native fog inheritance instruction graph differs');
  return {kind:'ydqj-third-predecessor-fallthrough',address,length,hash,
    evidence:{loopBound:0x02051d9c,zeroBranchTest:0x02051d4c,fallthroughCopy:0x02051da4}};
}

/** Literal native sequential first-four inheritance. Copies fields, not specified
 * or padding. No-specified support requires verified ROM instructions explicitly.
 */
export function inheritTimeFogRecords(input, {rules=null}={}) {
  if (!(input instanceof Uint8Array) || input.length !== RECORD_BYTES * RECORD_COUNT) {
    throw new RangeError('seven packed 56-byte records required');
  }
  const out = input.slice(), d = new DataView(out.buffer);
  const noSpecified = ![0,1,2,3].some(i => d.getUint32(i * RECORD_BYTES,true) === 1);
  if (noSpecified && (rules?.kind!=='ydqj-third-predecessor-fallthrough' || rules.hash!==0x2cbcb765)) {
    throw new RangeError('NO_SPECIFIED_TIME_RECORD: native no-specified branch not accepted; retain raw records');
  }
  const copies = [];
  for (let i = 0; i < 4; ++i) {
    if (d.getUint32(i * RECORD_BYTES,true) === 1) continue;
    let previous = i, found = false;
    for (let n = 0; n < 3; ++n) {
      previous = (previous + 3) & 3;
      if (d.getUint32(previous * RECORD_BYTES,true) === 1) { found = true; break; }
    }
    if (!found && !noSpecified) throw new Error('No specified predecessor in verified branch');
    const a = i * RECORD_BYTES, b = previous * RECORD_BYTES;
    out.set(out.slice(b + 4,b + 18),a + 4);
    out.set(out.slice(b + 20,b + RECORD_BYTES),a + 20);
    copies.push({destination:i,source:previous});
  }
  return {records:out,copies,...(noSpecified?{noSpecifiedBranch:rules.kind,sourceEvidence:rules.evidence}:{})};
}

/** Reads fields without deciding whether this record is currently selected. */
export function readFogRecord(records, index) {
  if (!(records instanceof Uint8Array) || records.length !== RECORD_BYTES * RECORD_COUNT ||
      !Number.isInteger(index) || index < 0 || index >= RECORD_COUNT) throw new RangeError('record shape/index');
  const at = index * RECORD_BYTES, d = new DataView(records.buffer,records.byteOffset + at,RECORD_BYTES);
  return {specified:d.getUint32(0,true),alphaOnly:d.getUint32(4,true),shift:d.getUint32(8,true),
    offset:d.getUint32(12,true),rgb555:d.getUint16(16,true),alpha:d.getUint32(20,true),
    density:records.slice(at + 24,at + 56)};
}

/** Mode1 only, AFTER caller has established the actual selected index and inheritance.
 * The flag means "specified in the file", not whether to turn fog on. The native mode1
 * setter passes enable=1 even if the selected slot originally had specified=0.
 */
export function staticMode1FogParameters(inheritedRecords, selectedIndex) {
  const r = readFogRecord(inheritedRecords,selectedIndex);
  return {enabled:true,alphaOnly:r.alphaOnly !== 0,shift:r.shift,offset:r.offset & 0x7fff,
    color:((r.rgb555 & 0x7fff) | ((r.alpha & 31) << 16)) >>> 0,density:r.density};
}
