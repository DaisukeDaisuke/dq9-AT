// Read-only Japanese DQ9 static BMBl exit inventory. No I/O, labels or route claims.
import {NitroFS, BufferReader, Compression} from './vendor/nitro-fs.mjs';
import {Narc} from './vendor/narc-source.js';
import {parseCalls, decodeNumber, readPoolString, decodeMapRecords, u32} from './vendor/call-stream.mjs';

export const MAP_EXIT_LIST = 'data/map/maplist9.bin';
const MAX_RESOURCE = 0x400000, MAX_CALLS = 100000, MAX_EXITS = 16384, MAX_DECODED_BYTES = 64 * 1024 * 1024;
const alias = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value);
const uint = value => Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
function bytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError('Expected Uint8Array or ArrayBuffer');
}
function range(offset, length, total, label) {
  if (!uint(offset) || !uint(length) || offset + length > total) throw Error(`${label} outside resource`);
}

// Guard the shared readers: their permissive slices alone do not validate extents.
function validateFnt(data, fileCount, ordinalFileIds = false) {
  range(0, 8, data.length, 'FNT root');
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength), count = v.getUint16(6, true), children = [];
  if (!count || count > 4096) throw Error('FNT directory count invalid');
  range(0, count * 8, data.length, 'FNT directory table');
  for (let i = 0; i < count; i++) {
    let p = v.getUint32(i * 8, true), file = v.getUint16(i * 8 + 4, true), seenDirectory = false;
    const names = new Set(), edges = [];
    if (p < count * 8) throw Error('FNT subtable overlaps table');
    while (true) {
      range(p, 1, data.length, 'FNT entry'); const control = data[p++]; if (!control) break;
      const length = control & 127; if (!length) throw Error('FNT empty name');
      range(p, length, data.length, 'FNT name'); const name = String.fromCharCode(...data.subarray(p, p + length)); p += length;
      if (names.has(name) || /[/\\\0]/.test(name)) throw Error('FNT ambiguous name'); names.add(name);
      if (control & 128) {
        range(p, 2, data.length, 'FNT child'); const child = v.getUint16(p, true); p += 2;
        if (child < 0xf000 || child >= 0xf000 + count) throw Error('FNT child missing');
        edges.push(child - 0xf000); seenDirectory = true;
      } else {
        if (ordinalFileIds && seenDirectory) throw Error('FNT ordering unsupported by shared NitroFS reader');
        if (file++ >= fileCount) throw Error('FNT file outside FAT');
      }
      if (names.size > 65536) throw Error('FNT entry bound exceeded');
    }
    children.push(edges);
  }
  const visited = new Set();
  function visit(i, depth) {
    if (depth > 64 || visited.has(i)) throw Error('FNT cycle or repeated child');
    visited.add(i); for (const child of children[i]) visit(child, depth + 1);
  }
  visit(0, 0); if (visited.size !== count) throw Error('FNT tree incomplete');
}
function nitroFromRom(input) {
  const rom = bytes(input);
  if (rom.length < 0x200 || String.fromCharCode(...rom.subarray(12, 16)) !== 'YDQJ' || rom[0x1e] !== 0) throw Error('Japanese DQ9 revision 0 ROM required');
  const v = new DataView(rom.buffer, rom.byteOffset, rom.byteLength), fnt = u32(rom, 0x40), fntSize = u32(rom, 0x44), fat = u32(rom, 0x48), fatSize = u32(rom, 0x4c);
  if (fnt < 0x200 || fat < 0x200 || !fatSize || fatSize % 8 || fatSize / 8 > 65536) throw Error('NDS filesystem header invalid');
  range(fnt, fntSize, rom.length, 'NDS FNT'); range(fat, fatSize, rom.length, 'NDS FAT');
  let copied = 0; const extents = [];
  for (let p = fat; p < fat + fatSize; p += 8) {
    const start = v.getUint32(p, true), end = v.getUint32(p + 4, true);
    range(start, end - start, rom.length, 'NDS member'); copied += end - start;
    if (end > start) extents.push([start, end]);
  }
  if (copied > rom.length) throw Error('NDS copy budget exceeded');
  extents.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < extents.length; i++) if (extents[i][0] < extents[i - 1][1]) throw Error('NDS overlapping FAT members');
  validateFnt(rom.subarray(fnt, fnt + fntSize), fatSize / 8, true);
  return NitroFS.fromRom(rom.buffer.slice(rom.byteOffset, rom.byteOffset + rom.byteLength));
}
export function readBoundedNarcMembers(data) {
  range(0, 16, data.length, 'NARC header');
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength), magic = p => String.fromCharCode(...data.subarray(p, p + 4));
  if (data.length > MAX_RESOURCE || magic(0) !== 'NARC' || v.getUint16(4, true) !== 0xfffe || v.getUint16(6, true) !== 0x100 || u32(data, 8) !== data.length || v.getUint16(12, true) !== 16 || v.getUint16(14, true) !== 3) throw Error('NARC header invalid');
  let p = 16; const blocks = [];
  for (const name of ['BTAF', 'BTNF', 'GMIF']) {
    range(p, 8, data.length, 'NARC block'); const size = u32(data, p + 4);
    if (magic(p) !== name || size < 8) throw Error('NARC block invalid');
    range(p, size, data.length, 'NARC block'); blocks.push({offset: p, size}); p += size;
  }
  if (p !== data.length) throw Error('NARC block coverage invalid');
  const [fat, fnt, img] = blocks;
  range(fat.offset + 8, 4, fat.offset + fat.size, 'NARC count'); const count = u32(data, fat.offset + 8);
  if (count > 65536 || fat.size !== 12 + count * 8) throw Error('NARC member count invalid');
  const offsets = [], extents = []; let copied = 0;
  for (let i = 0; i < count; i++) {
    const start = u32(data, fat.offset + 12 + i * 8), end = u32(data, fat.offset + 16 + i * 8);
    range(start, end - start, img.size - 8, 'NARC member'); offsets.push(img.offset + 8 + start); copied += end - start;
    if (end > start) extents.push([start, end]);
  }
  if (copied > data.length) throw Error('NARC member copy budget exceeded');
  extents.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < extents.length; i++) if (extents[i][0] < extents[i - 1][1]) throw Error('NARC overlapping members');
  validateFnt(data.subarray(fnt.offset + 8, fnt.offset + fnt.size), count);
  return {archive: Narc.load(data), offsets};
}
function checkedCalls(input) {
  const data = bytes(input);
  if (data.length < 16 || data.length > MAX_RESOURCE) throw Error('Call stream size invalid');
  const count = u32(data, 0), pool = u32(data, 4), poolSize = u32(data, 8);
  if (count > MAX_CALLS || count > Math.floor((data.length - 16) / 4) || pool < 16) throw Error('Call count or pool invalid');
  range(pool, poolSize, data.length, 'Call string pool');
  const calls = parseCalls(data);
  if (calls.endOffset > pool) throw Error('Calls overlap string pool');
  for (const c of calls) for (const a of c.args) {
    if (a.type === 3) throw Error('Unsupported call argument type 3');
    if (a.type === 0 && a.raw !== 0xffffffff) {
      if (a.raw >= poolSize) throw Error('String offset outside pool');
      let p = pool + a.raw; while (p < pool + poolSize && data[p]) p++;
      if (p === pool + poolSize) throw Error('Unterminated pool string');
    }
    if (a.type === 2 && !Number.isFinite(decodeNumber(a))) throw Error('Non-finite numeric argument');
  }
  return calls;
}
function decodedMember(data) {
  // Sixteen uncompressed calls also start with 0x10: test the complete stream first.
  try { checkedCalls(data); return {data, compression: 'none'}; } catch (rawError) {
    if (data[0] !== 0x10) throw rawError;
    if (data.length < 4) throw Error('LZ10 header truncated');
    const size = data[1] | data[2] << 8 | data[3] << 16;
    if (size < 16 || size > MAX_RESOURCE) throw Error('LZ10 output size invalid');
    let src = 4, out = 0;
    while (out < size) {
      range(src, 1, data.length, 'LZ10 flags'); const flags = data[src++];
      for (let bit = 7; bit >= 0 && out < size; bit--) {
        if (flags & 1 << bit) {
          range(src, 2, data.length, 'LZ10 reference'); const a = data[src++], b = data[src++], count = (a >>> 4) + 3, distance = ((a & 15) << 8 | b) + 1;
          if (distance > out || out + count > size) throw Error('LZ10 reference outside decoded prefix'); out += count;
        } else { range(src++, 1, data.length, 'LZ10 literal'); out++; }
      }
    }
    const expanded = Compression.decompress(new BufferReader(data.buffer, data.byteOffset, data.byteLength));
    checkedCalls(expanded); return {data: expanded, compression: 'lz10'};
  }
}
function field(data, call, index, allowed = [1, 2]) {
  const a = call.args[index];
  if (!a || !allowed.includes(a.type)) throw Error(`Exit field ${index} has unsupported type`);
  const value = a.type === 0 ? readPoolString(data, u32(data, 4), a) : decodeNumber(a);
  // JSON has no negative zero; its original float sign remains exact in raw32.
  return {argumentIndex: index, type: a.type, raw32: a.raw, value: value === 0 ? 0 : value};
}
function fixed(value) {
  const n = Math.trunc(Math.fround(Math.fround(value) * 4096));
  if (!Number.isSafeInteger(n) || n < -0x80000000 || n > 0x7fffffff) throw Error('Exit fixed-point value outside signed32');
  return n === 0 ? 0 : n;
}
const signed32 = n => { if (n < -0x80000000 || n > 0x7fffffff) throw Error('Exit bound outside signed32'); return n; };
function binding(record) {
  if (!uint(record.mapId) || record.mapId > 65535 || !alias(record.fieldCode) || !uint(record.callIndex) || !uint(record.callOffset)) throw Error('Map binding outside supported schema');
  return {mapId: record.mapId, fieldCode: record.fieldCode, callIndex: record.callIndex, callOffset: record.callOffset};
}

