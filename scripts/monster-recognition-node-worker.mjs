import {parentPort} from 'node:worker_threads';
import fs from 'node:fs/promises';
globalThis.self={postMessage:m=>parentPort.postMessage(m)};
globalThis.fetch=async input=>{const url=new URL(input);if(url.protocol!=='file:')throw Error('Node worker fixture permits only local resource files');try{const bytes=await fs.readFile(url);return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),text:async()=>bytes.toString('utf8')};}catch{return{ok:false};}};
await import('../web/monster-recognition-worker.mjs?v=ordinary-turn-20261009-e76d366f');
parentPort.on('message',data=>self.onmessage({data}));
