// SENARYO 5 — Yanlış Sıralama (DÜZELTİLMİŞ)
//
// Çözüm kuralı: BAĞIMLI işler sıralı (await ile zincirleme), BAĞIMSIZ işler
// paralel (Promise.all). Burada yatırma, oluşturmaya bağlı olduğu için önce
// oluşturmayı await ediyoruz.
//
// Çalıştır: node 05-promise-ordering/fixed.js

const { sleep } = require("../utils");

let accountCreated = false;
let deposited = false;

async function createAccount() {
  await sleep(40);
  accountCreated = true;
  console.log("Hesap oluşturuldu");
}

async function deposit() {
  await sleep(10);
  if (!accountCreated) {
    console.log("HATA: Hesap yokken para yatırılmaya çalışıldı!");
    return;
  }
  deposited = true;
  console.log("Para yatırıldı");
}

async function main() {
  accountCreated = false;
  deposited = false;

  // DOĞRU: bağımlı adımlar sırayla.
  await createAccount();
  await deposit();

  console.log("\nSonuç -> hesap:", accountCreated, "| yatırma:", deposited,
    deposited ? "(doğru)" : "<-- hala başarısız");

  // Not: Eğer iki iş BAĞIMSIZ olsaydı, performans için şöyle yapardık:
  //   const [a, b] = await Promise.all([bagimsizIs1(), bagimsizIs2()]);
}

main();
