const { q } = require("./db");

async function jsonb() {
  await q("DROP TABLE IF EXISTS products");
  await q(`CREATE TABLE products (id SERIAL PRIMARY KEY, sku TEXT UNIQUE, data JSONB NOT NULL)`);
  await q(`INSERT INTO products (sku, data) VALUES
    ('lap-1', '{"title":"ThinkPad","category":"laptop","attributes":{"ram":16}}'),
    ('cloth-1', '{"title":"Tişört","category":"clothing","attributes":{"size":"M"}}')`);

  const { rows } = await q(`SELECT sku, data->>'title' AS title FROM products WHERE data @> '{"category":"laptop"}'`);
  console.log("JSONB:", rows);
}

async function fulltext() {
  await q("DROP TABLE IF EXISTS articles");
  await q(`CREATE TABLE articles (
    id SERIAL PRIMARY KEY, title TEXT, body TEXT,
    tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || body)) STORED
  )`);
  await q(`INSERT INTO articles (title, body) VALUES
    ('PostgreSQL FTS', 'postgresql kelime kelime arama'),
    ('Redis', 'redis cache anahtar deger')`);

  const term = "postgresql kelime";
  const { rows } = await q(
    `SELECT title, ts_rank(tsv, plainto_tsquery('simple', $1)) AS rank
     FROM articles WHERE tsv @@ plainto_tsquery('simple', $1) ORDER BY rank DESC`,
    [term],
  );
  console.log("Full-Text:", term, "→", rows);
}

async function vector() {
  await q("DROP TABLE IF EXISTS embeddings");
  await q(`CREATE TABLE embeddings (id SERIAL PRIMARY KEY, label TEXT, vec vector(3))`);
  const data = [
    ["kedi veteriner", "[0.9,0.1,0]"],
    ["kopek veteriner", "[0.85,0.15,0]"],
    ["araba tamir", "[0.1,0.9,0]"],
  ];
  for (const [label, vec] of data) {
    await q(`INSERT INTO embeddings (label, vec) VALUES ($1, $2::vector)`, [label, vec]);
  }

  const { rows } = await q(
    `SELECT label FROM embeddings ORDER BY vec <=> $1::vector LIMIT 2`,
    ["[0.88,0.12,0]"],
  );
  console.log("pgvector en yakın:", rows);
}

async function postgis() {
  await q("DROP TABLE IF EXISTS stores");
  await q(`CREATE TABLE stores (id SERIAL PRIMARY KEY, name TEXT, geom geography(POINT, 4326))`);
  await q(`INSERT INTO stores (name, geom) VALUES
    ('Kadikoy', ST_SetSRID(ST_MakePoint(29.027, 40.990), 4326)::geography),
    ('Besiktas', ST_SetSRID(ST_MakePoint(29.008, 41.042), 4326)::geography),
    ('Ankara', ST_SetSRID(ST_MakePoint(32.860, 39.920), 4326)::geography)`);

  const { rows } = await q(
    `SELECT name, ROUND(ST_Distance(geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)) AS m
     FROM stores
     WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
     ORDER BY m`,
    [29.02, 41.0, 15000],
  );
  console.log("PostGIS 15km içi:", rows);
}

async function queue() {
  const { pool } = require("./db");

  await q("DROP TABLE IF EXISTS jobs");
  await q(`CREATE TABLE jobs (id BIGSERIAL PRIMARY KEY, payload JSONB, status TEXT DEFAULT 'pending')`);
  await q(`CREATE OR REPLACE FUNCTION notify_job() RETURNS trigger AS $$
    BEGIN PERFORM pg_notify('jobs', NEW.id::text); RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER jobs_notify AFTER INSERT ON jobs FOR EACH ROW EXECUTE FUNCTION notify_job()`);

  const listen = new Promise(async (resolve) => {
    const c = await pool.connect();
    await c.query("LISTEN jobs");
    let released = false;
    const done = (val) => {
      clearTimeout(timer);
      if (!released) { released = true; c.release(); }
      resolve(val);
    };
    const timer = setTimeout(() => done(null), 2000);
    c.once("notification", (m) => done(m.payload));
  });

  const worker = await pool.connect();
  const notified = listen;

  await q(`INSERT INTO jobs (payload) VALUES ('{"task":"email"}'), ('{"task":"pdf"}')`);

  const claim = () => worker.query(`
    UPDATE jobs SET status = 'done'
    WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, payload`);

  console.log("NOTIFY:", await notified);
  console.log("Claim 1:", (await claim()).rows[0]);
  console.log("Claim 2:", (await claim()).rows[0]);
  worker.release();
}

module.exports = { jsonb, fulltext, vector, postgis, queue };
