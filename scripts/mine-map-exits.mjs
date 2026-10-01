#!/usr/bin/env node
// Local files only. The browser API does not receive a filename or compute hashes.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {mineMapExits} from '../web/map-exits.mjs';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--rom', '--out'].includes(args[i]) || !args[i + 1]) throw Error('Usage: node scripts/mine-map-exits.mjs --rom local.nds [--out map-exits.json]');
  options[args[i]] = args[i + 1];
}
if (!options['--rom']) throw Error('A local --rom file is required');
const rom = fs.readFileSync(options['--rom']), model = mineMapExits(rom);
model.rom = {...model.rom, revision: rom[0x1e], byteLength: rom.length, sha256: createHash('sha256').update(rom).digest('hex')};
const output = options['--out'] ?? new URL('../web/data/map-exits-jp.json', import.meta.url);
// One factual exit per line keeps the public inventory reviewable without a full call dump.
const {archives, exits, ...metadata} = model;
const json = JSON.stringify(metadata, null, 2).slice(0, -2)
  + ',\n  "archives": [\n' + archives.map(x => '    ' + JSON.stringify(x)).join(',\n')
  + '\n  ],\n  "exits": [\n' + exits.map(x => '    ' + JSON.stringify(x)).join(',\n') + '\n  ]\n}\n';
fs.writeFileSync(output, json);
console.log(JSON.stringify({written: true, romSHA256: model.rom.sha256, ...model.summary}, null, 2));
