// Node test bridge for the same Worker handler; not a second search adapter.
import {parentPort} from 'node:worker_threads';
import {handleWorkerMessage} from '../web/at-identify-worker.mjs';
parentPort.on('message',message=>handleWorkerMessage(message,value=>parentPort.postMessage(value)));
