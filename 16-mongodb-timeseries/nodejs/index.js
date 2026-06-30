/**
 * MongoDB Time Series vs Normal Koleksiyon Karşılaştırması
 * --------------------------------------------------------
 * Senaryo: 50 IoT sensörü, her biri 2000 ölçüm (toplam 100.000 doküman)
 * Ölçülenler: 1) Insert hızı  2) Disk/index boyutu  3) Aggregation sorgu hızı
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "ts_demo";

const SENSOR_COUNT = Number(process.env.SENSOR_COUNT) || 50;
const MEASUREMENTS_PER_SENSOR = Number(process.env.MEASUREMENTS_PER_SENSOR) || 2000;
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 1000;

const NORMAL_COLL = "normal_readings";
const TS_COLL = "ts_readings";

function fmtMs(ms) {
  return `${ms.toFixed(0)} ms`;
}

function fmtBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function generateReadings() {
  const readings = [];
  const start = new Date(Date.now() - MEASUREMENTS_PER_SENSOR * 1000);

  for (let s = 0; s < SENSOR_COUNT; s++) {
    const sensorId = `sensor-${String(s).padStart(3, "0")}`;
    let baseTemp = 18 + Math.random() * 10;
    for (let i = 0; i < MEASUREMENTS_PER_SENSOR; i++) {
      baseTemp += (Math.random() - 0.5) * 0.3;
      readings.push({
        timestamp: new Date(start.getTime() + i * 1000),
        sensorId,
        temperature: Math.round(baseTemp * 100) / 100,
        humidity: Math.round((40 + Math.random() * 20) * 100) / 100,
        battery: Math.round((3.0 + Math.random() * 0.7) * 100) / 100,
      });
    }
  }
  return readings;
}

function cloneDocs(docs) {
  return docs.map((d) => ({ ...d }));
}

async function insertInBatches(coll, docs) {
  const t0 = performance.now();
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await coll.insertMany(docs.slice(i, i + BATCH_SIZE), { ordered: false });
  }
  return performance.now() - t0;
}

async function runAggregation(coll) {
  const t0 = performance.now();
  await coll
    .aggregate([
      {
        $group: {
          _id: {
            sensorId: "$sensorId",
            hour: { $dateTrunc: { date: "$timestamp", unit: "hour" } },
          },
          avgTemp: { $avg: "$temperature" },
          avgHumidity: { $avg: "$humidity" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.sensorId": 1, "_id.hour": 1 } },
    ])
    .toArray();
  return performance.now() - t0;
}

function buildReport(data) {
  const lines = [];
  const push = (s = "") => lines.push(s);

  push("MongoDB Time Series vs Normal Koleksiyon Benchmark");
  push(`Tarih       : ${new Date().toISOString()}`);
  push(`Sensör      : ${SENSOR_COUNT}`);
  push(`Ölçüm/sensör: ${MEASUREMENTS_PER_SENSOR}`);
  push(`Toplam doc  : ${(SENSOR_COUNT * MEASUREMENTS_PER_SENSOR).toLocaleString()}`);
  push(`Batch       : ${BATCH_SIZE}`);
  push("");

  push("--- Insert süresi ---");
  push(`Normal      : ${fmtMs(data.normalInsertMs)}`);
  push(`Time Series : ${fmtMs(data.tsInsertMs)}`);
  push("");

  push("--- collStats (storageSize / totalIndexSize) ---");
  push(`Normal      : storage ${fmtBytes(data.normalStats.storageSize)} | index ${fmtBytes(data.normalStats.totalIndexSize)} | count ${data.normalStats.count}`);
  push(`Time Series : storage ${fmtBytes(data.tsStats.storageSize)} | index ${fmtBytes(data.tsStats.totalIndexSize || 0)} | buckets ${data.tsStats.timeseries?.bucketCount ?? data.tsStats.count ?? "—"}`);
  push(`Tasarruf    : ~%${data.storageSavingPct.toFixed(1)} disk (storageSize)`);
  push("");

  push("--- Aggregation (saatlik ortalama sıcaklık) ---");
  push(`Normal      : ${fmtMs(data.normalQueryMs)}`);
  push(`Time Series : ${fmtMs(data.tsQueryMs)}`);
  push("");

  push("--- Çıkarımlar ---");
  push("1. Time Series, tekrarlayan meta (sensorId) ve ardışık ölçümleri bucket/compression ile saklar.");
  push("2. storageSize farkı küçük veri setinde (100K) sınırlı kalabilir; MEASUREMENTS_PER_SENSOR=20000+ ile belirginleşir.");
  push("3. Aggregation zaman aralığı sorgularında TS koleksiyonu genelde avantajlıdır (veri zaman sırasına göre yazılır).");
  push("4. granularity: 'seconds' — ölçüm aralığı değişirse granularity de güncellenmeli.");
  push("5. expireAfterSeconds demo'da 1 yıl; üretimde TTL politikanıza göre ayarlayın.");

  return lines.join("\n");
}

function writeReport(data) {
  const report = buildReport(data);
  const dir = path.join(__dirname, "output");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "result.txt");
  fs.writeFileSync(file, report, "utf8");
  console.log(`\nRapor: ${file}`);
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const total = SENSOR_COUNT * MEASUREMENTS_PER_SENSOR;
  console.log(`\n=== Veri: ${SENSOR_COUNT} sensör x ${MEASUREMENTS_PER_SENSOR} = ${total.toLocaleString()} doküman ===\n`);
  const readings = generateReadings();

  await db.collection(NORMAL_COLL).drop().catch(() => {});
  await db.collection(TS_COLL).drop().catch(() => {});

  await db.createCollection(NORMAL_COLL);
  const normalColl = db.collection(NORMAL_COLL);
  await normalColl.createIndex({ sensorId: 1, timestamp: 1 });

  console.log("--- NORMAL koleksiyona yazılıyor ---");
  const normalInsertMs = await insertInBatches(normalColl, cloneDocs(readings));
  console.log(`Normal insert: ${fmtMs(normalInsertMs)}`);

  await db.createCollection(TS_COLL, {
    timeseries: {
      timeField: "timestamp",
      metaField: "sensorId",
      granularity: "seconds",
    },
    expireAfterSeconds: 60 * 60 * 24 * 365,
  });
  const tsColl = db.collection(TS_COLL);

  console.log("\n--- TIME SERIES koleksiyona yazılıyor ---");
  const tsInsertMs = await insertInBatches(tsColl, cloneDocs(readings));
  console.log(`Time Series insert: ${fmtMs(tsInsertMs)}`);

  const normalStats = await db.command({ collStats: NORMAL_COLL });
  const tsStats = await db.command({ collStats: TS_COLL });

  console.log("\n=== DEPOLAMA ===");
  console.log(`Normal     -> storage: ${fmtBytes(normalStats.storageSize)} | index: ${fmtBytes(normalStats.totalIndexSize)} | docs: ${normalStats.count}`);
  console.log(`TimeSeries -> storage: ${fmtBytes(tsStats.storageSize)} | index: ${fmtBytes(tsStats.totalIndexSize || 0)} | buckets: ${tsStats.timeseries?.bucketCount ?? tsStats.count ?? "—"}`);

  const storageSavingPct = (1 - tsStats.storageSize / normalStats.storageSize) * 100;
  console.log(`>> Time Series ~%${storageSavingPct.toFixed(1)} daha az storageSize`);

  console.log("\n=== AGGREGATION (saatlik ortalama) ===");
  const normalQueryMs = await runAggregation(normalColl);
  console.log(`Normal sorgu: ${fmtMs(normalQueryMs)}`);
  const tsQueryMs = await runAggregation(tsColl);
  console.log(`Time Series sorgu: ${fmtMs(tsQueryMs)}`);

  console.log("\n=== ÖZET ===");
  console.log(`Insert : Normal ${fmtMs(normalInsertMs)} vs TS ${fmtMs(tsInsertMs)}`);
  console.log(`Sorgu  : Normal ${fmtMs(normalQueryMs)} vs TS ${fmtMs(tsQueryMs)}`);
  console.log(`Disk   : Normal ${fmtBytes(normalStats.storageSize)} vs TS ${fmtBytes(tsStats.storageSize)}`);

  writeReport({
    normalInsertMs,
    tsInsertMs,
    normalStats,
    tsStats,
    storageSavingPct,
    normalQueryMs,
    tsQueryMs,
  });

  await client.close();
}

main().catch((err) => {
  console.error("Hata:", err);
  process.exit(1);
});
