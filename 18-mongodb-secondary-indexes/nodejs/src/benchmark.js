/**
 * Secondary index benchmark — mantıklı vs mantıksız senaryolar.
 * Süre: warm-cache (disk I/O yok). Güvenilir metrik: docsExamined + stage.
 */
const fs = require("fs");
const path = require("path");
const { connect, close, explainFind } = require("./database");
const { seedLargeUsers, seedSmallUsers, seedOrders, seedWriteTest } = require("./benchmarkData");

require("dotenv").config();

const RUNS = Number(process.env.BENCHMARK_RUNS) || 10;
const LARGE_USERS = Number(process.env.BENCH_USERS) || 250_000;
const LARGE_ORDERS = Number(process.env.BENCH_ORDERS) || 200_000;
const WRITE_DOCS = Number(process.env.BENCH_WRITE_DOCS) || 20_000;
const OUT = path.join(__dirname, "..", "output", "benchmark-result.txt");
const LIMITATIONS = [
  "=== SINIRLAMALAR — WARM-CACHE BENCHMARK ===",
  "Bu ölçüm WiredTiger cache SICAKKEN yapılır. Disk I/O dahil DEĞİLDİR.",
  "• Seed (bulkWrite) veriyi RAM'e yazar; ölçüm sırası cache bias'ını tamamen gidermez.",
  "• ms farkları (örn. IXSCAN ~1ms vs COLLSCAN ~30ms) yönü doğrudur; disk-bound ortamda COLLSCAN DAHA YAVAŞ olur.",
  "• Güvenilir metrikler: totalDocsExamined, stage, keysExamined (cache'den bağımsız).",
  "• Cold-disk ölçümü: mongod restart veya ayrı cold-start ortamı gerekir.",
].join("\n");

const LOCALE = "tr-TR";

function fmtNum(n) {
  return typeof n === "number" ? n.toLocaleString(LOCALE) : String(n);
}

function fmtMs(n) {
  return typeof n === "number" && n.toFixed ? `${n.toFixed(1)} ms` : `${n} ms`;
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function measure(col, filter, opts = {}) {
  const exec = async () => {
    if (opts.single) {
      return col.findOne(filter, opts.projection ? { projection: opts.projection } : {});
    }
    let c = col.find(filter);
    if (opts.sort) c = c.sort(opts.sort);
    if (opts.limit) c = c.limit(opts.limit);
    return c.toArray();
  };

  await exec();
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    await exec();
    times.push(performance.now() - t0);
  }
  const plan = await explainFind(col, filter, opts);
  return { msMedian: median(times), ...plan };
}

function entry(id, verdict, desc, size, index, result, note, method = "median") {
  return {
    id,
    verdict,
    desc,
    size,
    index,
    ms: result.msMedian ?? result.ms ?? 0,
    docs: result.docsExamined ?? 0,
    keys: result.keysExamined ?? 0,
    stage: result.stage ?? "—",
    note,
    method,
  };
}

function msLabel(method) {
  if (method === "explain") return "Explain süresi (tek ölçüm)";
  if (method === "insert") return "Insert süresi (tek ölçüm)";
  return `Medyan süre (${RUNS} tekrar)`;
}

async function benchEqualityLarge() {
  const db = await connect();
  const { col, targetUsername } = await seedLargeUsers(db, LARGE_USERS);
  const q = { username: targetUsername };

  const noIdx = await measure(col, q, { single: true });
  await col.createIndex({ username: 1 });
  const withIdx = await measure(col, q, { single: true });

  return [
    entry("A1", "MANTIKLI", "Büyük koleksiyon + equality", LARGE_USERS, "var", withIdx, "IXSCAN, 1 doc"),
    entry("A2", "KARŞIT", "Aynı sorgu — indeks yok", LARGE_USERS, "yok", noIdx, "COLLSCAN, tüm koleksiyon"),
  ];
}

async function benchSmallCollection() {
  const db = await connect();
  const { col, targetUsername } = await seedSmallUsers(db);
  const q = { username: targetUsername };

  const noIdx = await measure(col, q, { single: true });
  await col.createIndex({ username: 1 });
  const withIdx = await measure(col, q, { single: true });
  const { totalIndexSize } = await db.command({ collStats: col.collectionName });

  return [
    entry("B1", "GEREKSIZ", "Küçük koleksiyon — indeks yok", 800, "yok", noIdx, "Hız farkı yok"),
    entry("B2", "GEREKSIZ", "Küçük koleksiyon — indeks var", 800, "var", withIdx, `+${totalIndexSize} B indeks RAM`),
  ];
}

async function benchCompound() {
  const db = await connect();
  const { col, sampleUserId } = await seedOrders(db, LARGE_ORDERS);
  await col.createIndex({ userId: 1, createdAt: -1 });

  const good = await measure(col, { userId: sampleUserId }, { sort: { createdAt: -1 }, limit: 20 });
  const bad = await measure(col, {}, { sort: { createdAt: -1 }, limit: 20 });

  return [
    entry("C1", "MANTIKLI", "Compound ESR — userId + sort", LARGE_ORDERS, "{userId,createdAt}", good, "ESR uyumlu"),
    entry("C2", "MANTIKSIZ", "Yalnızca sort", LARGE_ORDERS, "{userId,createdAt}", bad, "Prefix kullanılamaz"),
  ];
}

async function benchLowSelectivity() {
  const db = await connect();
  const { col } = await seedOrders(db, LARGE_ORDERS);
  await col.createIndex({ status: 1 });
  const result = await measure(col, { status: "shipped" });

  return [
    entry("D1", "ŞÜPHELİ", "status %50 seçicilik", LARGE_ORDERS, "{status}", result,
      `~${fmtNum(Math.floor(LARGE_ORDERS / 2))} doc okunur`),
  ];
}

const COVERED_USERS = 50_000;
const BIO_USERS = 100_000;

async function benchCovered() {
  const db = await connect();
  const { col } = await seedLargeUsers(db, COVERED_USERS);
  await col.createIndex({ email: 1, name: 1 });

  const result = await measure(col, { email: "u25000@bench.test" }, {
    projection: { email: 1, name: 1, _id: 0 },
    single: true,
  });

  return [
    entry("E1", "MANTIKLI", "Covered query", COVERED_USERS, "{email,name}", result,
      result.stage === "PROJECTION_COVERED" ? "0 doc fetch" : "covered değil"),
  ];
}

async function benchNonIndexedField() {
  const db = await connect();
  const { col } = await seedLargeUsers(db, BIO_USERS);
  await col.createIndex({ username: 1 });
  const result = await measure(col, { bio: /user 099999/ });

  return [
    entry("F1", "MANTIKSIZ", "İndekslenmemiş alan (bio)", BIO_USERS, "username only", result, "COLLSCAN"),
  ];
}

async function benchWriteCost() {
  const db = await connect();
  const mkDoc = (i) => ({
    username: `w-${i}`, email: `w${i}@t.com`, status: "active", createdAt: new Date(), tags: ["a"],
  });

  const insert = async (col) => {
    const t0 = performance.now();
    for (let i = 0; i < WRITE_DOCS; i += 5000) {
      const batch = Array.from({ length: Math.min(5000, WRITE_DOCS - i) }, (_, j) => mkDoc(i + j));
      await col.insertMany(batch, { ordered: false });
    }
    return performance.now() - t0;
  };

  const plain = await seedWriteTest(db, false);
  const indexed = await seedWriteTest(db, true);
  const plainMs = await insert(plain.col);
  const indexedMs = await insert(indexed.col);

  return [
    entry("G1", "MALİYET", "Insert — 0 indeks", WRITE_DOCS, "0",
      { msMedian: plainMs, stage: "—", docsExamined: 0, keysExamined: 0 }, "baseline", "insert"),
    entry("G2", "MALİYET", "Insert — 5 indeks", WRITE_DOCS, "5",
      { msMedian: indexedMs, stage: "—", docsExamined: 0, keysExamined: 0 },
      `${(indexedMs / plainMs).toFixed(2)}x yavaş`, "insert"),
  ];
}

function byId(rows) {
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

function speedup(slow, fast) {
  if (!fast || fast <= 0) return "—";
  return `${(slow / fast).toFixed(0)}x`;
}

function docReduction(noIdx, withIdx) {
  if (!noIdx) return "—";
  return `${((1 - withIdx / noIdx) * 100).toFixed(1)}% daha az doc`;
}

/** Yan yana: indeks yok vs secondary index */
function blockCompare(title, query, kayit, left, right, leftLbl, rightLbl, sonuc, mode = "read") {
  const timeRow = mode === "write" ? msLabel("insert") : msLabel(left.method);
  const lines = [
    "",
    "═".repeat(72),
    title,
    "═".repeat(72),
    `Sorgu  : ${query}`,
    `Kayıt  : ${fmtNum(kayit)}`,
    "",
    padRow(" ", leftLbl, rightLbl),
    padRow("─".repeat(20), "─".repeat(22), "─".repeat(22)),
    padRow(timeRow, fmtMs(left.ms), fmtMs(right.ms)),
  ];

  if (mode === "read") {
    lines.push(
      padRow("Docs examined", fmtNum(left.docs), fmtNum(right.docs)),
      padRow("Keys examined", fmtNum(left.keys), fmtNum(right.keys)),
      padRow("Stage", left.stage, right.stage),
      padRow("Hız farkı", "—", `${speedup(left.ms, right.ms)} daha hızlı`),
      padRow("Doc azalması", fmtNum(left.docs), docReduction(left.docs, right.docs))
    );
  } else {
    lines.push(
      padRow("Oran", "baseline", `${(right.ms / left.ms).toFixed(2)}x yavaş`)
    );
  }

  lines.push("", `Sonuç  : ${sonuc}`);
  return lines;
}

function padRow(label, a, b) {
  return `${label.padEnd(18)} | ${String(a).padEnd(22)} | ${b}`;
}

function blockSingle(title, query, kayit, r, sonuc, not) {
  const lines = [
    "",
    "═".repeat(72),
    title,
    "═".repeat(72),
    `Sorgu  : ${query}`,
    `Kayıt  : ${fmtNum(kayit)}`,
    `İndeks : ${r.index}`,
    "",
    `  ${msLabel(r.method).padEnd(16)}: ${fmtMs(r.ms)}`,
    `  Docs examined   : ${fmtNum(r.docs)}`,
    `  Keys examined   : ${fmtNum(r.keys)}`,
    `  Stage           : ${r.stage}`,
    "",
    `Sonuç  : ${sonuc}`,
  ];
  if (not) lines.push(`Not     : ${not}`);
  return lines;
}

function buildReport(rows) {
  const r = byId(rows);
  const lines = [
    "MongoDB Secondary Index Benchmark — Karşılaştırmalı Rapor",
    "═".repeat(72),
    `Tarih     : ${new Date().toISOString()}`,
    `Veri      : ${fmtNum(LARGE_USERS)} kullanıcı | ${fmtNum(LARGE_ORDERS)} sipariş`,
    `Ölçüm     : A/B/C/D/E/F → ${RUNS} tekrar medyan | G → insert tek (warm-cache, disk I/O yok)`,
    "",
    LIMITATIONS,
  ];

  lines.push(
    ...blockCompare(
      "A) EQUALITY — Tekil arama (yüksek seçicilik)",
      'findOne({ username: "user-125000" })',
      r.A2.size,
      r.A2,
      r.A1,
      "İndeks YOK",
      "Secondary { username: 1 }",
      "✓ MANTIKLI — IXSCAN 1 doc; COLLSCAN tüm koleksiyonu tarar"
    ),
    ...blockCompare(
      "B) KÜÇÜK KOLEKSİYON — İndeks gerekli mi?",
      'findOne({ username: "small-400" })',
      r.B1.size,
      r.B1,
      r.B2,
      "İndeks YOK",
      "Secondary { username: 1 }",
      `✗ GEREKSIZ — hız farkı yok; indeks RAM maliyeti var (${r.B2.note})`
    ),
    ...blockCompare(
      "C) COMPOUND INDEX — ESR kuralı",
      "C1: find({ userId }).sort({ createdAt: -1 }).limit(20)",
      r.C1.size,
      r.C2,
      r.C1,
      "Yanlış: yalnızca sort (prefix yok)",
      "Doğru: userId + sort (ESR)",
      "✓ MANTIKLI prefix kullanımı; yalnızca sort → COLLSCAN"
    ),
    ...blockSingle(
      "D) DÜŞÜK SEÇİCİLİK — İndeks şüpheli",
      'find({ status: "shipped" })  — ~%50 eşleşme',
      r.D1.size,
      r.D1,
      "⚠ ŞÜPHELİ — IXSCAN ama çok doc okunur; indeks boyutu vs kazanç tartışılır",
      `Medyan süre hem IXSCAN+FETCH hem de ~${fmtNum(Math.floor(LARGE_ORDERS / 2))} doc'un network'e aktarılmasını içerir — index verimliliği docsExamined/keysExamined'dan okunmalı.`
    ),
    ...blockSingle(
      "E) COVERED QUERY — İndeks yeterli",
      'find({ email }, { email: 1, name: 1, _id: 0 })',
      r.E1.size,
      r.E1,
      "✓ MANTIKLI — PROJECTION_COVERED, döküman fetch yok"
    ),
    ...blockSingle(
      "F) YANLIŞ ALAN — İndeks sorguya uymuyor",
      'find({ bio: /user 099999/ })  — indeks: username only',
      r.F1.size,
      r.F1,
      "✗ MANTIKSIZ — sorgulanan alan indekslenmemiş → COLLSCAN"
    ),
    ...blockCompare(
      "G) YAZMA MALİYETİ — Insert",
      `${fmtNum(WRITE_DOCS)} doküman insertMany`,
      WRITE_DOCS,
      r.G1,
      r.G2,
      "0 secondary index",
      "5 secondary index",
      `⚠ MALİYET — ${r.G2.note}; okuma için eklenen her indeks yazmayı yavaşlatır`,
      "write"
    ),
    "",
    "═".repeat(72),
    "ÖZET KARAR TABLOSU",
    "═".repeat(72),
    "",
    padRow("Senaryo", "İndeks YOK / Yanlış", "Secondary / Doğru"),
    padRow("─".repeat(20), "─".repeat(22), "─".repeat(22)),
    padRow("A Equality 250K", `${fmtMs(r.A2.ms)} COLLSCAN`, `${fmtMs(r.A1.ms)} IXSCAN`),
    padRow("B Küçük 800", `${fmtMs(r.B1.ms)} (fark yok)`, `${fmtMs(r.B2.ms)} +RAM`),
    padRow("C Compound", `${fmtMs(r.C2.ms)} COLLSCAN`, `${fmtMs(r.C1.ms)} IXSCAN`),
    padRow("G Insert 20K", fmtMs(r.G1.ms), `${fmtMs(r.G2.ms)} (${r.G2.note})`),
    "",
    "Ne zaman secondary index?",
    "  ✓ Büyük koleksiyon + yüksek seçicilik (A, E)",
    "  ✓ Compound sorgu ESR sırasına uyuyorsa (C1)",
    "  ✗ Küçük koleksiyon (B) — maliyet > kazanç",
    "  ✗ Düşük seçicilik (D) — indeks var ama çok doc okunur",
    "  ✗ Sorgu indekslenmemiş alanda (F)",
    "  ⚠ Yoğun yazma + çok indeks (G)",
  );

  return lines.join("\n");
}

function printTable(rows) {
  const report = buildReport(rows);
  console.log(report);
}

async function main() {
  console.log(`Benchmark: ${fmtNum(LARGE_USERS)} users, ${fmtNum(LARGE_ORDERS)} orders`);

  const rows = [
    ...(await benchEqualityLarge()),
    ...(await benchSmallCollection()),
    ...(await benchCompound()),
    ...(await benchLowSelectivity()),
    ...(await benchCovered()),
    ...(await benchNonIndexedField()),
    ...(await benchWriteCost()),
  ];

  printTable(rows);
  const report = buildReport(rows);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, report, "utf8");
  console.log(`\nRapor: ${OUT}`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
