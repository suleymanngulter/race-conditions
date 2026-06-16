// SENARYO 5 — Yanlış Sıralama / bağımlı işleri paralel çalıştırmak (BOZUK)
//
// Problem: Birbirine BAĞIMLI adımlar yanlışlıkla paralel (Promise.all) ya da
// "await edilmeden" başlatılınca, sonraki adım önceki adımın sonucuna
// güvenemez. Burada: önce hesabı oluşturup sonra o hesaba para yatırmak
// gerekiyor; ama ikisi paralel başlatılınca yatırma, oluşturmadan önce
// çalışabiliyor.
//
// Çalıştır: node 05-promise-ordering/broken.js

const { sleep } = require("../utils");

let accountCreated = false;
let deposited = false;

async function createAccount() {
  await sleep(40); // oluşturma yavaş
  accountCreated = true;
  console.log("Hesap oluşturuldu");
}

async function deposit() {
  await sleep(10); // yatırma hızlı
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

  // YANLIŞ: bağımlı işler aynı anda başlatılıyor.
  await Promise.all([createAccount(), deposit()]);

  console.log("\nSonuç -> hesap:", accountCreated, "| yatırma:", deposited,
    deposited ? "" : "<-- YATIRMA BAŞARISIZ (sıralama hatası)");
}

main();
