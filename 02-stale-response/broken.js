// SENARYO 2 — Stale Response / "Son gelen kazanır" (BOZUK)
//
// Problem: Kullanıcı arama kutusuna yazdıkça her tuşta istek atılıyor. Eski bir
// sorgunun cevabı, yeni sorgunun cevabından SONRA gelebilir. Sonuçta ekranda
// kullanıcının yazdığı son sorguya ait olmayan (eski) sonuçlar kalır.
//
// Çalıştır: node 02-stale-response/broken.js

const { sleep } = require("../utils");

// Sunucu taklidi: kısa sorgular bilerek daha YAVAŞ dönüyor, böylece eski
// isteğin cevabı sonradan gelip yeni cevabın üstüne yazıyor.
async function fakeSearch(query) {
  const delay = query.length <= 3 ? 120 : 20;
  await sleep(delay);
  return `'${query}' için sonuçlar`;
}

let shown = null;

async function onSearch(query) {
  const result = await fakeSearch(query);
  shown = result; // hangi cevap en son gelirse onu gösteriyoruz
  console.log("Ekrana yazıldı:", result);
}

async function main() {
  // Kullanıcı hızlıca "rea" -> "react" yazıyor.
  onSearch("rea");
  onSearch("react");

  await sleep(300);
  console.log("\nKullanıcının son sorgusu: 'react'");
  console.log("Ekranda kalan:", shown, shown.includes("'react'") ? "(doğru)" : "<-- STALE! eski cevap kazandı");
}

main();
