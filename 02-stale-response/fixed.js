// SENARYO 2 — Stale Response / "Son gelen kazanır" (DÜZELTİLMİŞ)
//
// Çözüm: Her isteğe artan bir ID ver. Cevap döndüğünde, bu ID hâlâ en son
// istek mi diye kontrol et. Değilse cevabı yok say. (AbortController ile de
// çözülebilir; aşağıda alternatif olarak gösterildi.)
//
// Çalıştır: node 02-stale-response/fixed.js

const { sleep } = require("../utils");

async function fakeSearch(query) {
  const delay = query.length <= 3 ? 120 : 20;
  await sleep(delay);
  return `'${query}' için sonuçlar`;
}

let shown = null;
let latestRequestId = 0;

async function onSearch(query) {
  const requestId = ++latestRequestId;
  const result = await fakeSearch(query);

  // Bu cevap geldiğinde daha yeni bir istek yapılmışsa, onu yok say.
  if (requestId !== latestRequestId) {
    console.log("Yok sayıldı (eski):", result);
    return;
  }
  shown = result;
  console.log("Ekrana yazıldı:", result);
}

async function main() {
  onSearch("rea");
  onSearch("react");

  await sleep(300);
  console.log("\nKullanıcının son sorgusu: 'react'");
  console.log("Ekranda kalan:", shown, shown.includes("'react'") ? "(doğru)" : "<-- hala yanlış");
}

main();

// ----------------------------------------------------------------------------
// ALTERNATİF: Gerçek fetch ile AbortController kullanımı
// ----------------------------------------------------------------------------
// let controller;
// async function onSearchWithAbort(query) {
//   controller?.abort();                 // önceki isteği iptal et
//   controller = new AbortController();
//   try {
//     const res = await fetch(`/search?q=${query}`, { signal: controller.signal });
//     showResults(await res.json());
//   } catch (e) {
//     if (e.name !== "AbortError") throw e; // iptal hatasını yut
//   }
// }
