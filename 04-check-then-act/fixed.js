// SENARYO 4 — Check-Then-Act / TOCTOU (DÜZELTİLMİŞ)
//
// Çözüm: "Kontrol et + uygula" adımını ATOMİK yap. Gerçek hayatta bu, DB
// seviyesinde UNIQUE constraint + "INSERT ... ON CONFLICT" (upsert) ile yapılır.
// Burada bunu, kritik bölümü bir kilit (mutex) altına alarak taklit ediyoruz.
//
// Çalıştır: node 04-check-then-act/fixed.js

const { randomDelay } = require("../utils");

class Mutex {
  constructor() {
    this._queue = Promise.resolve();
  }
  runExclusive(fn) {
    const run = this._queue.then(fn, fn);
    this._queue = run.then(() => undefined, () => undefined);
    return run;
  }
}

const users = [];
const mutex = new Mutex();

async function findUser(email) {
  await randomDelay();
  return users.find((u) => u.email === email);
}

async function insertUser(email) {
  await randomDelay();
  users.push({ email });
}

async function createUser(email) {
  // Kontrol ve ekleme tek bir atomik bölümde.
  await mutex.runExclusive(async () => {
    const existing = await findUser(email);
    if (!existing) {
      await insertUser(email);
    }
  });
}

async function main() {
  users.length = 0;

  await Promise.all([
    createUser("a@x.com"),
    createUser("a@x.com"),
    createUser("a@x.com"),
  ]);

  console.log("Beklenen kayıt sayısı: 1");
  console.log("Gerçek kayıt sayısı:  ", users.length, users.length === 1 ? "(doğru)" : "<-- hala duplicate");
}

main();

// ----------------------------------------------------------------------------
// GERÇEK DB ÇÖZÜMÜ (kavramsal):
//   CREATE UNIQUE INDEX ON users(email);
//   INSERT INTO users(email) VALUES ($1) ON CONFLICT (email) DO NOTHING;
// Böylece eşzamanlılık kontrolünü veritabanı garanti eder; uygulama kodunda
// kilit tutmaya gerek kalmaz.
