const { Schema, model, Types } = require("mongoose");

// İlişkisel tablo yerine gömülü alt dokümanlar — tek Cart okumasıyla tüm sepet.
const cartItemSchema = new Schema(
  {
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const cartSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = model("Cart", cartSchema);
