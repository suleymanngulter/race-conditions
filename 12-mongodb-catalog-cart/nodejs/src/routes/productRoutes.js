const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { createProduct, listProducts } = require("../controllers/productController");

const router = express.Router();

router.post("/", asyncHandler(createProduct));
router.get("/", asyncHandler(listProducts));

module.exports = router;
