const { Schema, model } = require("mongoose");

// Katı alanlar + Map ile esnek attributes (laptop: ram, kıyafet: beden).
const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, index: true },
    attributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, strict: true },
);

productSchema.index({ category: 1, "attributes.ram": 1 });
productSchema.index({ category: 1, "attributes.size": 1 });

module.exports = model("Product", productSchema);
