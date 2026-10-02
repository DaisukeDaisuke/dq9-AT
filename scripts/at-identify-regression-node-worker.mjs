// Test-only transport controls around the real production Worker handler.
// No search implementation is copied here. Real-clock cases never replace a clock.
import {parentPort, workerData} from 'node:worker_threads';
if (workerData.simulatedBudgetClock) {
  let ticks = 0;
  Object.defineProperty(globalThis, 'performance', {
    value: {now: () => ticks++ * 20}, configurable: true,
  });
}
const {handleWorkerMessage} = await import(workerData.engine === 'low'
  ? '../web/at-identify-worker.mjs' : '../web/at-identify-index-worker.mjs');
let positiveSnapshots = 0, intercepted = false;
parentPort.on('message', message => {
  if (workerData.invalidWorkerInput && message.type === 'start') {
    message = structuredClone(message);
    if (workerData.engine === 'low') message.request.domain.intervals[0].first = -1;
    else message.request.domain.first = '0';
  }
  handleWorkerMessage(message, reply => {
    if (intercepted) return;
    const checkpoint = reply.checkpoint ?? reply.result;
    const count = checkpoint ? BigInt(workerData.engine === 'low'
      ? checkpoint.inspectedStates : checkpoint.inspectedIndices) : 0n;
    if (count > 0n) positiveSnapshots++;
    if (count > 0n && workerData.withholdAfter !== undefined
        && positiveSnapshots > workerData.withholdAfter) {
      intercepted = true;
      parentPort.postMessage({type: 'regression-diagnostic', checkpoint,
        clockSubstitution: Boolean(workerData.simulatedBudgetClock)});
      if (workerData.runtimeError) setImmediate(() => {
        throw Error('Injected native Worker error after computed, withheld checkpoint');
      });
      return;
    }
    parentPort.postMessage(reply);
  });
});
