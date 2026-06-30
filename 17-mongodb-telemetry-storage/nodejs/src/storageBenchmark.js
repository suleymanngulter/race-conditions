/**
 * Telemetri depolama benchmark — normal vs Time Series koleksiyon.
 *
 * Her ölçekte aynı telemetri akışı yazılır; collStats ile storageSize,
 * totalIndexSize ve ölçüm başına byte karşılaştırılır.
 */
const fs = require("fs");
const path = require("path");
const { connect, close } = require("./database");
const { buildTelemetry, estimateLogicalBytes } = require("./telemetry");

require("dotenv").config();

const SENSOR_COUNT = Number(process.env.SENSOR_COUNT) || 50;
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 5000;
const TIERS = (process.env.STORAGE_TIERS || "100000,500000,1000000")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);

const NORMAL = "bench_normal";
const TS = "bench_timeseries";

function fmtBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function bytesPerDoc(storageSize, count) {
  return count > 0 ? storageSize / count : 0;
}

function pctSaving(normal, ts) {
  if (!normal) return 0;
  return (1 - ts / normal) * 100;
}

async function dropCollections(db, suffix) {
  await db.collection(`${NORMAL}_${suffix}`).drop().catch(() => {});
  await db.collection(`${TS}_${suffix}`).drop().catch(() => {});
}

async function setupCollections(db, suffix) {
  const normalName = `${NORMAL}_${suffix}`;
  const tsName = `${TS}_${suffix}`;

  await db.createCollection(normalName);
  await db.collection(normalName).createIndex({ "meta.sensorId": 1, timestamp: 1 });

  await db.createCollection(tsName, {
    timeseries: {
      timeField: "timestamp",
      metaField: "meta",
      granularity: "seconds",
    },
  });

  return { normalName, tsName };
}

/**
 * collStats alanları:
 * - storageSize  : diskte ayrılan (sıkıştırılmış) veri alanı
 * - totalSize    : sıkıştırılmamış veri + indeks tahmini
 * - totalIndexSize : tüm indekslerin boyutu
 * - avgObjSize   : normal koleksiyonda ortalama BSON boyutu (TS'de anlamsız)
 */
function fmtBytesPerDoc(bpd) {
  if (bpd >= 1024) return `${(bpd / 1024).toFixed(2)} KB/doc`;
  return `${bpd.toFixed(1)} B/doc`;
}

async function collStorage(db, name) {
  await db.admin().command({ fsync: 1 }).catch(() => {});
  const stats = await db.command({ collStats: name, scale: 1 });
  return {
    storageSize: stats.storageSize ?? 0,
    totalSize: stats.totalSize ?? 0,
    totalIndexSize: stats.totalIndexSize ?? 0,
    count: stats.count ?? 0,
    avgObjSize: stats.avgObjSize ?? 0,
    buckets: stats.timeseries?.bucketCount,
  };
}

async function insertTier(db, totalDocs, suffix) {
  const { normalName, tsName } = await setupCollections(db, suffix);
  const normalColl = db.collection(normalName);
  const tsColl = db.collection(tsName);
  const perSensor = Math.ceil(totalDocs / SENSOR_COUNT);

  const baseTime = Date.now() - perSensor * 1000;
  let inserted = 0;
  let batchN = [];
  let batchT = [];
  const samples = [];

  const t0 = performance.now();

  for (let s = 0; s < SENSOR_COUNT; s++) {
    for (let i = 0; i < perSensor && inserted < totalDocs; i++) {
      const doc = buildTelemetry(s, i, baseTime);
      if (samples.length < 200) samples.push(doc);

      batchN.push(doc);
      batchT.push({ ...doc, meta: { ...doc.meta } });

      if (batchN.length >= BATCH_SIZE) {
        await normalColl.insertMany(batchN, { ordered: false });
        await tsColl.insertMany(batchT, { ordered: false });
        inserted += batchN.length;
        batchN = [];
        batchT = [];
      }
    }
  }

  if (batchN.length) {
    await normalColl.insertMany(batchN, { ordered: false });
    await tsColl.insertMany(batchT, { ordered: false });
    inserted += batchN.length;
  }

  const insertMs = performance.now() - t0;
  const logicalBytes = estimateLogicalBytes(samples);
  const avgLogical = logicalBytes / samples.length;
  const estimatedTotalLogical = avgLogical * inserted;

  const normal = await collStorage(db, normalName);
  const ts = await collStorage(db, tsName);

  return {
    suffix,
    targetDocs: totalDocs,
    inserted,
    perSensor,
    insertMs,
    estimatedTotalLogical,
    avgLogicalPerDoc: avgLogical,
    normal,
    ts,
  };
}

function printTierRow(r) {
  const ratio = r.normal.storageSize / (r.ts.storageSize || 1);
  const save = pctSaving(r.normal.storageSize, r.ts.storageSize);
  console.log(
    [
      r.inserted.toLocaleString().padStart(10),
      fmtBytes(r.normal.storageSize).padStart(10),
      fmtBytes(r.ts.storageSize).padStart(10),
      fmtBytes(r.normal.totalSize).padStart(10),
      `${save.toFixed(1)}%`.padStart(8),
      `${ratio.toFixed(1)}x`.padStart(6),
      fmtBytesPerDoc(bytesPerDoc(r.normal.storageSize, r.inserted)).padStart(14),
      fmtBytesPerDoc(bytesPerDoc(r.ts.storageSize, r.inserted)).padStart(14),
      String(r.ts.buckets ?? "—").padStart(8),
    ].join(" | ")
  );
}

