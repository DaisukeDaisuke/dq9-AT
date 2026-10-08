import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const html=await fs.readFile(new URL('../web/map-recognize.html',import.meta.url),'utf8'),main=await fs.readFile(new URL('../web/index.html',import.meta.url),'utf8'),app=await fs.readFile(new URL('../web/app.mjs',import.meta.url),'utf8'),panel=await fs.readFile(new URL('../web/video-panel.mjs?v=capture-catchup-20261008-e9f42247',import.meta.url),'utf8');
let checks=0;const ok=v=>{assert(v);checks++};
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);checks++;
for(const id of app.match(/Object\.fromEntries\(\[(.*?)\]\.map/s)[1].matchAll(/'([^']+)'/g))ok(ids.includes(id[1]));
assert.deepEqual([...html.matchAll(/<script type="module" src="([^\"]+)"/g)].map(m=>m[1].split('?')[0]),['./app.mjs','./video-panel.mjs']);checks++;
ok(ids.includes('map-capture-host'));ok(panel.includes("document.getElementById('map-capture-host')||document.querySelector('.workspace')"));
ok(main.includes('href="./map-recognize.html"'));ok(main.includes('href="./monster-recognize.html"'));ok(html.includes('href="./index.html"'));ok(html.includes('映像の点の位置から建物などのmap ID候補'));ok(html.includes('同じ位置の階層・屋外位置・未探索'));ok(panel.includes('appendMapPositionIdentification(host,r.partyCoordinates?.mapIdIdentification'));ok(html.includes('現在マップを確定しません'));ok(panel.includes('id="cpu-text-budget"'));ok(panel.includes('id="cpu-text-once"'));ok(panel.includes('id="cpu-text-release"'));
for(const m of html.matchAll(/(?:src|href)="\.\/([^\"]+)"/g)){await fs.access(new URL('../web/'+m[1],import.meta.url));checks++;}
console.log(JSON.stringify({passed:true,checks,scope:'dedicated shell IDs/imports/local links and preserved main/monster entry links; no browser visual claim'}));
