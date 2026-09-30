// Prepare the authorized directory-level source transfer; never copy ROM/private assets or Git metadata.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const name=process.argv[2];
if(!name||!/^c3-source-[A-Za-z0-9-]+$/.test(name))throw Error('A fresh c3-source-* staging name is required');
const manifest=JSON.parse(await fs.readFile(new URL('docs/observations/source-sync-0930.json',root),'utf8'));
const dest=new URL('private/'+name+'/',root);
await fs.mkdir(new URL('private/',root),{recursive:true});
await fs.mkdir(dest); // Do not reuse/overwrite a prior snapshot.
for(const entry of manifest.entries){
 if(entry.path.includes('..')||entry.path.startsWith('/')||/\.(nds|dst|sav|dsv|ttf|png|nsbmd|nsbtx)$/i.test(entry.path))throw Error('Unexpected source payload: '+entry.path);
 const bytes=await fs.readFile(new URL(entry.path,root));
 if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Source changed since manifest: '+entry.path);
 const target=new URL(entry.path,dest);
 await fs.mkdir(new URL('./',target),{recursive:true});
 await fs.writeFile(target,bytes,{flag:'wx'});
}
await fs.writeFile(new URL('docs/observations/source-sync-0930.json',dest),JSON.stringify(manifest,null,2),{flag:'wx'});
console.log(JSON.stringify({directory:dest.pathname,files:manifest.entries.length+1,treeSha256:manifest.treeSha256,bytes:manifest.entries.reduce((s,e)=>s+e.bytes,0)},null,2));
