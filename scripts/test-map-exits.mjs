import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {mineMapExits, decodeMapExitCalls, MAP_EXIT_LIST} from '../web/map-exits.mjs';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';

let checks = 0;
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const ok = v => { assert(v); checks++; };
const bad = (f, message) => { assert.throws(f, message); checks++; };
const int = value => ({type: 1, value}), float = value => ({type: 2, value}), str = value => ({type: 0, value});
// Invented fixtures only. No ROM bytes or private source inventories are embedded.
function stream(rows) {
  const pool = [], encoded = []; let size = 16;
  for (const {opcode, args} of rows) {
    const start = (3 + Math.ceil(args.length / 4) + 3) & ~3, data = new Uint8Array(start + args.length * 4), v = new DataView(data.buffer);
    v.setUint16(0, opcode, true); data[2] = args.length;
    args.forEach((a, i) => {
      data[3 + (i >> 2)] |= a.type << ((i % 4) * 2);
      if (a.type === 0) {
        v.setUint32(start + i * 4, a.value === null ? 0xffffffff : pool.length, true);
        if (a.value !== null) pool.push(...new TextEncoder().encode(a.value), 0);
      } else if (a.type === 2) v.setFloat32(start + i * 4, a.value, true);
      else v.setUint32(start + i * 4, a.value >>> 0, true);
    });
    size += data.length; encoded.push(data);
  }
  const result = new Uint8Array(size + pool.length), v = new DataView(result.buffer);
  v.setUint32(0, rows.length, true); v.setUint32(4, size, true); v.setUint32(8, pool.length, true);
  let p = 16; for (const data of encoded) { result.set(data, p); p += data.length; } result.set(pool, p); return result;
}
const exitArgs = target => [...[1, -2, 3, 2, 4, 6, -0.5].map(float), int(1), str(target), int(-1), int(7), ...[4, 5, -6, 0.25].map(float), int(2), ...[4, 5, -6, 7, 8, 9, 10, 11, 12].map(float)];
const source = {archivePath: 'data/map/TEST.ambl', member: 'TEST00.bmbl', memberIndex: 0, memberArchiveOffset: 64};
const records = [{mapId: 10, fieldCode: 'TEST', callIndex: 2, callOffset: 64}, {mapId: 20, fieldCode: 'NEXT', callIndex: 3, callOffset: 164}];
const make = (args = exitArgs('NEXT'), opcode = 114) => stream([{opcode: 104, args: [int(1)]}, {opcode, args}]);
const decode = data => decodeMapExitCalls(data, source, records);
const original = make(), saved = original.slice(), decoded = decode(original), row = decoded.exits[0];
eq(original, saved); eq(row.source.sourceBindings, [records[0]]); eq(row.target.mapRecords, [records[1]]);
eq(row.target.firstMapId, 20); eq(row.kind.value, 1); eq(row.trigger.centerFixed, [4096, -8192, 12288]);
eq(row.trigger.minFixed, [0, -16384, 0]); eq(row.trigger.maxFixed, [8192, 0, 24576]); eq(row.trigger.rotationRaw16, 63488);
eq(row.destination.xyzFixed, [16384, 20480, -24576]); eq(row.destination.facingRaw16, 1024);
eq(row.unknownMetadata.record64.raw32, 0xffffffff); eq(row.unknownMetadata.record68.value, 7); eq(row.unknownMetadata.record6c.value, 2);
eq(row.destination.additionalPartyXYZFixed, [[16384, 20480, -24576], [28672, 32768, 36864], [40960, 45056, 49152]]);
eq(row.runtimeAvailability, 'unresolved'); eq(row.traversalProven, false); eq(row.capacityDeclaration.value, 1);
const duplicate = decode(stream([{opcode: 114, args: exitArgs('NEXT')}, {opcode: 114, args: exitArgs('NEXT')}]));
eq(duplicate.exits.length, 2); ok(duplicate.exits[0].source.callOffset < duplicate.exits[1].source.callOffset);
const aliases = decodeMapExitCalls(make(), source, [...records, {...records[1], mapId: 21, callIndex: 4, callOffset: 264}]).exits[0];
eq(aliases.target.mapRecords.map(r => r.mapId), [20, 21]); eq(aliases.target.firstMapId, 20);
eq(decode(make(exitArgs(null))).exits[0].target.status, 'null-string-unresolved');
const missing = decode(make(exitArgs('MISSING'))).exits[0]; eq(missing.target.mapRecords, []); eq(missing.target.value, 'MISSING');
eq(decode(make(exitArgs('next'))).exits[0].target.status, 'resource-name-not-found');
const unrotated = exitArgs('NEXT'); unrotated.splice(6, 1); const old = decode(make(unrotated, 105)).exits[0];
eq(old.trigger.rotation, null); eq(old.trigger.rotationRaw16, 0); eq(old.argumentCount, 24);
eq(decode(make(exitArgs('NEXT').slice(0, 15))).exits[0].unknownMetadata.record6c, null);
const numeric = exitArgs('NEXT'); numeric[8] = int(20); eq(decode(make(numeric)).exits[0].target.firstMapId, 20);
bad(() => decode(new Uint8Array(15)), /size/);
bad(() => decode(original.subarray(0, original.length - 1)), /pool/);
const mutate = (offset, value) => { const out = original.slice(); new DataView(out.buffer).setUint32(offset, value, true); return out; };
bad(() => decode(mutate(0, 0xffffffff)), /count/); bad(() => decode(mutate(4, 16)), /overlap/); bad(() => decode(mutate(8, 0xffffffff)), /pool/);
const unterminated = original.slice(); unterminated[unterminated.length - 1] = 65; bad(() => decode(unterminated), /Unterminated/);
bad(() => decode(make(exitArgs('NEXT').slice(0, 24))), /argument count/);
const invalidType = exitArgs('NEXT'); invalidType[0] = {type: 3, value: 0}; bad(() => decode(make(invalidType)), /type 3/);
const wrongField = exitArgs('NEXT'); wrongField[9] = float(1); bad(() => decode(make(wrongField)), /unsupported type/);
const infinite = exitArgs('NEXT'); infinite[0] = float(Infinity); bad(() => decode(make(infinite)), /Non-finite/);
const overflow = exitArgs('NEXT'); overflow[0] = float(1e30); bad(() => decode(make(overflow)), /signed32/);
const negativeZero = exitArgs('NEXT'); negativeZero[0] = float(-0); const zero = decode(make(negativeZero)).exits[0]; eq(zero.trigger.center[0].raw32, 0x80000000); eq(zero.trigger.center[0].value, 0); eq(zero.trigger.centerFixed[0], 0);
bad(() => decodeMapExitCalls(original, {...source, archivePath: '/private/TEST.ambl'}, records), /source/);
bad(() => decodeMapExitCalls(original, source, [{...records[0], fieldCode: '/private'}]), /schema/);
bad(() => decodeMapExitCalls(original, source, Array(2)), /dense/);
bad(() => decodeMapExitCalls(original, source, [records[0], null]), /dense/);
bad(() => decodeMapExitCalls(original, source, Array(65537)), /bounded/);
bad(() => decode(stream(Array.from({length: 16385}, () => ({opcode: 114, args: []})))), /row budget/);
bad(() => mineMapExits(new Uint8Array(16)), /ROM/);

