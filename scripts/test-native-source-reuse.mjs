// Private-ROM regression. Invoke with node --expose-gc and the original ROM path.
// No ROM/file bytes are emitted or saved.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NitroFS} from '../web/vendor/nitro-fs.mjs';
import {openMapRom} from '../web/map-browser-preview/static-scene.mjs';
import {buildRomMapCatalog} from '../web/map-browser-preview/rom-map-catalog.mjs';
import {planRomScene} from '../web/map-browser-preview/rom-scene-plan.mjs';
import {loadRomFloorInstances} from '../web/map-browser-preview/rom-floor-candidates.mjs';
import {sourceFloorPlanes} from '../web/monster-perspective-body.mjs';
if(!process.argv[2])throw Error('Original private ROM path required');
const rom=new Uint8Array(await fs.readFile(process.argv[2]));
const hash=b=>createHash('sha256').update(b).digest('hex');
const fileHash=nfs=>{const h=createHash('sha256');for(const b of nfs.fileData){h.update(String(b.byteLength)+':');h.update(new Uint8Array(b));}return h.digest('hex');};
const nitro=NitroFS.fromRom(rom.buffer),romBefore=hash(rom),filesBefore=fileHash(nitro),runs=[];
let sourceEvidence=null;
for(let i=0;i<3;i++)for(const kind of(i%2?['shared','isolated']:['isolated','shared'])){
 global.gc?.();const start=performance.now(),p=openMapRom(rom,kind==='shared'?{nitroFS:nitro}:undefined),ms=performance.now()-start;
 assert.equal(fileHash(p.nfs),filesBefore);assert.equal(p.nfs===nitro,kind==='shared');
 runs.push({kind,ms,nitroFileCount:p.nfs.fileData.length,nitroFileBytes:p.nfs.fileData.reduce((n,b)=>n+b.byteLength,0)});
 if(i===0){
  const catalog=buildRomMapCatalog(p),record=process.argv[3]?catalog.maps.find(r=>r.key===process.argv[3]):null;
  if(process.argv[3])assert(record,'Requested source record missing');
  const floor=record?sourceFloorPlanes(loadRomFloorInstances(p,planRomScene(p,record))):null,result={catalog:catalog.maps,record,floor};
  if(kind==='isolated')sourceEvidence=result;else assert.deepEqual(result,sourceEvidence);
 }
}
assert.equal(hash(rom),romBefore);assert.equal(fileHash(nitro),filesBefore);
assert.throws(()=>openMapRom(rom,{nitroFS:{}}),/Parsed source NitroFS required/);
console.log(JSON.stringify({passed:true,romSHA256:romBefore,filesSHA256:filesBefore,catalogEqual:true,floorChecked:Boolean(process.argv[3]),sourceBytesUnchanged:true,runs},null,2));
