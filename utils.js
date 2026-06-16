// Ortak yardımcılar — tüm senaryolarda async gecikmeleri taklit etmek için kullanılır.

// Belirtilen ms kadar bekler.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 0..max ms arası rastgele gecikme. Race condition'ları görünür kılmak için
// işlemlerin tamamlanma sırasını rastgeleleştirir.
function randomDelay(max = 50) {
  return sleep(Math.floor(Math.random() * max));
}

// Basit bir "veritabanı/ağ" taklidi: okuma/yazma gecikmeli yapılır.
class FakeStore {
  constructor(initial = {}) {
    this._data = { ...initial };
  }

  async get(key) {
    await randomDelay();
    return this._data[key];
  }

  async set(key, value) {
    await randomDelay();
    this._data[key] = value;
  }
}

module.exports = { sleep, randomDelay, FakeStore };
