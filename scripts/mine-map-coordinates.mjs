#!/usr/bin/env node
// Caller-owned ROM only. Does not export ROM/image payloads or use a network.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MapProject} from '../web/map-core.mjs';
import {buildMapCoordinateIndex,mapCoordinateIndexCSV} from '../web/map-coordinate-index.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--rom','--out','--csv'].includes(args[i])||!args[i+1])throw Error('Usage: node scripts/mine-map-coordinates.mjs --rom local.nds --out local-index.json [--csv local-index.csv]');options[args[i]]=args[i+1];}
if(!options['--rom']||!options['--out'])throw Error('Explicit --rom and --out required');
const rom=await fs.readFile(options['--rom']),project=new MapProject(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength),''),result=buildMapCoordinateIndex(project.metadata());
result.rom={...result.rom,revision:rom[0x1e],byteLength:rom.length,sha256:createHash('sha256').update(rom).digest('hex')};
await fs.writeFile(options['--out'],JSON.stringify(result,null,2));if(options['--csv'])await fs.writeFile(options['--csv'],mapCoordinateIndexCSV(result));
console.log(JSON.stringify({written:true,summary:result.summary,calibration:'not-independently-calibrated'}));
