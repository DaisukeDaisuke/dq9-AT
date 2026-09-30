// Merge a returned build directory; never overwrite newer local research metadata blindly.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),incoming=new URL('private/dq9-at-return-0930-build01/',root);
const wasm=await fs.readFile(new URL('web/wasm/map_render.wasm',incoming));
const hash=createHash('sha256').update(wasm).digest('hex');
if(hash!=='31fefd46d2656fecdd926eec94ae16aa257509d4a15f9e13bbf9a84e5d8f49fc')throw Error('Returned WASM differs from measured Codespace build');
// fs.cp inspects ancestors outside the runner's read scope. Use only explicitly
// authorized local folder entries; the network transfer itself was whole-folder.
for(const entry of await fs.readdir(new URL('web/wasm/',incoming),{withFileTypes:true})){
 if(!entry.isFile())throw Error('Unexpected WASM output directory entry');
 const path='web/wasm/'+entry.name;await fs.writeFile(new URL(path,root),await fs.readFile(new URL(path,incoming)));
}
const applied=[],preserved=[],unchanged=[];
for(const entry of await fs.readdir(new URL('docs/observations/',incoming),{withFileTypes:true})){
 if(!entry.isFile()||!entry.name.endsWith('.json'))throw Error('Unexpected build observation entry');
 const path='docs/observations/'+entry.name,remote=await fs.readFile(new URL(path,incoming));let local=null;try{local=await fs.readFile(new URL(path,root));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(local?.equals(remote)){unchanged.push(path);continue;}
 // This report was enriched locally after transfer; preserve its actual dictionary measurement.
 if(entry.name==='actual-font-mining.json'&&local&&JSON.parse(local).dictionary){preserved.push(path);continue;}
 if(local&&entry.name!=='actual-at-replay.json'){preserved.push(path);continue;}
 await fs.writeFile(new URL(path,root),remote);applied.push(path);
}
const report={source:'fuzzy-goggles-r4vqvwgrw943p5r9 folder return',recordedAt:new Date().toISOString(),wasmBytes:wasm.length,wasmSha256:hash,applied,preserved,unchangedCount:unchanged.length};
await fs.writeFile(new URL('docs/observations/build-return-0930.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
