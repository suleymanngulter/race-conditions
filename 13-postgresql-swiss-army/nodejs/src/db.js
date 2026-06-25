require("dotenv").config();
const { Pool } = require("pg");

const url = process.env.DATABASE_URL || "postgres://demo:demo@127.0.0.1:5432/swiss_army";
const pool = new Pool({ connectionString: url });

const q = (text, params) => pool.query(text, params);
const close = () => pool.end();

module.exports = { pool, q, close, url };
