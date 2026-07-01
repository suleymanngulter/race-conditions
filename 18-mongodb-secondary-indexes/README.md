# MongoDB Secondary Index — Production Örnekleri

11 indeks türünü gerçek sorgu kalıplarıyla gösterir: `createIndex` + örnek sorgu +
`explain("executionStats")` çıktısı.

## `npm start` vs `npm run benchmark`

| Komut | Amaç | Veri |
|-------|------|------|
| `npm start` | API/syntax demo — 11 indeks türü | ~3–4 doküman/koleksiyon |
| `npm run benchmark` | Performans kanıtı — mantıklı/mantıksız | 250K kullanıcı, 200K sipariş |

**Önemli:** `demo.js` küçük veriyle çalışır. MongoDB optimizer bazen indeks varken bile
**COLLSCAN** seçebilir (maliyet tahmincisi küçük koleksiyonda taramayı daha ucuz bulur).
Bu bir hata değildir. Gerçek performans farkı için `npm run benchmark` kullanın.

## Klasör yapısı

```
nodejs/src/
  database.js   — bağlantı + explain yardımcıları
  seed.js       — örnek veri
  indexes.js      — tüm createIndex tanımları
  demo.js         — 11 kategori syntax demo (küçük veri)
  benchmark.js    — performans karşılaştırması (büyük veri)
```

## Çalıştırma

```bash
cd 18-mongodb-secondary-indexes
docker compose up -d

cd nodejs
cp .env.example .env
npm install
npm start                 # 11 indeks türü demo
npm run benchmark         # karşılaştırmalı rapor → output/benchmark-result.txt
```

## Kapsanan indeks türleri

| # | Tür | Koleksiyon | Örnek |
|---|-----|------------|-------|
| 1 | Equality | users, orders | `username`, `status` |
| 2 | Compound (ESR) | orders, listings | `userId + createdAt`, `city + category + price` |
| 3 | Unique | products, favorites | `sku`, `userId + productId` |
| 4 | Partial | users, products | `isDeleted: false`, `stock > 0` |
| 5 | 2dsphere | restaurants | `$near` 5 km |
| 6 | Text | articles | `$text` arama (`default_language: "turkish"`) |
| 7 | TTL | sessions, promotions | `expireAfterSeconds` |
| 8 | Multikey | products | `tags` array |
| 9 | Wildcard | products | `customAttributes.$**` |
| 10 | Sparse | users | `referralCode` |
| 11 | Covered | users | projection yalnızca indeks alanları |

## ESR kuralı (Compound)

**E**quality → **S**ort → **R**ange sırasıyla alanları dizin.

```javascript
{ userId: 1, createdAt: -1 }  // equality + sort
{ city: 1, category: 1, price: 1 }
```

## Kural

Her indeks yazma maliyetini artırır. Yalnızca gerçek sorgu paternlerine göre
`explain()` ile doğrulanmış indeksler ekleyin.

İlgili: `15-mongodb-sparse-index` (sparse derinlemesine benchmark).

## Secondary Index Benchmark

```bash
npm run benchmark   # → output/benchmark-result.txt
```

### Sınırlamalar (önemli)

Bu benchmark **warm-cache / in-memory** ortamında çalışır; **disk I/O dahil değildir**.

- Seed veriyi WiredTiger cache'ine yazar; ms süreleri disk-bound üretimden **daha iyimser** olabilir.
- **docsExamined** ve **stage** cache'den bağımsızdır — asıl güvenilir karşılaştırma metrikleri bunlardır.
- COLLSCAN ms farkı yönü doğrudur; gerçek disk-bound ortamda fark **daha büyük** olur.

| ID | Senaryo | Karar |
|----|---------|-------|
| A | 250K `username` lookup | **MANTIKLI** — IXSCAN 1 doc vs COLLSCAN 250K (32ms) |
| B | 800 kayıt | **GEREKSIZ** — 0.5 vs 0.6 ms, indeks RAM maliyeti |
| C | Compound ESR | **MANTIKLI** userId+sort / **MANTIKSIZ** yalnızca sort |
| D | status %50 | **ŞÜPHELİ** — IXSCAN ama 100K doc okunur |
| E | Covered query | **MANTIKLI** — PROJECTION_COVERED, 0 doc |
| F | bio regex | **MANTIKSIZ** — indeks kullanılamaz |
| G | 20K insert | **MALİYET** — 5 indeks = 2.1× yavaş yazma |

Varsayılan: **250K** kullanıcı, **200K** sipariş, **10** tekrar medyan (`BENCHMARK_RUNS=20` CI için).
