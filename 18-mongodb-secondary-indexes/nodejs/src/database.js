const { MongoClient } = require("mongodb");
require("dotenv").config();

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27020";
const DB_NAME = process.env.DB_NAME || "secondary_indexes";

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

function winningStage(explained) {
  const p = explained?.queryPlanner?.winningPlan;
  if (!p) return "?";
  const walk = (node) => {
    if (!node) return "?";
    if (node.stage === "IXSCAN" || node.stage === "COLLSCAN" || node.stage === "IDHACK") {
      return node.stage;
    }
    return walk(node.inputStage) || walk(node.inputStages?.[0]) || node.stage;
  };
  return walk(p);
}

async function explainFind(col, filter, options = {}) {
  let cursor = col.find(filter);
  if (options.sort) cursor = cursor.sort(options.sort);
  if (options.limit) cursor = cursor.limit(options.limit);
  if (options.projection) cursor = cursor.project(options.projection);
  const explained = await cursor.explain("executionStats");
  const stats = explained.executionStats;
  return {
    stage: winningStage(explained),
    docsExamined: stats?.totalDocsExamined ?? 0,
    keysExamined: stats?.totalKeysExamined ?? 0,
    ms: stats?.executionTimeMillis ?? 0,
  };
}

module.exports = { connect, close, explainFind, winningStage };