function narc(member) {
  const name = 'TEST00.bmbl', fntSize = 8 + 8 + 1 + name.length + 1, img = 16 + 20 + fntSize, data = new Uint8Array(img + 8 + member.length), v = new DataView(data.buffer);
  const ascii = (p, s) => data.set(new TextEncoder().encode(s), p);
  ascii(0, 'NARC'); v.setUint16(4, 0xfffe, true); v.setUint16(6, 0x100, true); v.setUint32(8, data.length, true); v.setUint16(12, 16, true); v.setUint16(14, 3, true);
  ascii(16, 'BTAF'); v.setUint32(20, 20, true); v.setUint32(24, 1, true); v.setUint32(32, member.length, true);
  ascii(36, 'BTNF'); v.setUint32(40, fntSize, true); v.setUint32(44, 8, true); v.setUint16(50, 1, true); data[52] = name.length; ascii(53, name);
  ascii(img, 'GMIF'); v.setUint32(img + 4, member.length + 8, true); data.set(member, img + 8); return data;
}
const mapList = stream(records.map(r => ({opcode: 103, args: [int(r.mapId), int(0), str('IGNORED'), int(0), str(r.fieldCode), str('IGNORED')]})));
const mock = archive => ({cartridgeHeader: {gameCode: 'YDQJ'}, readDir: () => ({files: ['TEST.ambl']}), readFile: path => path === MAP_EXIT_LIST ? mapList : archive});
const rawArchive = narc(original); const mined = mineMapExits(mock(rawArchive)); eq(mined.summary.exitRowCount, 1);
ok(!JSON.stringify(mined).includes('IGNORED')); eq(mined.summary.traversalProvenCount, 0);
const sixteen = stream([...Array.from({length: 15}, () => ({opcode: 1, args: []})), {opcode: 114, args: exitArgs('NEXT')}]);
eq(mineMapExits(mock(narc(sixteen))).archives[0].members[0].compression, 'none');
function literalLz(data) { const out = [16, data.length & 255, data.length >>> 8 & 255, data.length >>> 16]; for (let p = 0; p < data.length; p += 8) out.push(0, ...data.subarray(p, p + 8)); return Uint8Array.from(out); }
eq(mineMapExits(mock(narc(literalLz(original)))).summary.exitRowCount, 1);
const malformedNarc = rawArchive.slice(); new DataView(malformedNarc.buffer).setUint32(24, 0xffffffff, true); bad(() => mineMapExits(mock(malformedNarc)), /count/);
function aliasedArchive(length) {
  const data = new Uint8Array(rawArchive.length + 8), v = new DataView(data.buffer);
  data.set(rawArchive.subarray(0, 36)); data.set(rawArchive.subarray(36), 44);
  v.setUint32(8, data.length, true); v.setUint32(20, 28, true); v.setUint32(24, 2, true);
  v.setUint32(32, length, true); v.setUint32(40, length, true); return data;
}
bad(() => mineMapExits(mock(aliasedArchive(original.length))), /copy budget/);
bad(() => mineMapExits(mock(aliasedArchive(1))), /overlapping/);
bad(() => mineMapExits(mock(rawArchive.subarray(0, 20))), /header/);
bad(() => mineMapExits(mock(narc(Uint8Array.from([16, 16, 0, 0, 128, 0, 0])))), /reference/);
bad(() => mineMapExits(mock(narc(Uint8Array.from([16, 16, 0, 0, 0])))), /literal/);
bad(() => mineMapExits({...mock(rawArchive), cartridgeHeader: {gameCode: 'YDQE'}}), /Japanese/);
bad(() => mineMapExits({...mock(rawArchive), readDir: () => ({files: Array(3)})}), /dense/);
// Large padded zero-call streams stay cheap to parse but exercise the aggregate byte budget.
const padded = new Uint8Array(4 * 1024 * 1024 - 128); padded.set(stream([])); const paddedArchive = narc(padded);
bad(() => mineMapExits({...mock(paddedArchive), readDir: () => ({files: Array.from({length: 17}, (_, i) => `TEST${i}.ambl`)})}), /byte budget/);

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--rom', '--reference', '--json'].includes(process.argv[i]) || !process.argv[i + 1]) throw Error('Usage: node scripts/test-map-exits.mjs [--rom local.nds] [--reference local-independent-inventory.json] [--json local-model.json]');
  options[process.argv[i]] = process.argv[i + 1];
}
let realRomParity = 'not requested';
if (options['--rom']) {
  const rom = fs.readFileSync(options['--rom']), model = mineMapExits(rom), nitro = NitroFS.fromRom(rom.buffer.slice(rom.byteOffset, rom.byteOffset + rom.byteLength));
  eq(mineMapExits(nitro), model);
  eq(model.summary, {archiveCount: 681, bmblCount: 667, exitRowCount: 978, exitOpcodes: {'114': 978}, kinds: {'0': 935, '1': 43}, targetStatuses: {'resource-name-found': 975, 'null-string-unresolved': 2, 'resource-name-not-found': 1}, distinctBoundDirectedPairs: 760, traversalProvenCount: 0});
  eq(model.exits.filter(e => e.target.value === null).map(e => [e.source.archiveResource, e.source.callOffset]), [['C02M15', 116], ['D04M03', 228]]);
  eq(model.exits.filter(e => e.target.status === 'resource-name-not-found').map(e => [e.source.archiveResource, e.source.callOffset, e.target.value]), [['M07', 564, 'M07M07']]);
  if (options['--json']) {
    const localModel = JSON.parse(fs.readFileSync(options['--json']));
    eq(localModel.rom.sha256, createHash('sha256').update(rom).digest('hex')); eq({...localModel, rom: model.rom}, model);
  }
  if (options['--reference']) {
    const reference = JSON.parse(fs.readFileSync(options['--reference'])); eq(reference.exitRows.length, model.exits.length);
    const bindings = rs => rs.map(({mapId, fieldCode, callOffset}) => ({mapId, fieldCode, callOffset}));
    model.exits.forEach((e, i) => {
      const r = reference.exitRows[i], fields = [...e.trigger.center, ...e.trigger.dimensions, ...(e.trigger.rotation ? [e.trigger.rotation] : []), e.kind, e.target, e.unknownMetadata.record64, e.unknownMetadata.record68, ...e.destination.xyz, e.destination.facing, ...(e.unknownMetadata.record6c ? [e.unknownMetadata.record6c] : []), ...e.destination.additionalPartyXYZ.flat()];
      eq([e.source.archivePath, e.source.member, e.source.callIndex, e.source.callOffset, e.opcode, e.argumentCount], [r.archivePath, r.member, r.callIndex, r.callOffset, r.opcode, r.argumentCount]);
      eq(fields.map(({type, raw32}) => ({type, raw: raw32})), r.args); eq(fields.map(f => f.value), r.values);
      eq(bindings(e.source.sourceBindings), r.sourceBindings); eq(bindings(e.target.mapRecords), r.targetRecords);
    });
    realRomParity = 'all 978 rows, all typed fields, bindings, offsets and source order match independent inventory';
  } else realRomParity = 'ROM/NitroFS and known counts match; optional local JSON checked only when supplied';
} else if (options['--reference'] || options['--json']) throw Error('--reference/--json require --rom');
console.log(JSON.stringify({passed: true, checks, realRomParity}));
