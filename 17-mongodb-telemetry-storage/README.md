# Telemetri Depolama Benchmark — Normal vs Time Series

IoT telemetri verisinde (sıcaklık, nem, basınç, voltaj) **normal koleksiyon** ile
**Time Series koleksiyon** arasındaki disk kullanımını çoklu ölçekte ölçer.

Senaryo 16 genel insert/sorgu kıyaslaması yapar; bu klasör yalnızca **depolama**
araştırmasına odaklanır.

## Neden fark oluşur?

| Normal koleksiyon | Time Series |
|-------------------|-------------|
| Her ölçümde `meta.sensorId`, `region`, `model` tekrarlanır | `meta` bucket başına bir kez |
| BSON doküman + bileşik indeks | Bucket + columnar compression |
| `avgObjSize` ~150–200 B/doc | Ölçüm başına çok daha az byte |

Time Series, ardışık benzer değerleri delta encoding ile sıkıştırır; telemetri
(1 Hz, yavaş değişen sensörler) için idealdir.

## Çalıştırma

```bash
cd 17-mongodb-telemetry-storage
docker compose up -d

cd nodejs
cp .env.example .env
npm install
npm start
```

Sonuçlar: terminal + `nodejs/output/result.txt`

## Ölçülen metrikler

| Metrik | Kaynak | Anlamı |
|--------|--------|--------|
| `storageSize` | `collStats` | Diskte ayrılan sıkıştırılmış alan (**asıl kıyas**) |
| `totalIndexSize` | `collStats` | İndeks B-tree boyutu |
| Normal/doc | hesaplanan | `storageSize / count` |
| Tahmini ham BSON | `BSON.calculateObjectSize` örneklemi | Sıkıştırmasız teorik üst sınır |

## Ortam değişkenleri

| Değişken | Varsayılan |
|----------|------------|
| `STORAGE_TIERS` | `100000,500000,1000000` |
| `SENSOR_COUNT` | 50 |
| `BATCH_SIZE` | 5000 |
| `MONGODB_URI` | mongodb://127.0.0.1:27019 |

Daha büyük test:

```bash
STORAGE_TIERS=1000000,5000000 npm start
```

## Örnek sonuçlar (bu ortam, 50 sensör)

| Doküman | Normal storage | TS storage | Tasarruf | Normal/doc | TS/doc |
|---------|----------------|------------|----------|------------|--------|
| 100K | 4.48 MB | 1.88 MB | %58 | 47 B | 20 B |
| 500K | 22.43 MB | 4.38 MB | %81 | 47 B | 9 B |
| 1M | 44.83 MB | 7.63 MB | **%83** | 47 B | **8 B** |

1M ölçekte normal indeks **20.75 MB** ekler; TS indeksi yalnızca **52 KB**.

Ham BSON tahmini ~208 MB iken TS `storageSize` bunun **%3.7**'si — columnar compression etkisi.

## Beklenen eğilim

- **100K:** ~%58 tasarruf (WiredTiger minimum allocation etkisi azalır)
- **500K–1M:** **%80–85** tasarruf, ~6× daha küçük storage
- **Ölçüm/doc:** Normal ~47 B → TS ~8 B (1M ölçek)

İlgili senaryo: `16-mongodb-timeseries` (insert + aggregation kıyası).
