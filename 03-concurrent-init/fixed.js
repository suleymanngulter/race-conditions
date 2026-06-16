// SENARYO 3 — Çift Başlatma / Cache Stampede (DÜZELTİLMİŞ)
//
// Çözüm: Sonucu değil, PROMISE'in kendisini cache'le (in-flight deduplication).
// İlk çağrı promise'i oluşturur; aynı anda gelen diğer çağrılar aynı promise'i
// bekler. Böylece pahalı işlem yalnızca bir kez çalışır.
//
// Çalıştır: node 03-concurrent-init/fixed.js

const { sleep } = require("../utils");

let cachePromise = null;
let fetchCount = 0;

async function fetchConfig() {
  fetchCount++;
  await sleep(50);
  return { feature: "on" };
}

function getConfig() {
  if (!cachePromise) {
    cachePromise = fetchConfig();
    // Not: İşlem başarısız olursa tekrar denenebilsin diye cache'i temizle.
    cachePromise.catch(() => {
      cachePromise = null;
    });
  }
  return cachePromise;
}

async function main() {
  fetchCount = 0;
  cachePromise = null;

  await Promise.all([getConfig(), getConfig(), getConfig(), getConfig(), getConfig()]);

  console.log("Beklenen fetchConfig çağrısı: 1");
  console.log("Gerçek çağrı sayısı:        ", fetchCount, fetchCount === 1 ? "(doğru)" : "<-- hala çift");
}

main();
