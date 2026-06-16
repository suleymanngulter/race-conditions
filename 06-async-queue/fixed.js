// SENARYO 6 — Sıralı işlenmesi gereken olaylar (DÜZELTİLMİŞ)
//
// Çözüm: Olayları bir async kuyruğa al. Her görev bir öncekinin bitmesini
// bekler (promise zinciri). Böylece işlenme süreleri farklı olsa bile sıra
// korunur.
//
// Çalıştır: node 06-async-queue/fixed.js

const { sleep } = require("../utils");

const processed = [];

// İşleri tek tek, sırayla çalıştıran kuyruk.
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch((err) => console.error("Görev hatası:", err));
  return queue;
}

async function handle(event) {
  const delay = event === 1 ? 60 : 10;
  await sleep(delay);
  processed.push(event);
}

async function main() {
  processed.length = 0;

  // Olaylar geldikçe kuyruğa ekleniyor; sıra garanti.
  enqueue(() => handle(1));
  enqueue(() => handle(2));
  enqueue(() => handle(3));

  await sleep(200);
  console.log("Beklenen sıra: [1, 2, 3]");
  console.log("İşlenen sıra: ", JSON.stringify(processed),
    JSON.stringify(processed) === "[1,2,3]" ? "(doğru)" : "<-- hala bozuk");
}

main();
