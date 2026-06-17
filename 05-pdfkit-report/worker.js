const { parentPort, workerData } = require("worker_threads");
const { createCounterPdf } = require("./lib/create-counter-pdf");

async function run() {
  const { from, to } = workerData;
  const buffers = [];

  for (let n = from; n <= to; n++) {
    buffers.push(await createCounterPdf(n));
  }

  parentPort.postMessage(buffers);
}

run().catch((err) => {
  throw err;
});