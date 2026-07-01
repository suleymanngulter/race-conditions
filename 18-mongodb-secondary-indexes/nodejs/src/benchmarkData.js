const BATCH = Number(process.env.BENCH_BATCH_SIZE) || 5000;

async function bulkInsert(coll, docs) {
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const ops = slice.map((d) => ({ insertOne: { document: d } }));
    await coll.bulkWrite(ops, { ordered: false });
  }
}

/** ~250K kullanıcı — equality lookup benchmark (~180 B/doc) */
async function seedLargeUsers(db, count) {
  const name = "bench_users_large";
  await db.collection(name).drop().catch(() => {});
  await db.createCollection(name);
  const col = db.collection(name);

  const batch = [];
  for (let i = 0; i < count; i++) {
    batch.push({
      username: `user-${String(i).padStart(6, "0")}`,
      email: `u${i}@bench.test`,
      name: `User ${i}`,
      bio: `Bio text for user ${i} — filler to reach realistic document size.`,
      createdAt: new Date(Date.now() - i * 1000),
    });
    if (batch.length >= BATCH) {
      await bulkInsert(col, batch);
      batch.length = 0;
    }
  }
  if (batch.length) await bulkInsert(col, batch);
  return { col, name, targetUsername: `user-${String(Math.floor(count / 2)).padStart(6, "0")}` };
}

/** ~800 kullanıcı — küçük koleksiyon, indeks gereksiz senaryosu */
async function seedSmallUsers(db) {
  const name = "bench_users_small";
  await db.collection(name).drop().catch(() => {});
  await db.createCollection(name);
  const col = db.collection(name);
  const docs = Array.from({ length: 800 }, (_, i) => ({
    username: `small-${i}`,
    email: `s${i}@test.com`,
    name: `Small ${i}`,
  }));
  await bulkInsert(col, docs);
  return { col, name, targetUsername: "small-400" };
}

/**
 * ~200K sipariş — compound + düşük seçicilik (~120 B/doc)
 * status: %50 shipped / %50 pending (düşük seçicilik)
 */
async function seedOrders(db, count) {
  const name = "bench_orders";
  await db.collection(name).drop().catch(() => {});
  await db.createCollection(name);
  const col = db.collection(name);
  const batch = [];
  const userPool = 1000;

  for (let i = 0; i < count; i++) {
    batch.push({
      userId: `u-${i % userPool}`,
      status: i % 2 === 0 ? "shipped" : "pending",
      createdAt: new Date(Date.now() - i * 60000),
      amount: Math.round((10 + Math.random() * 500) * 100) / 100,
    });
    if (batch.length >= BATCH) {
      await bulkInsert(col, batch);
      batch.length = 0;
    }
  }
  if (batch.length) await bulkInsert(col, batch);
  return { col, name, sampleUserId: "u-42" };
}

/** Yazma maliyeti — indeks sayısı karşılaştırması */
async function seedWriteTest(db, withIndexes) {
  const name = withIndexes ? "bench_write_indexed" : "bench_write_plain";
  await db.collection(name).drop().catch(() => {});
  await db.createCollection(name);
  const col = db.collection(name);

  if (withIndexes) {
    await col.createIndex({ email: 1 });
    await col.createIndex({ username: 1 });
    await col.createIndex({ createdAt: -1 });
    await col.createIndex({ status: 1, createdAt: -1 });
    await col.createIndex({ tags: 1 });
  }
  return { col, name };
}

module.exports = { seedLargeUsers, seedSmallUsers, seedOrders, seedWriteTest, BATCH };
