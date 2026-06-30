# MongoDB Time Series vs Normal Koleksiyon

50 sensör × 2000 ölçüm (toplam **100.000** doküman) ile insert hızı, `collStats`
depolama boyutu ve aggregation sorgu süresini karşılaştırır.

## 1. MongoDB'yi ayağa kaldır

```bash
cd 16-mongodb-timeseries
docker compose up -d
```

Alternatif (tek komut):

```bash
docker run -d --name mongo-ts -p 27017:27017 mongo:7
```

> Time Series MongoDB **5.0+** gerektirir; `$dateTrunc` için **6.0+** önerilir.
> Port **27018** (docker-compose). Başka senaryolar 27017 kullanıyorsa çakışma olmaz.

## 2. Kurulum ve çalıştırma

```bash
cd nodejs
cp .env.example .env
npm install
npm start
```

Sonuçlar terminalde ve `nodejs/output/result.txt` dosyasında.

## Ne ölçülür?

| Metrik | Açıklama |
|--------|----------|
| Insert | 1000'lik batch `insertMany` — normal vs time series |
| Depolama | `collStats.storageSize` + `totalIndexSize` |
| Sorgu | Sensör bazında saatlik ortalama sıcaklık (`$dateTrunc` + `$group`) |

## Örnek sonuçlar (bu ortam)

**100K doküman** (varsayılan):

| | Normal | Time Series |
|---|--------|-------------|
| Insert | ~536 ms | ~403 ms |
| Aggregation | ~76 ms | ~36 ms |
| storageSize | 4 KB | 4 KB (fark minimal) |

**1M doküman** (`MEASUREMENTS_PER_SENSOR=20000`):

| | Normal | Time Series |
|---|--------|-------------|
| Insert | ~5015 ms | ~4130 ms |
| Aggregation | ~721 ms | ~339 ms |
| storageSize | 21.58 MB | 1.86 MB (~%91 tasarruf) |

## Büyük veri (farkı net görmek için)

```bash
MEASUREMENTS_PER_SENSOR=20000 npm start   # 1M doküman
```

100K doküman storage farkını göstermek için az kalabilir; 20K–50K ölçüm/sensör önerilir.

## Ayarlanabilir parametreler (`.env`)

| Değişken | Varsayılan |
|----------|------------|
| `SENSOR_COUNT` | 50 |
| `MEASUREMENTS_PER_SENSOR` | 2000 |
| `BATCH_SIZE` | 1000 |
| `MONGODB_URI` | mongodb://127.0.0.1:27017 |

## Beklenen eğilim

- **Storage:** Time Series, columnar compression ile daha küçük `storageSize`
- **Insert:** Benzer veya TS biraz hızlı (ölçek büyüdükçe fark artar)
- **Aggregation:** Zaman aralığı sorgularında TS genelde daha hızlı

`granularity: "seconds"` — ölçüm sıklığını değiştirirsen granularity'yi de güncelle.