/** Decode one already-expanded BMBl stream. Returns only exit facts and capacity declarations. */
export function decodeMapExitCalls(input, source, mapRecords) {
  if (!Array.isArray(mapRecords) || mapRecords.length > 65536) throw Error('Map bindings must be a bounded dense list');
  for (let i = 0; i < mapRecords.length; i++) if (!Object.hasOwn(mapRecords, i) || !mapRecords[i] || typeof mapRecords[i] !== 'object') throw Error('Map bindings must be a bounded dense list');
  const data = bytes(input), calls = checkedCalls(data), records = mapRecords.map(binding);
  if (calls.filter(c => c.opcode === 105 || c.opcode === 114).length > MAX_EXITS) throw Error('Exit row budget exceeded; inventory incomplete');
  if (!/^data\/map\/[A-Za-z0-9_]+\.ambl$/i.test(source?.archivePath) || !/^[A-Za-z0-9_]+\.bmbl$/i.test(source?.member) || !uint(source.memberIndex) || !uint(source.memberArchiveOffset)) throw Error('Exact archive/member source required');
  const archiveResource = source.archivePath.slice(9, -5), sourceBindings = records.filter(r => r.fieldCode.toLowerCase() === archiveResource.toLowerCase());
  const exits = [], capacityDeclarations = []; let capacity = null;
  for (const call of calls) {
    if (call.opcode === 104) {
      if (call.argumentCount !== 1) throw Error('Exit capacity argument count invalid');
      const value = field(data, call, 0, [1]);
      if (value.value < 0 || value.value > 65536) throw Error('Exit capacity outside supported bound');
      capacity = {callIndex: call.index, callOffset: call.offset, ...value}; capacityDeclarations.push(capacity); continue;
    }
    if (call.opcode !== 105 && call.opcode !== 114) continue;
    const start = call.opcode === 114 ? 7 : 6, optionalCount = call.argumentCount - start - 8;
    if (![0, 1, 10].includes(optionalCount)) throw Error('Exit argument count invalid');
    const f = (i, types) => field(data, call, i, types), xyz = i => [f(i), f(i + 1), f(i + 2)];
    const center = xyz(0), dimensions = xyz(3), rotation = start === 7 ? f(6) : null;
    if (dimensions.some(x => x.value < 0)) throw Error('Negative exit dimension');
    const centerFixed = center.map(x => fixed(x.value)), half = dimensions.map(x => Math.trunc(fixed(x.value) / 2));
    const kind = f(start, [1]), target = f(start + 1, [0, 1]);
    if (target.type === 0 && target.value !== null && !alias(target.value)) throw Error('Target is not a resource alias');
    const targetRecords = target.type === 0 ? records.filter(r => r.fieldCode === target.value) : records.filter(r => r.mapId === target.value);
    const status = target.type === 0 ? target.value === null ? 'null-string-unresolved' : targetRecords.length ? 'resource-name-found' : 'resource-name-not-found' : 'numeric-map-id';
    const destination = xyz(start + 4), facing = f(start + 7), party = optionalCount === 10 ? [xyz(start + 9), xyz(start + 12), xyz(start + 15)] : [];
    exits.push({
      source: {archivePath: source.archivePath, archiveResource, member: source.member, memberIndex: source.memberIndex, memberArchiveOffset: source.memberArchiveOffset, callIndex: call.index, callOffset: call.offset, sourceBindings},
      opcode: call.opcode, argumentCount: call.argumentCount, kind,
      target: {...target, status, mapRecords: targetRecords, firstMapId: targetRecords[0]?.mapId ?? (target.type === 1 ? target.value : null)},
      trigger: {center, dimensions, rotation, centerFixed, minFixed: centerFixed.map((x, i) => signed32(x - half[i])), maxFixed: centerFixed.map((x, i) => signed32(x + half[i])), rotationRaw16: rotation ? fixed(rotation.value) & 65535 : 0},
      destination: {xyz: destination, xyzFixed: destination.map(x => fixed(x.value)), facing, facingRaw16: fixed(facing.value) & 65535, additionalPartyXYZ: party, additionalPartyXYZFixed: party.map(group => group.map(x => fixed(x.value)))},
      unknownMetadata: {record64: f(start + 2, [1]), record68: f(start + 3, [1]), record6c: optionalCount ? f(start + 8, [1]) : null},
      capacityDeclaration: capacity ? {...capacity} : null,
      gateProfile: kind.value === 1 ? 'ordinary-plus-kind1' : 'ordinary', runtimeAvailability: 'unresolved', traversalProven: false,
    });
  }
  return {exits, capacityDeclarations};
}

