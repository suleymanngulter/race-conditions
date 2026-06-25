require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 3012,
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/catalog",
};
