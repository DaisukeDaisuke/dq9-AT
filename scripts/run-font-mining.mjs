// Actual ROM runtime-font generation. Persist counts/hashes only, never font or glyph assets.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import {mineRuntimeFonts} from '../web/font-core.mjs';
import {buildMapNameDictionary} from '../web/map-name-match.mjs';
const r=await fs.readFile(new URL('../../dq9_new2.nds',import.meta.url)),n=NitroFS.fromRom(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));
const start=performance.now(),result=mineRuntimeFonts(n),report={format:'dq9-actual-runtime-font-generation',recordedAt:new Date().toISOString(),romSha256:createHash('sha256').update(r).digest('hex'),archives:result.archives,summary:result.summary,fonts:result.fonts.map(f=>({name:f.name,bytes:f.data.length,sha256:createHash('sha256').update(f.data).digest('hex')})),milliseconds:performance.now()-start,retainedAssets:false};
const records=JSON.parse(await fs.readFile(new URL('../docs/mining/map-metadata.json',import.meta.url),'utf8')).records,dictionary=buildMapNameDictionary(result.glyphsBySize,records);report.dictionary={templates:dictionary.templates.length,names:new Set(dictionary.templates.map(t=>t.name)).size,coordinateBytes:dictionary.coords.byteLength,metaBytes:dictionary.metas.byteLength,source:'actual ROM glyphs and existing map-name records',gpuExecutionMeasured:false};
await fs.writeFile(new URL('../docs/observations/actual-font-mining.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
