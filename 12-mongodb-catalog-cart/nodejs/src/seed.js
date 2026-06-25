require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");
const { mongodbUri } = require("./config/env");

const samples = [
  {
    title: "ThinkPad X1",
    price: 42000,
    category: "laptop",
    attributes: { ram: 16, storage: 512, cpu: "i7" },
  },
  {
    title: "MacBook Air M3",
    price: 55000,
    category: "laptop",
    attributes: { ram: 8, storage: 256, chip: "M3" },
  },
  {
    title: "Pamuklu Tişört",
    price: 350,
    category: "clothing",
    attributes: { size: "M", color: "lacivert", fabric: "pamuk" },
  },
];

async function seed() {
  await mongoose.connect(mongodbUri);
  await Product.deleteMany({});
  await Product.insertMany(samples);
  console.log(`${samples.length} ürün seed edildi.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
