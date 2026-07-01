const { connect } = require("./database");

async function createAllIndexes(db) {
  const users = db.collection("users");
  const orders = db.collection("orders");
  const listings = db.collection("listings");
  const products = db.collection("products");
  const favorites = db.collection("favorites");
  const restaurants = db.collection("restaurants");
  const articles = db.collection("articles");
  const sessions = db.collection("sessions");
  const promotions = db.collection("promotions");

  // 1. Equality
  await users.createIndex({ username: 1 });

  // 2. Compound (ESR)
  await orders.createIndex({ userId: 1, createdAt: -1 });
  await orders.createIndex({ status: 1 });
  await listings.createIndex({ city: 1, category: 1, price: 1 });

  // 3. Unique (email için partial unique kullanılıyor — bkz. #4)
  await products.createIndex({ sku: 1 }, { unique: true });
  await favorites.createIndex({ userId: 1, productId: 1 }, { unique: true });

  // 4. Partial
  await users.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { isDeleted: false }, name: "email_active_unique" }
  );
  await products.createIndex(
    { category: 1, price: 1 },
    { partialFilterExpression: { stock: { $gt: 0 } }, name: "in_stock_category_price" }
  );

  // 5. Geospatial
  await restaurants.createIndex({ location: "2dsphere" });

  // 6. Text (Türkçe stemming için default_language)
  await articles.createIndex(
    { title: "text", content: "text" },
    { default_language: "turkish", name: "text_turkish" }
  );

  // 7. TTL
  await sessions.createIndex({ lastActivity: 1 }, { expireAfterSeconds: 1800 });
  await promotions.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });

  // 8. Multikey (tags array — otomatik multikey)
  await products.createIndex({ tags: 1 });

  // 9. Wildcard
  await products.createIndex({ "customAttributes.$**": 1 });

  // 10. Sparse
  await users.createIndex({ referralCode: 1 }, { sparse: true, unique: true });

  // 11. Covered query
  await users.createIndex({ email: 1, name: 1 }, { name: "email_name_covered" });
}

module.exports = { createAllIndexes };
