/**
 * MongoDB secondary index syntax demo (küçük veri).
 * Performans kanıtı için: npm run benchmark
 * Not: Küçük koleksiyonlarda optimizer COLLSCAN seçebilir — normal davranış.
 */
const { connect, close, explainFind } = require("./database");
const { seed } = require("./seed");
const { createAllIndexes } = require("./indexes");

function section(n, title) {
  console.log(`\n${"=".repeat(60)}\n${n}. ${title}\n${"=".repeat(60)}`);
}

function logExplain(label, result) {
  console.log(`  ${label}`);
  console.log(`    stage: ${result.stage} | docs: ${result.docsExamined} | keys: ${result.keysExamined} | ${result.ms}ms`);
}

async function demoEquality(db) {
  section(1, "Eşitlik Bazlı Arama (Equality Index)");
  const users = db.collection("users");
  const orders = db.collection("orders");

  console.log('  db.users.createIndex({ username: 1 })');
  logExplain("findOne({ username: 'ahmet_dev' })", await explainFind(users, { username: "ahmet_dev" }));

  console.log('  db.orders.createIndex({ status: 1 })');
  logExplain('find({ status: "shipped" })', await explainFind(orders, { status: "shipped" }));
}

async function demoCompound(db) {
  section(2, "Bileşik İndeks (Compound — ESR kuralı)");
  const orders = db.collection("orders");
  const listings = db.collection("listings");

  console.log("  E-S-R: Equality → Sort → Range");
  console.log("  db.orders.createIndex({ userId: 1, createdAt: -1 })");
  logExplain(
    "find({ userId: 'u123' }).sort({ createdAt: -1 })",
    await explainFind(orders, { userId: "u123" }, { sort: { createdAt: -1 } })
  );

  console.log("  db.listings.createIndex({ city: 1, category: 1, price: 1 })");
  logExplain(
    'find({ city: "İstanbul", category: "Emlak" }).sort({ price: 1 })',
    await explainFind(listings, { city: "İstanbul", category: "Emlak" }, { sort: { price: 1 } })
  );
}

async function demoUnique(db) {
  section(3, "Unique İndeks");
  console.log("  db.products.createIndex({ sku: 1 }, { unique: true })");
  console.log("  db.favorites.createIndex({ userId: 1, productId: 1 }, { unique: true })");
  console.log("  db.users — aktif kullanıcılar için partial unique email (bkz. #4)");
  console.log("  → Duplicate insert MongoDB tarafından reddedilir (E11000).");
}

async function demoPartial(db) {
  section(4, "Partial İndeks");
  const users = db.collection("users");
  const products = db.collection("products");

  console.log("  Sadece isDeleted:false kullanıcılar için unique email");
  console.log('  partialFilterExpression: { isDeleted: false }');
  logExplain("find({ email: 'ahmet@mail.com', isDeleted: false })", await explainFind(users, { email: "ahmet@mail.com", isDeleted: false }));

  console.log("  Sadece stock > 0 ürünler için category+price indeksi");
  logExplain('find({ category: "spor", stock: { $gt: 0 } })', await explainFind(products, { category: "spor", stock: { $gt: 0 } }));
}

async function demoGeospatial(db) {
  section(5, "Geospatial (2dsphere)");
  const restaurants = db.collection("restaurants");

  console.log('  db.restaurants.createIndex({ location: "2dsphere" })');
  const near = await restaurants
    .find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [28.9784, 41.0082] },
          $maxDistance: 5000,
        },
      },
    })
    .explain("executionStats");
  logExplain("$near Sultanahmet 5km", {
    stage: near.queryPlanner?.winningPlan?.stage ?? "?",
    docsExamined: near.executionStats?.totalDocsExamined ?? 0,
    keysExamined: near.executionStats?.totalKeysExamined ?? 0,
    ms: near.executionStats?.executionTimeMillis ?? 0,
  });
}

async function demoText(db) {
  section(6, "Text İndeks");
  const articles = db.collection("articles");

  console.log('  db.articles.createIndex({ title: "text", content: "text" }, { default_language: "turkish" })');
  logExplain('$text: { $search: "su geçirmez çadır" }', await explainFind(articles, { $text: { $search: "su geçirmez çadır" } }));
}

async function demoTTL(db) {
  section(7, "TTL İndeks");
  console.log("  sessions: expireAfterSeconds: 1800 (30 dk sonra otomatik silinir)");
  console.log("  promotions: expireAfterSeconds: 0 + expireAt alanı (tarihte silinir)");
  console.log("  → Arka planda TTL monitor ~60 sn'de bir çalışır; demo'da anında silinmez.");
}

async function demoMultikey(db) {
  section(8, "Multikey İndeks (array alanlar)");
  const products = db.collection("products");

  console.log("  db.products.createIndex({ tags: 1 }) — array için otomatik multikey");
  logExplain('find({ tags: "outdoor" })', await explainFind(products, { tags: "outdoor" }));
}

async function demoWildcard(db) {
  section(9, "Wildcard İndeks");
  const products = db.collection("products");

  console.log('  db.products.createIndex({ "customAttributes.$**": 1 })');
  logExplain('find({ "customAttributes.renk": "kırmızı" })', await explainFind(products, { "customAttributes.renk": "kırmızı" }));
}

async function demoSparse(db) {
  section(10, "Sparse İndeks");
  const users = db.collection("users");

  console.log("  db.users.createIndex({ referralCode: 1 }, { sparse: true, unique: true })");
  logExplain('find({ referralCode: "REF-001" })', await explainFind(users, { referralCode: "REF-001" }));
  console.log("  → Alanı olmayan dokümanlar indekse girmez (Senaryo 15).");
}

async function demoCovered(db) {
  section(11, "Covered Query");
  const users = db.collection("users");

  console.log("  db.users.createIndex({ email: 1, name: 1 })");
  const explained = await users
    .find({ email: "ahmet@mail.com" }, { projection: { name: 1, email: 1, _id: 0 } })
    .explain("executionStats");

  const covered = explained.queryPlanner?.winningPlan?.stage === "PROJECTION_COVERED"
    || explained.executionStats?.totalDocsExamined === 0;
  logExplain("find({ email }, { name, email, _id: 0 })", {
    stage: explained.queryPlanner?.winningPlan?.stage ?? "?",
    docsExamined: explained.executionStats?.totalDocsExamined ?? 0,
    keysExamined: explained.executionStats?.totalKeysExamined ?? 0,
    ms: explained.executionStats?.executionTimeMillis ?? 0,
  });
  console.log(`  covered: ${covered ? "evet — doküman fetch yok" : "hayır"}`);
}

function printDecisionTable() {
  section("", "Hızlı Karar Tablosu");
  const rows = [
    ["Tek alanda hızlı arama", "Single field"],
    ["Filtre + sıralama birlikte", "Compound (ESR)"],
    ["Benzersizlik garantisi", "Unique"],
    ["Sadece alt kümeyi indeksle", "Partial"],
    ["Mesafe/konum sorgusu", "2dsphere"],
    ["Kelime arama", "Text"],
    ["Otomatik silme", "TTL"],
    ["Array alan sorgusu", "Multikey"],
    ["Dinamik alanlar", "Wildcard"],
    ["Alan bazen yok", "Sparse"],
    ["İndeksten cevap", "Covered query"],
  ];
  console.log("  İhtiyaç".padEnd(32) + "| İndeks Tipi");
  console.log("  " + "-".repeat(50));
  for (const [need, type] of rows) {
    console.log(`  ${need.padEnd(32)}| ${type}`);
  }
  console.log("\n  Kural: Sadece gerçekten sorgulanan alanlara indeks koyun; explain() ile doğrulayın.");
}

async function main() {
  const db = await connect();
  await seed();
  await createAllIndexes(db);

  console.log("\nMongoDB Secondary Index Demoları");
  console.log("Her bölümde createIndex + örnek sorgu + explain() çıktısı\n");

  await demoEquality(db);
  await demoCompound(db);
  await demoUnique(db);
  await demoPartial(db);
  await demoGeospatial(db);
  await demoText(db);
  await demoTTL(db);
  await demoMultikey(db);
  await demoWildcard(db);
  await demoSparse(db);
  await demoCovered(db);
  printDecisionTable();

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
