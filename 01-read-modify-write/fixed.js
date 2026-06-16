function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function randomDelay(max = 50) {
  return sleep(Math.floor(Math.random() * max));
}

// Mutex
class Mutex {
  constructor() {
    this._queue = Promise.resolve(); // boş bir zincir başlatırız
  }
  runExclusive(fn) { // fn simle thread çalışacak şekilde ayarlanır(runExclusive) zincirin sonuna alınır.
    const run = this._queue.then(fn, fn); // Zincirin hata yüzünden kırılmaması için undefined döndürürüz.
    this._queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

let balance = 0;
const mutex = new Mutex();

async function readBalance() {
  await randomDelay();
  return balance;
}

async function writeBalance(value) {
  await randomDelay();
  balance = value;
}

async function add(amount) {
  // Kritik bölümün tamamı kilit altında.
  await mutex.runExclusive(async () => {
    const current = await readBalance(); // mevcut değeri getir
    const next = current + amount; //yeni değeri hesapla
    await writeBalance(next); // yeni değeri yaz
  });
}

async function main() {
  balance = 0;

  await Promise.all([add(50), add(50), add(50), add(50), add(50)]);

  console.log("Beklenen bakiye: 250");
  console.log("Gerçek bakiye:  ", balance, balance === 250 ? "(doğru)" : "<-- hala yanlış");
}

main();
