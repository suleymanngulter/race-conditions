// SENARYO 4 — Check-Then-Act / TOCTOU (BOZUK)
//
// Problem: "Önce kontrol et, sonra uygula" deseni. Kullanıcı var mı diye
// bakılıyor, yoksa ekleniyor. İki istek aynı anda gelince ikisi de "yok"
// görür ve ikisi de ekler -> yinelenen (duplicate) kayıt.
// (TOCTOU = Time Of Check To Time Of Use)
//
// Çalıştır: node 04-check-then-act/broken.js

const { sleep } = require("../utils");

const users = []; // "veritabanı" tablosu

async function findUser(email) {
  // Sabit gecikme: üç isteğin "kontrol" adımı da, herhangi biri "insert"
  // yapmadan önce tamamlanır -> race condition güvenilir şekilde tetiklenir.
  await sleep(30);
  return users.find((u) => u.email === email);
}

async function insertUser(email) {
  await sleep(10);
  users.push({ email });
}

async function createUser(email) {
  const existing = await findUser(email); // KONTROL
  if (!existing) {
    await insertUser(email);              // UYGULA
  }
}

async function main() {
  users.length = 0;

  // Aynı e-posta için 3 eşzamanlı kayıt isteği.
  await Promise.all([
    createUser("a@x.com"),
    createUser("a@x.com"),
    createUser("a@x.com"),
  ]);

  console.log("Beklenen kayıt sayısı: 1");
  console.log("Gerçek kayıt sayısı:  ", users.length, users.length === 1 ? "" : "<-- DUPLICATE!");
}

main();
