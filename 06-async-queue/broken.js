// SENARYO 6 — Sıralı işlenmesi gereken olaylar (BOZUK)
//
// Problem: Sırası önemli olan olaylar (örn. WebSocket mesajları, kullanıcı
// işlemleri) geldikçe paralel işleniyor. Her olayın işlenme süresi farklı
// olduğundan, sonradan gelen olay önce bitebilir ve sıra bozulur.
//
// Çalıştır: node 06-async-queue/broken.js

const { sleep } = require("../utils");

const processed = [];

async function handle(event) {
  // İlk olay bilerek daha yavaş işleniyor -> sıra bozuluyor.
  const delay = event === 1 ? 60 : 10;
  await sleep(delay);
  processed.push(event);
}

async function main() {
  processed.length = 0;

  // Olaylar 1,2,3 sırasıyla geliyor ama beklenmeden işleniyor.
  handle(1);
  handle(2);
  handle(3);

  await sleep(200);
  console.log("Beklenen sıra: [1, 2, 3]");
  console.log("İşlenen sıra: ", JSON.stringify(processed),
    JSON.stringify(processed) === "[1,2,3]" ? "" : "<-- SIRA BOZULDU!");
}

main();
