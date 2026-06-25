const mongoose = require("mongoose");
const { mongodbUri } = require("./env");

// WiredTiger: bağlantı havuzu + non-blocking async sorgular (event loop'u bloklamaz).
async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongodbUri);
  console.log(`MongoDB bağlandı: ${mongodbUri}`);
}

module.exports = { connectDB };
