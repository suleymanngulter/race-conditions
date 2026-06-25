const express = require("express");
const productRoutes = require("./productRoutes");
const cartRoutes = require("./cartRoutes");

const router = express.Router();

router.use("/products", productRoutes);
router.use("/cart", cartRoutes);

module.exports = router;
