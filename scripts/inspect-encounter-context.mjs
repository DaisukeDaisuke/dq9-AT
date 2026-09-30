import fs from 'node:fs/promises';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import {decodeCalls} from '../web/map-core.mjs';
const rom=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url)),n=NitroFS.fromRom(rom.buffer.slice(rom.byteOffset,rom.byteOffset+rom.byteLength));
const path='data/prm/encfld.bin',calls=decodeCalls(new Uint8Array(n.readFile(path))),groups=[];let group;
for(const c of calls){if(c.opcode===105){group={mapId:c.values[0],condition:c.values.slice(1),calls:[]};groups.push(group);}else if(group)group.calls.push({opcode:c.opcode,values:c.values,offset:c.offset});}
const result={path,groups:groups.length,mapCount:new Set(groups.map(x=>x.mapId)).size,sample:groups.filter(g=>[7402,20003].includes(g.mapId)),conditionExamples:groups.filter(g=>g.condition.some(Boolean)).slice(0,4)};
console.log(JSON.stringify(result,null,2));
