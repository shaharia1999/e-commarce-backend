const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const verifyToken = require("../middleware/auth.middleware"); // for authenticated users
const verifyTokenOrder  = require("../middleware/Order"); // for authenticated users
const RoleCheck = require("../middleware/RoleCheck");

// ✅ Create new order (for both guest and logged-in users)
router.post("/", orderController.createOrder);

// ✅ Get orders for logged-in user 
router.get("/user",verifyTokenOrder , orderController.getUserOrdersbyId);
router.get("/me", verifyToken, orderController.getUserOrders);
router.get('/stats/monthly', verifyToken, RoleCheck(['admin','moderator']), orderController.getMonthlyOrderStats);
router.patch('/:id/status', verifyToken, RoleCheck(['admin','moderator']), 
orderController.updateOrderStatus);
// (Optional) Admin or user can get single order by ID
// router.get("/:id", verifyToken, orderController.getOrderById);

module.exports = router;