function buildReport(results) {
  const lines = [];
  const push = (s = "") => lines.push(s);

  push("MongoDB Telemetri Depolama Benchmark — Normal vs Time Series");
  push(`Tarih         : ${new Date().toISOString()}`);
  push(`Sensör sayısı : ${SENSOR_COUNT}`);
  push(`Batch         : ${BATCH_SIZE}`);
  push(`Ölçekler      : ${TIERS.map((t) => t.toLocaleString()).join(", ")} doküman`);
  push("");
  push("Metrik kaynağı: db.command({ collStats })");
  push("  storageSize     → diskte ayrılan sıkıştırılmış alan (asıl kıyas metriği)");
  push("  totalIndexSize  → indeks B-tree boyutu");
  push("  Tahmini ham BSON → örnek 200 dokümanın BSON.calculateObjectSize ortalaması × adet");
  push("");

  push("--- Özet tablo ---");
  push("storageSize = sıkıştırılmış disk | totalSize = sıkıştırılmamış veri+indeks tahmini");
  push(
    [
      "Doküman".padStart(10),
      "storage N".padStart(10),
      "storage TS".padStart(10),
      "totalSize N".padStart(11),
      "Tasarruf".padStart(8),
      "Oran".padStart(6),
      "N/doc".padStart(14),
      "TS/doc".padStart(14),
      "Buckets".padStart(8),
    ].join(" | ")
  );
  push("-".repeat(105));

  for (const r of results) {
    const save = pctSaving(r.normal.storageSize, r.ts.storageSize);
    const ratio = r.normal.storageSize / (r.ts.storageSize || 1);
    push(
      [
        r.inserted.toLocaleString().padStart(10),
        fmtBytes(r.normal.storageSize).padStart(10),
        fmtBytes(r.ts.storageSize).padStart(10),
        fmtBytes(r.normal.totalSize).padStart(11),
        `${save.toFixed(1)}%`.padStart(8),
        `${ratio.toFixed(1)}x`.padStart(6),
        fmtBytesPerDoc(bytesPerDoc(r.normal.storageSize, r.inserted)).padStart(14),
        fmtBytesPerDoc(bytesPerDoc(r.ts.storageSize, r.inserted)).padStart(14),
        String(r.ts.buckets ?? "—").padStart(8),
      ].join(" | ")
    );
  }

  push("");
  push("--- Detay (son ölçek) ---");
  const last = results[results.length - 1];
  if (last) {
    push(`Doküman        : ${last.inserted.toLocaleString()}`);
    push(`Insert süresi  : ${last.insertMs.toFixed(0)} ms`);
    push(`Tahmini ham BSON (sıkıştırmasız): ${fmtBytes(last.estimatedTotalLogical)}`);
    push(`Normal storage : ${fmtBytes(last.normal.storageSize)} + index ${fmtBytes(last.normal.totalIndexSize)}`);
    push(`TS storage     : ${fmtBytes(last.ts.storageSize)} + index ${fmtBytes(last.ts.totalIndexSize)}`);
    push(`Normal avgObjSize (collStats): ${last.normal.avgObjSize} B`);
    push(`Sıkıştırma oranı (normal): storageSize / tahmini ham = ${((last.normal.storageSize / last.estimatedTotalLogical) * 100).toFixed(1)}%`);
    push(`Sıkıştırma oranı (TS)     : storageSize / tahmini ham = ${((last.ts.storageSize / last.estimatedTotalLogical) * 100).toFixed(1)}%`);
  }

  push("");
  push("--- Neden Time Series daha az yer kaplar? ---");
  push("1. Bucket yapısı: meta (sensorId, region, model) bucket başına bir kez yazılır, her ölçümde tekrarlanmaz.");
  push("2. Columnar compression: aynı bucket içindeki temperature/humidity/pressure sütunları ayrı sıkıştırılır.");
  push("3. Delta encoding: ardışık benzer ölçümler (1 sn aralık, yavaş değişen sensör) daha az bit ile saklanır.");
  push("4. Normal koleksiyon: her dokümanda tam BSON + {meta.sensorId, timestamp} bileşik indeksi → çift maliyet.");
  push("");
  push("--- Çıkarımlar ---");
  push("- Küçük hacimde (100K) fark sınırlı; telemetri avantajı ölçek büyüdükçe açılır.");
  push("- Ölçüm başına byte (storageSize/count) en net karşılaştırma metriğidir.");
  push("- totalIndexSize: normalde bileşik indeks büyür; TS'de dahili bucket indeksi minimal kalır.");
  push("- granularity='seconds' 1 Hz ölçüm için uygundur; dakikalık veride 'minutes' seçin.");

  return lines.join("\n");
}

async function main() {
  const db = await connect();

  console.log("\n=== Telemetri Depolama Benchmark ===\n");
  console.log(`Sensör: ${SENSOR_COUNT} | Ölçekler: ${TIERS.join(", ")}\n`);

  const results = [];

  for (const tier of TIERS) {
    const suffix = `${tier}`;
    console.log(`--- ${tier.toLocaleString()} doküman ---`);
    await dropCollections(db, suffix);
    const r = await insertTier(db, tier, suffix);
    results.push(r);
    printTierRow(r);
    console.log(`  insert: ${r.insertMs.toFixed(0)} ms | tahmini ham BSON: ${fmtBytes(r.estimatedTotalLogical)}\n`);
  }

  const report = buildReport(results);
  console.log("\n" + report);

  const dir = path.join(__dirname, "..", "output");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "result.txt");
  fs.writeFileSync(file, report, "utf8");
  console.log(`\nRapor: ${file}`);

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
