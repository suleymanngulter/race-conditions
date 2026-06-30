const { MongoClient } = require("mongodb");
require("dotenv").config();

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27019";
const DB_NAME = process.env.DB_NAME || "telemetry_storage";

let client;
let db;

async function connect() {
  if (db) return db;
  client = new MongoClient(URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

async function close() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}

module.exports = { connect, close, getDb: () => db };