/** Decode one bounded raw or LZ10 BMBl member using the same guards as the full miner. */
export function decodeMapExitMember(input,source,mapRecords){return decodeMapExitCalls(decodedMember(bytes(input)).data,source,mapRecords);}

function semantics() {
  return {
    sources: {mapList: MAP_EXIT_LIST, archiveLoader: '02013ed4', decompression: '0201415c', interpreter: ['0201e040', '0201df5c'], handlerTable: '020ef2c4', opcode105: '0201ca54', opcode114: '0201cc0c', commonTarget: '0201c8ec', targetLookup: '0209b6c0', append: '0201e300', runtimeScan: 'overlay_d_17:0219d57c'},
    fieldSchema: {argumentWordBits: 32, type0: 'string-pool offset; 0xffffffff retained as null', type1: 'signed integer32', type2: 'IEEE754 float32', fixedScale: 4096, fixedConversion: 'float32 multiply then truncate toward zero to signed32', dimensionHalving: 'truncate converted signed32 / 2 toward zero', nativeRecordBytes: 112, nativeWidths: {kind: 32, targetMapId: 32, triggerCoordinates: 32, destinationCoordinates: 32, rotation: 16, facing: 16, metadata64: 32, metadata68: 32, optional6c: 32}, nativeOffsets: {kind: 0, triggerMax: 4, triggerMin: 16, targetMapId: 28, destinationXYZ: 32, partyXYZ: [44, 56, 68], facing: 80, rotation: 82, metadata64: 100, metadata68: 104, optional6c: 108}, angleInterpretation: 'Raw low16 fixed values only; no degrees conversion', absentOptional6cDefault: -1},
    bindingRules: {source: 'Archive basename joined case-insensitively to raw maplist fieldCode; resource association, not runtime activation proof', target: 'Exact case-sensitive fieldCode match in maplist source order; native lookup selects first record', ordering: 'NitroFS archive order, NARC member index, BMBl call order; duplicate exit rows retained', missingString: 'Named target absent from maplist is retained; native helper fails its lookup and does not append'},
    runtimeGates: {
      ordinary: [
        {source: '0201e300', condition: 'Loaded runtime count < declared capacity before append'},
        {source: 'overlay_d_17:0219d57c', condition: '02047958(controller+0x34ec,controller+0x34fc) == 0; 02047944(controller+0x34ec) != 4 and != 10'},
        {source: 'overlay_d_17:0219d57c', condition: 'If 0203af8c(controller,8) != 0: byte[*(controller+0x3500)+3] == 0 and 0203adf0(controller) == 0'},
        {source: 'overlay_d_17:0219d57c', condition: '02047958(controller+0x34ec,controller+0x350c) == 0; 0200f9f8() != 6; 02011d98() != 5'},
        {source: 'overlay_d_17:0219d57c', condition: '(u32[hero+0x180] & 1) == 0; byte[0200fb68()+2] == 0 for ordinary record scan'},
        {source: '02031d18', condition: 'Hero XYZ must pass runtime rotated geometry and radius tests; scan order and controller state can stop or defer transition'},
      ],
      kind1Additional: [{source: 'overlay_d_17:0219d57c', condition: 'For kind == 1, 02039278(hero) != 0 queues through overlay_d_17:0219bed0; queuing does not prove completed travel'}],
      evaluated: false,
    },
    missingSemantics: ['Runtime controller values, hero state, loaded capacity and activation are not observed', 'Metadata at native +0x64/+0x68 and optional +0x6c retain raw values without story-flag meanings', 'Null targets are unresolved; do not guess from other fields', 'Scripted warps, spells, vehicles, runtime overrides, record replacement and generated floors are outside this static pass', 'No reverse edge, unconditional adjacency, travel availability, AT cost or seed reset is inferred', 'Destination Y is the requested entry coordinate, not settled terrain height'],
  };
}

