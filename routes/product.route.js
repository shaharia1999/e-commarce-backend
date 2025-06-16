const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const { visitorCounter } = require("../middleware/visitorCounter");
const verifyToken = require("../middleware/auth.middleware"); // Import the token middleware

// Protected route: requires JWT token
// token is passed in the header as "Authorization|Bearer <token>"
// fetch('http://localhost:5000/auth/me', {
//   headers: {
//     Authorization: `Bearer ${token}`,
//   },
// });
router.post("/", verifyToken, productController.createProduct);
// Public routes
router.get("/", productController.getProducts);
router.get("/:slug", visitorCounter, productController.getProductById);
router.patch("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
