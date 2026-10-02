import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {decodeActorArm9} from '../web/actor-rom-mining.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){assert(args[i]?.startsWith('--')&&args[i+1],'Named path arguments required');options[args[i].slice(2)]=path.resolve(args[i+1]);}
for(const k of ['runtime','rom','sav','route','out'])assert(options[k],`Missing --${k}`);
const {NodeWasmSession}=await import(pathToFileURL(path.join(options.runtime,'scripts/headless-node-session.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const rom=await fs.readFile(options.rom),sav=await fs.readFile(options.sav);
assert.equal(sha(rom),'3c9d809eb8e446b0da6a9b383c7a6c5146001636038384aa49cb1a2e367546d7');
assert.equal(sha(sav),'a8c17883c88168a0670ab61467272b4aeac151e5c6b8b69868adca9da8c1712a');
await fs.mkdir(options.out,{recursive:false});
const isolated=path.join(options.out,'run-input.sav');await fs.writeFile(isolated,sav);
const arm=decodeActorArm9(rom);assert.equal(sha(arm.bytes),'a613ad20a3eae775d39d809f6da067fba72e8f527f5709b6c0e940a318d87167');
const defaultSites=[0x02003c30,0x02003c54,0x02003c64,0x0203d560,0x0203d66c,0x020409bc,0x020409d0,0x0203cccc];
const sessions=[new NodeWasmSession({assets:path.join(options.runtime,'runtime-assets'),timeoutMs:120000,loadTimeoutMs:120000}),new NodeWasmSession({assets:path.join(options.runtime,'runtime-assets'),timeoutMs:120000,loadTimeoutMs:120000})];
const events=[],comparisons=[],commands=[],snapshots=[],bindings=[],drains=[];let frame=0,sites=defaultSites,wordAddresses=[0x020eee90,0x020fb11c,0x020f8e28,0x020f37b4],profileSerial=0;
const summary={schema:'work8-native-entry-v1',romSha256:sha(rom),saveSha256:sha(sav),runtimeBase:'a2e06d7f7a924d633f425de6c1d7e2e47d94cd13',observer:'bounded-v3-nonstopping',complete:false};
const memory=async(s,address,length)=>Buffer.from((await s.command({command:'memory',cpu:9,address,length})).bytes);
const both=async c=>{commands.push({atFrame:frame,...c});return Promise.all(sessions.map(s=>s.command(c)));};
const persist=async()=>{summary.frame=frame;summary.events=events.length;summary.profiles=bindings;summary.comparisonCount=comparisons.length;summary.snapshotCount=snapshots.length;summary.dropped=drains.reduce((n,d)=>n+d.dropped,0);summary.drainCount=drains.length;for(const [name,value] of Object.entries({'summary.json':summary,'events.json':{events},'comparisons.json':comparisons,'commands.json':commands,'snapshots.json':snapshots,'drains.json':drains}))await fs.writeFile(path.join(options.out,name),JSON.stringify(value,null,2)+'\n');};
const compare=async(full=false,label='')=>{
 const rows=await Promise.all(sessions.map(async(s,i)=>{
  const reg9=await s.command({command:'registers',cpu:9}),reg7=await s.command({command:'registers',cpu:7}),screen=await s.command({command:'capture-frame'});
  const state=Buffer.concat(await Promise.all([[0x020eee90,4],[0x020fb11c,0x3000]].map(([a,n])=>memory(s,a,n))));
  const result={reg9,reg7,frame:screen.frame,valid:screen.valid,pixelHash:sha(screen.pixels),stateHash:sha(state),seed:state.readUInt32LE(0),mapId:state.readUInt16LE(4)};
  if(full){const chunks=[];for(let a=0x02000000;a<0x02400000;a+=65536)chunks.push(await memory(s,a,65536));const ram=Buffer.concat(chunks);result.ramHash=sha(ram);const stem=path.join(options.out,`${i?'on':'off'}-${frame}${label?'-'+label:''}`);await fs.writeFile(stem+'.ram.gz',gzipSync(ram));await fs.writeFile(stem+'.rgba.gz',gzipSync(screen.pixels));await fs.writeFile(stem+'.json',JSON.stringify(result,null,2)+'\n');}
  return result;
 }));
 const a={frame,label,mapId:rows[0].mapId,seed:rows[0].seed,registersEqual:JSON.stringify(rows[0].reg9)===JSON.stringify(rows[1].reg9)&&JSON.stringify(rows[0].reg7)===JSON.stringify(rows[1].reg7),pixelsEqual:rows[0].pixelHash===rows[1].pixelHash,stateEqual:rows[0].stateHash===rows[1].stateHash,valid:rows.every(r=>r.valid&&r.frame===frame)};
 if(full){a.ramHashes=rows.map(r=>r.ramHash);a.ramEqual=rows[0].ramHash===rows[1].ramHash;snapshots.push(a);assert(a.ramEqual,JSON.stringify(a));}
 comparisons.push(a);assert(a.registersEqual&&a.pixelsEqual&&a.stateEqual,JSON.stringify(a));if(frame>13)assert(a.valid,JSON.stringify(a));return a;
};
const configure=async(pcs=defaultSites,words=wordAddresses)=>{
 assert(pcs.length<=8&&words.length<=4);await sessions[1].command({command:'observe-enable',enabled:false});
 const identity=[];for(const address of pcs){assert(address>=arm.base&&address+4<=arm.base+arm.bytes.length,'Only ARM9 core sites in this profile');const expected=arm.bytes.subarray(address-arm.base,address-arm.base+4),actual=await memory(sessions[1],address,4);assert.equal(sha(actual),sha(expected),`ROM/live binding ${address.toString(16)}`);identity.push({address,bytesSha256:sha(actual)});}
 sites=pcs;wordAddresses=words;profileSerial++;bindings.push({profileSerial,atFrame:frame,sites:identity,wordAddresses});
 await sessions[1].command({command:'observe-configure',sites:pcs.map(address=>({cpu:9,address})),words});await sessions[1].command({command:'observe-enable',enabled:true});await compare(true,'profile-'+profileSerial);
};
const step=async(n,buttons)=>{
 assert(Number.isInteger(n)&&n>0&&n<=2000);if(buttons)await both({command:'set-input',buttons});
 for(let k=0;k<n;k++){
  await both({command:'step',frames:1,render:true});frame++;
  const before=await sessions[1].command({command:'status'}),d=await sessions[1].command({command:'observe-drain',maxEvents:1024}),after=await sessions[1].command({command:'status'});
  assert.equal(before.frame,after.frame);assert.equal(d.dropped,0,'Observer overflow invalidates completeness');
  drains.push({frame,profileSerial,beforeFrame:before.frame,afterFrame:after.frame,dropped:d.dropped,count:d.events.length,firstSequence:d.events[0]?.sequence??null,lastSequence:d.events.at(-1)?.sequence??null,capacity:d.capacity??null,observerEnabled:d.enabled??null});
  const prior=events.filter(e=>e.profileSerial===profileSerial).at(-1)?.sequence??-1;
  assert(d.events.every((e,i)=>e.sequence===prior+1+i),'Observer sequence gap');
  events.push(...d.events.map(e=>({...e,profileSerial,wordAddresses})));
  const previous=comparisons.at(-1),c=await compare(false);
  if((previous&&previous.mapId!==c.mapId)||d.events.some(e=>e.pc===0x0203d560)||d.events.some(e=>e.pc===0x02003c64))await compare(true,'boundary');
 }
 const c=await compare(true,'segment');await persist();console.log(JSON.stringify({frame,events:events.length,...c}));
};
try{
 await Promise.all(sessions.map(s=>s.start()));summary.runtime=sessions.map(s=>s.runtime);
 await Promise.all(sessions.map(s=>s.loadRom(options.rom)));summary.saveImport=await both({command:'import-save',path:isolated});
 for(;frame<=180;){const matched=await Promise.all(defaultSites.map(async address=>sha(await memory(sessions[1],address,4))===sha(arm.bytes.subarray(address-arm.base,address-arm.base+4))));if(matched.every(Boolean))break;if(frame===180)throw Error('Complete core profile code binding absent');await both({command:'step',frames:1,render:true});frame++;}
 summary.attachFrame=frame;await configure();
 const routeFile=await fs.readFile(options.route),routeBytes=options.route.endsWith('.gz')?gunzipSync(routeFile):routeFile;
 const route=JSON.parse(routeBytes);assert.equal(frame,route.attachFrame);summary.routeSha256=sha(routeBytes);
 for(const segment of route.segments)await step(segment.frames,segment.buttons);
 assert.equal(frame,1910);summary.origin=await compare(true,'origin');assert.equal(summary.origin.mapId,108);assert.equal(summary.origin.seed,1536043482);
 summary.historicalOrigin={expectedSha256:'0b89624e33e43ebaaeb887ab3ba3695be40f9e70d2d8b0e7384782c0ccf012e9',matches:summary.origin.ramHashes[0]==='0b89624e33e43ebaaeb887ab3ba3695be40f9e70d2d8b0e7384782c0ccf012e9',role:'Comparison only; this run uses its captured pre-entry state without edits'};
 if(options['reference-ram']){
  const referenceFile=await fs.readFile(options['reference-ram']),reference=options['reference-ram'].endsWith('.gz')?gunzipSync(referenceFile):referenceFile;
  assert.equal(sha(reference),summary.historicalOrigin.expectedSha256);
  const current=gunzipSync(await fs.readFile(path.join(options.out,`on-${frame}-origin.ram.gz`)));assert.equal(reference.length,current.length);
  const differences=[];for(let i=0;i<current.length;){if(current[i]===reference[i]){i++;continue;}const start=i;while(i<current.length&&current[i]!==reference[i])i++;differences.push({address:0x02000000+start,length:i-start,referenceHex:reference.subarray(start,i).toString('hex'),currentHex:current.subarray(start,i).toString('hex')});}
  summary.historicalOrigin.differences=differences;
 }
 await persist();console.log(JSON.stringify({ready:true,frame,origin:summary.origin}));
 if(options.schedule){const schedule=JSON.parse(await fs.readFile(options.schedule,'utf8'));summary.scheduleSha256=sha(await fs.readFile(options.schedule));for(const segment of schedule.segments){if(segment.sites)await configure(segment.sites,segment.words??wordAddresses);await step(segment.frames,segment.buttons);}summary.complete=true;}
 else {for await(const line of readline.createInterface({input:process.stdin})){const c=JSON.parse(line);if(c.command==='close'){summary.complete=true;break;}if(c.command==='step')await step(c.frames,c.buttons);else if(c.command==='snapshot'){console.log(JSON.stringify(await compare(true,c.label??'manual')));await persist();}else if(c.command==='profile'){await configure(c.sites,c.words??wordAddresses);await persist();console.log(JSON.stringify({configured:true,frame,profileSerial}));}else if(c.command==='memory')console.log(JSON.stringify({frame,address:c.address,bytes:[...await memory(sessions[1],c.address,c.length)]}));else throw Error('Unsupported capture control');}}
}catch(error){summary.error=error.stack;console.error(error.stack);process.exitCode=1;}
finally{summary.originalUnchanged=sha(await fs.readFile(options.sav))===summary.saveSha256;await persist();await Promise.allSettled(sessions.map(s=>s.close()));}
