const Product = require("../models/Product");

function parseAttributes(body) {
  const { attributes } = body;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    const err = new Error("attributes nesne olmalıdır");
    err.statusCode = 400;
    throw err;
  }
  return attributes;
}

function buildProductFilter(query) {
  const reserved = new Set(["category", "q", "minPrice", "maxPrice"]);
  const filter = {};

  if (query.category) filter.category = query.category;
  if (query.q) filter.title = { $regex: query.q, $options: "i" };

  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  // Dinamik özellik araması: ?ram=16&storage=512 veya ?attributes.ram=16
  for (const [key, value] of Object.entries(query)) {
    if (reserved.has(key) || key.startsWith("min") || key.startsWith("max")) continue;

    const attrKey = key.startsWith("attributes.") ? key : `attributes.${key}`;
    const num = Number(value);
    filter[attrKey] = Number.isNaN(num) ? value : num;
  }

  return filter;
}

async function createProduct(req, res) {
  const { title, price, category } = req.body;

  const product = await Product.create({
    title,
    price,
    category,
    attributes: parseAttributes(req.body),
  });

  res.status(201).json({ success: true, data: product });
}

async function listProducts(req, res) {
  const filter = buildProductFilter(req.query);
  const products = await Product.find(filter).sort({ createdAt: -1 }).lean();

  res.json({ success: true, count: products.length, data: products });
}

module.exports = { createProduct, listProducts };
