const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { addToCart, getCart } = require("../controllers/cartController");

const router = express.Router();

router.post("/add", asyncHandler(addToCart));
router.get("/:userId", asyncHandler(getCart));

module.exports = router;
