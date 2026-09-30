// Verify the user-requested folder synchronization, not application behavior.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),manifestPath='docs/observations/source-sync-0930.json';
const folders=['web','wasm','scripts','docs','.github'];
const roots=['.gitignore','.gitmodules','PLAN.md','DECISIONS.md','README.md','LICENSE','protocol.txt'];
const entries=[];
async function visit(path){if(path===manifestPath)return;const stat=await fs.lstat(new URL(path,root));if(stat.isSymbolicLink())throw Error('Unexpected link in source-transfer selection: '+path);if(stat.isDirectory()){for(const name of (await fs.readdir(new URL(path+'/',root))).sort())await visit(path+'/'+name);return;}if(!stat.isFile())throw Error('Unexpected source entry');const bytes=await fs.readFile(new URL(path,root));entries.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
for(const path of [...folders,...roots])await visit(path);entries.sort((a,b)=>a.path.localeCompare(b.path,'en'));
const treeSha256=createHash('sha256').update(entries.map(e=>`${e.path}\0${e.bytes}\0${e.sha256}\n`).join('')).digest('hex');
if(process.argv.includes('--verify')){const expected=JSON.parse(await fs.readFile(new URL(manifestPath,root),'utf8'));const a=new Map(expected.entries.map(e=>[e.path,e])),b=new Map(entries.map(e=>[e.path,e])),mismatches=[];for(const path of new Set([...a.keys(),...b.keys()])){if(a.get(path)?.sha256!==b.get(path)?.sha256)mismatches.push(path);}const result={format:'dq9-folder-sync-verification',fileCount:entries.length,totalBytes:entries.reduce((n,e)=>n+e.bytes,0),treeSha256,expectedTreeSha256:expected.treeSha256,mismatches,verified:mismatches.length===0};console.log(JSON.stringify(result,null,2));if(mismatches.length)process.exitCode=1;}
else {const result={format:'dq9-folder-sync-manifest',version:1,generatedAt:new Date().toISOString(),source:'local dq9-AT selected complete source directories',folders,rootFiles:roots,excluded:['.git','vendor gitlink worktrees','.idea','private','WebGPU.md','predecessor runtime transcript',manifestPath],entries,treeSha256};await fs.writeFile(new URL(manifestPath,root),JSON.stringify(result,null,2));console.log(JSON.stringify({manifestPath,fileCount:entries.length,totalBytes:entries.reduce((n,e)=>n+e.bytes,0),treeSha256},null,2));}