/** Mine a caller-owned NitroFS instance or local ROM ArrayBuffer/Uint8Array. No fetch, writes or hash I/O. */
export function mineMapExits(input) {
  const nitro = input && typeof input.readFile === 'function' && typeof input.readDir === 'function' ? input : nitroFromRom(input);
  if (nitro.cartridgeHeader?.gameCode !== 'YDQJ') throw Error('Japanese DQ9 NitroFS required');
  const list = bytes(nitro.readFile(MAP_EXIT_LIST)), mapCalls = checkedCalls(list);
  for (const call of mapCalls.filter(c => c.opcode === 103)) {
    if (call.argumentCount < 6 || call.args[0].type !== 1 || call.args[4].type !== 0) throw Error('Maplist record schema invalid');
  }
  const mapRecords = decodeMapRecords(list, mapCalls).map(binding);
  const directory = nitro.readDir('data/map').files;
  if (!Array.isArray(directory) || directory.length > 65536) throw Error('Map directory outside bounded dense list');
  for (let i = 0; i < directory.length; i++) if (!Object.hasOwn(directory, i) || typeof directory[i] !== 'string') throw Error('Map directory outside bounded dense list');
  const files = directory.filter(name => /\.ambl$/i.test(name));
  if (files.length > 4096) throw Error('Archive count exceeds bound');
  const archives = [], exits = []; let decodedBytes = 0;
  for (const name of files) {
    if (!/^[A-Za-z0-9_]+\.ambl$/i.test(name)) throw Error('Archive name outside allowlist');
    const archivePath = `data/map/${name}`, raw = bytes(nitro.readFile(archivePath)), {archive, offsets} = readBoundedNarcMembers(raw), members = [];
    for (let memberIndex = 0; memberIndex < archive.files.length; memberIndex++) {
      const member = archive.fnt.getFilenameOf(memberIndex); if (!/\.bmbl$/i.test(member)) continue;
      const {data, compression} = decodedMember(archive.files[memberIndex]); decodedBytes += data.length;
      if (decodedBytes > MAX_DECODED_BYTES) throw Error('Decoded BMBl byte budget exceeded; inventory incomplete');
      const source = {archivePath, member, memberIndex, memberArchiveOffset: offsets[memberIndex]}, decoded = decodeMapExitCalls(data, source, mapRecords);
      if (exits.length + decoded.exits.length > MAX_EXITS) throw Error('Exit row budget exceeded; inventory incomplete');
      members.push({member, memberIndex, memberArchiveOffset: offsets[memberIndex], compression, decodedLength: data.length, exitCount: decoded.exits.length, capacityDeclarations: decoded.capacityDeclarations});
      exits.push(...decoded.exits);
    }
    archives.push({archivePath, members});
  }
  const counts = values => values.reduce((out, value) => (out[value] = (out[value] ?? 0) + 1, out), {});
  return {format: 'dq9-jp-static-map-exits', version: 1, rom: {gameCode: 'YDQJ'}, ...semantics(), summary: {archiveCount: archives.length, bmblCount: archives.reduce((n, a) => n + a.members.length, 0), exitRowCount: exits.length, exitOpcodes: counts(exits.map(e => e.opcode)), kinds: counts(exits.map(e => e.kind.value)), targetStatuses: counts(exits.map(e => e.target.status)), distinctBoundDirectedPairs: new Set(exits.flatMap(e => e.source.sourceBindings.flatMap(s => e.target.mapRecords.map(t => `${s.mapId}>${t.mapId}`)))).size, traversalProvenCount: 0}, archives, exits};
}
