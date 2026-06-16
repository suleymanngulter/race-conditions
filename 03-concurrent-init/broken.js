// SENARYO 3 — Çift Başlatma / Cache Stampede (BOZUK)
//
// Problem: Pahalı bir başlatma (config/DB bağlantısı/token alma) ilk çağrıda
// yapılıp cache'leniyor. Ama iki çağrı AYNI ANDA gelince ikisi de cache'i boş
// görür ve pahalı işlem birden fazla kez çalışır.
//
// Çalıştır: node 03-concurrent-init/broken.js

const { sleep } = require("../utils");

let cache = null;
let fetchCount = 0;

async function fetchConfig() {
  fetchCount++;
  await sleep(50); // pahalı işlem
  return { feature: "on" };
}

async function getConfig() {
  if (!cache) {
    cache = await fetchConfig();
  }
  return cache;
}

async function main() {
  fetchCount = 0;
  cache = null;

  // 5 yer aynı anda config istiyor.
  await Promise.all([getConfig(), getConfig(), getConfig(), getConfig(), getConfig()]);

  console.log("Beklenen fetchConfig çağrısı: 1");
  console.log("Gerçek çağrı sayısı:        ", fetchCount, fetchCount === 1 ? "" : "<-- ÇİFT BAŞLATMA!");
}

main();
