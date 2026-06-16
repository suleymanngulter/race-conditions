// SENARYO 7 — Shared Memory Race (BOZUK)
//
// Problem: Bu sefer SAHTE değil GERÇEK paralellik var. Birden fazla Worker
// thread'i (ayrı OS thread'leri, ayrı CPU çekirdeklerinde) AYNI belleğe
// (SharedArrayBuffer) erişiyor. Her thread "oku -> +1 -> yaz" yapıyor.
//
// `view[0] += 1` tek bir atomik işlem DEĞİLDİR. CPU seviyesinde 3 adımdır:
//   1) LOAD  : belleği oku
//   2) ADD   : registerda +1
//   3) STORE : belleğe geri yaz
// İki thread aynı anda LOAD yaparsa ikisi de aynı eski değeri okur, ikisi de
// aynı yeni değeri yazar -> bir artış kaybolur (lost update). Bu, async/await
// senaryosundaki "interleaving" değil; donanım seviyesinde bir data race'tir.
//
// Çalıştır: node 07-shared-memory/broken.js

const {
  Worker,
  isMainThread,
  workerData,
} = require("worker_threads");

const WORKER_COUNT = 4; // 4 ayrı thread (gerçek paralellik)
const INCREMENTS = 200000; // her thread bu kadar +1 yapar

if (isMainThread) {
  // --- ANA THREAD ---
  // Paylaşılan bellek: tüm thread'ler aynı 4 byte'a bakar.
  const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const view = new Int32Array(sharedBuffer);
  view[0] = 0; // balance = 0

  const workers = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    // Aynı dosyayı worker olarak yeniden çalıştırıyoruz; SharedArrayBuffer'ı
    // workerData ile geçiyoruz (kopyalanmaz, AYNI bellek paylaşılır).
    workers.push(
      new Promise((resolve, reject) => {
        const w = new Worker(__filename, {
          workerData: { sharedBuffer, increments: INCREMENTS },
        });
        w.on("error", reject);
        w.on("exit", (code) =>
          code === 0 ? resolve() : reject(new Error("worker exit " + code))
        );
      })
    );
  }

  Promise.all(workers).then(() => {
    const expected = WORKER_COUNT * INCREMENTS;
    const actual = view[0];
    console.log("Beklenen bakiye:", expected);
    console.log(
      "Gerçek bakiye:   ",
      actual,
      actual === expected ? "(şanslıydık)" : "<-- LOST UPDATE! (data race)"
    );
    console.log("Kaybolan artış:  ", expected - actual);
  });
} else {
  // --- WORKER THREAD ---
  const view = new Int32Array(workerData.sharedBuffer);
  for (let i = 0; i < workerData.increments; i++) {
    // ATOMİK DEĞİL: oku-değiştir-yaz arasında başka thread araya girebilir.
    view[0] = view[0] + 1;
  }
}
