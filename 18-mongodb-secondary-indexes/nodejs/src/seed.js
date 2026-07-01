const { connect } = require("./database");

async function seed() {
  const db = await connect();

  const collections = [
    "users", "orders", "listings", "products", "favorites",
    "restaurants", "articles", "sessions", "promotions",
  ];
  for (const name of collections) {
    await db.collection(name).drop().catch(() => {});
  }

  await db.collection("users").insertMany([
    { username: "ahmet_dev", email: "ahmet@mail.com", name: "Ahmet", isDeleted: false },
    { username: "zeynep", email: "zeynep@mail.com", name: "Zeynep", isDeleted: false },
    { username: "deleted_user", email: "old@mail.com", name: "Eski", isDeleted: true },
    { username: "vip_user", email: "vip@mail.com", name: "VIP", referralCode: "REF-001" },
  ]);

  const now = new Date();
  await db.collection("orders").insertMany([
    { userId: "u123", status: "shipped", createdAt: new Date(now - 86400000) },
    { userId: "u123", status: "pending", createdAt: now },
    { userId: "u456", status: "shipped", createdAt: now },
  ]);

  await db.collection("listings").insertMany([
    { city: "İstanbul", category: "Emlak", price: 2500000 },
    { city: "İstanbul", category: "Emlak", price: 1800000 },
    { city: "Ankara", category: "Emlak", price: 900000 },
  ]);

  await db.collection("products").insertMany([
    { sku: "SKU-001", category: "spor", price: 199, stock: 10, tags: ["spor", "outdoor"] },
    { sku: "SKU-002", category: "ev", price: 49, stock: 0, tags: ["ev"] },
    { sku: "SKU-003", category: "spor", price: 299, stock: 5, tags: ["outdoor"], customAttributes: { renk: "kırmızı", beden: "L" } },
  ]);

  await db.collection("favorites").insertMany([
    { userId: "u1", productId: "p1" },
  ]);

  await db.collection("restaurants").insertMany([
    { name: "Kadıköy Balık", location: { type: "Point", coordinates: [29.027, 40.990] } },
    { name: "Sultanahmet", location: { type: "Point", coordinates: [28.9784, 41.0082] } },
  ]);

  await db.collection("articles").insertMany([
    { title: "Kamp rehberi", content: "Su geçirmez çadır seçimi ve outdoor ekipman" },
    { title: "Şehir turu", content: "İstanbul gezilecek yerler" },
  ]);

  await db.collection("sessions").insertMany([
    { sessionId: "s1", lastActivity: new Date() },
  ]);

  await db.collection("promotions").insertMany([
    { code: "YAZ20", expireAt: new Date(Date.now() + 7 * 86400000) },
  ]);

  console.log("Seed tamamlandı.");
}

if (require.main === module) {
  seed()
    .then(() => require("./database").close())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed };
