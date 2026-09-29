// Copies the already-mined call-stream decoder, not the old CLI or mapname extractor.
import fs from 'node:fs/promises';
const sourceURL=new URL('../../LocalAI/work/dq9-pickup-static-loader/probe-maplist.mjs',import.meta.url);
const source=await fs.readFile(sourceURL,'utf8');
const helpers=source.slice(source.indexOf('function u16('),source.indexOf('function enumerateNitroFiles('));
const parser=source.slice(source.indexOf('function parseCalls('),source.indexOf('async function main('));
if(!helpers||!parser||!parser.includes('Math.ceil(argumentCount / 4)'))throw Error('Source decoder boundaries changed');
await fs.writeFile(new URL('../web/vendor/call-stream.mjs',import.meta.url),'// Reused verbatim from LocalAI/work/dq9-pickup-static-loader/probe-maplist.mjs. No ROM-dependent data.\n'+helpers+parser+'\nexport {u16,u32,parseCalls,decodeNumber,readPoolString,decodeMapRecords};\n');
console.log('Reused existing typed call-stream decoder');
