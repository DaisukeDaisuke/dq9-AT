// Reuse the existing user-authored GPU matcher instead of reimplementing its raster scoring.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=await fs.readFile(new URL('../../font_akinator_webgpu.html',import.meta.url),'utf8');
const gpu=source.slice(source.indexOf('async function getGPU(){'),source.indexOf('\nfunction decodeIndex('));
const helpers=source.split(/\r?\n/).filter(line=>line.startsWith('function maskInfo(')||line.startsWith('function buildPrefix(')).join('\n');
if(!gpu.includes('@compute')||!helpers.includes('function buildPrefix'))throw Error('Expected reference matcher anchors not found');
const text=`// Extracted without algorithm changes from font_akinator_webgpu.html.\n// Source SHA256: ${createHash('sha256').update(source).digest('hex')}\nconst WORKGROUP=64,CSS_DPI=96,POINTS_PER_INCH=72;\nconst state={gpu:null};\n${helpers}\n${gpu}\nexport {getGPU,makeBuffer,maskInfo,buildPrefix};\n`;
await fs.writeFile(new URL('../web/vendor/font-match-reference.mjs',import.meta.url),text);
console.log(JSON.stringify({output:'web/vendor/font-match-reference.mjs',sourceSha256:createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(text)}));
