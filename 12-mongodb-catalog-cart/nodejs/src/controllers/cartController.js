const Cart = require("../models/Cart");
const Product = require("../models/Product");

async function addToCart(req, res) {
  const { userId, productId, quantity = 1 } = req.body;

  if (!userId || !productId) {
    const err = new Error("userId ve productId zorunludur");
    err.statusCode = 400;
    throw err;
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    const err = new Error("quantity pozitif tam sayı olmalıdır");
    err.statusCode = 400;
    throw err;
  }

  const product = await Product.findById(productId).select("_id");
  if (!product) {
    const err = new Error("Ürün bulunamadı");
    err.statusCode = 404;
    throw err;
  }

  // WiredTiger doküman kilidi: mevcut satırda $inc (in-place), yoksa $push.
  const incremented = await Cart.findOneAndUpdate(
    { userId, "items.productId": productId },
    { $inc: { "items.$.quantity": qty } },
    { new: true },
  );

  if (incremented) {
    return res.json({ success: true, data: incremented, action: "incremented" });
  }

  const created = await Cart.findOneAndUpdate(
    { userId },
    {
      $push: { items: { productId, quantity: qty } },
      $setOnInsert: { userId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.status(201).json({ success: true, data: created, action: "added" });
}

async function getCart(req, res) {
  const { userId } = req.params;

  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    select: "title price category attributes",
  });

  if (!cart) {
    return res.json({ success: true, data: { userId, items: [] } });
  }

  res.json({ success: true, data: cart });
}

module.exports = { addToCart, getCart };
