// SINGLE THREAD — Node.js'in VARSAYILAN davranışı
//
// Tüm CPU-bound iş, ana thread'in (event loop) üzerinde SIRAYLA çalışır.
// Sonuç: iş bitene kadar event loop BLOKLANIR. Bunu kanıtlamak için her 100ms'de
// bir "kalp atışı (heartbeat)" yazdırmaya çalışan bir setInterval kuruyoruz;
// hesaplama sürerken bu kalp atışı GECİKİR / hiç çalışamaz.
//
// Çalıştır: node 08-single-vs-multi-thread/single-thread.js

const { countPrimes } = require("./cpu-task");

// Toplam aralığı 4 parçaya böleceğiz (multi-thread sürümüyle adil karşılaştırma).
const RANGE = 5_000_000;
const CHUNKS = 4;
const chunkSize = RANGE / CHUNKS;

// Event loop'un bloklandığını göstermek için kalp atışı.
let beats = 0;
const heartbeat = setInterval(() => {
  beats++;
  console.log(`   [heartbeat] event loop hala canlı (#${beats})`);
}, 100);

console.log("SINGLE THREAD: iş ana thread'de sırayla çalışıyor...");
const startedAt = Date.now();

// Tüm parçaları SIRAYLA, aynı thread'de hesapla.
let total = 0;
for (let i = 0; i < CHUNKS; i++) {
  const start = i * chunkSize;
  const end = start + chunkSize;
  total += countPrimes(start, end);
}

const ms = Date.now() - startedAt;
clearInterval(heartbeat);

console.log(`\nToplam asal sayı: ${total}`);
console.log(`Süre: ${ms} ms`);
console.log(`Bu süre boyunca çalışabilen heartbeat sayısı: ${beats}`);
console.log(
  "Not: heartbeat neredeyse hiç çalışamadı çünkü event loop bloklandı."
);
