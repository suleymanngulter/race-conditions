const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const { createCounterPdf } = require("./lib/create-counter-pdf");
const { mergePdfs } = require("./lib/merge-pdfs");

const COUNT = Number(process.env.COUNT) || 200;
const WORKERS = Number(process.env.WORKERS) || 8;
const DIR = __dirname;

function printTimes(label, { genMs, mergeMs }) {
  const totalMs = genMs + mergeMs;
  console.log(label);
  console.log(`  Üretim : ${genMs} ms`);
  console.log(`  Merge  : ${mergeMs} ms`);
  console.log(`  Toplam : ${totalMs} ms\n`);
}

async function runSingleThread() {
  const genStart = Date.now();
  const buffers = [];

  for (let n = 1; n <= COUNT; n++) {
    buffers.push(await createCounterPdf(n));
  }
  const genMs = Date.now() - genStart;

  const mergeStart = Date.now();
  const merged = await mergePdfs(buffers);
  const mergeMs = Date.now() - mergeStart;

  fs.writeFileSync(path.join(DIR, "merged-single-thread.pdf"), merged);
  return { genMs, mergeMs };
}

function runMultiThread() {
  const chunkSize = Math.ceil(COUNT / WORKERS);
  const genStart = Date.now();

  const tasks = [];
  for (let i = 0; i < WORKERS; i++) {
    const from = i * chunkSize + 1;
    const to = Math.min((i + 1) * chunkSize, COUNT);
    if (from > COUNT) break;

    tasks.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(path.join(DIR, "worker.js"), {
          workerData: { from, to },
        });
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0) reject(new Error(`worker exit ${code}`));
        });
      })
    );
  }

  return Promise.all(tasks).then(async (chunks) => {
    const genMs = Date.now() - genStart;
    const buffers = chunks.flat();

    const mergeStart = Date.now();
    const merged = await mergePdfs(buffers);
    const mergeMs = Date.now() - mergeStart;

    fs.writeFileSync(path.join(DIR, "merged-multi-thread.pdf"), merged);
    return { genMs, mergeMs };
  });
}

async function main() {
  console.log(`COUNT=${COUNT}, WORKERS=${WORKERS}\n`);

  const single = await runSingleThread();
  printTimes("SINGLE-THREAD", single);

  const multi = await runMultiThread();
  printTimes(`MULTI-THREAD (${WORKERS} worker)`, multi);

  const speedup = (single.genMs + single.mergeMs) / (multi.genMs + multi.mergeMs);
  console.log(`Hızlanma (toplam): ${speedup.toFixed(2)}x`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
