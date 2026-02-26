const Order = require("../models/Order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
exports.createOrder = async (req, res) => {
  try {
    const { address, mobile, products,name, deliveryCharge = 0 } = req.body;
    if (!address || !mobile || !products || !products.length) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    let totalAmount = 0;
    // Loop through products and calculate price, update stock
    for (let item of products) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Product not found: ${item.product}` });
      }
      // Check if enough stock exists
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.title}. Available: ${product.stock}`,
        });
      }

      const priceAfterDiscount =
        product.price - (product.price * product.discount) / 100;
      totalAmount += priceAfterDiscount * item.quantity;

      // Reduce stock
      product.stock -= item.quantity;
      await product.save(); // Update the stock
    }

    totalAmount += deliveryCharge;

   const userId = req.body.user || null; // ✅ token না থাকলে frontend থেকে আসা user id ধরুন

    const order = new Order({
      user: userId,
      name,
      address,
      mobile,
      products,
      totalAmount,
      deliveryCharge,
    });

    await order.save();

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id; // Ensure req.user._id is correctly populated by your auth middleware
    const {
      search,
      page = 1,
      limit = 10,
      status, // Optional: filter by order status
      sortBy = 'createdAt', // Default sort by createdAt
      sortOrder = 'desc',   // Default sort order descending
    } = req.query;

    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.max(Number(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    let orders;
    let totalOrders;

    // Base match filter for the current user
    const baseMatch = { user: userId };

    // Add status filter if provided
    if (status && typeof status === 'string' && ["pending", "processing", "completed", "cancelled"].includes(status)) {
      baseMatch.status = status;
    }

    // Determine sort criteria
    const sortCriteria = {};
    if (sortBy && ['createdAt', 'totalAmount', 'status'].includes(sortBy)) { // Add more sortable fields as needed
      sortCriteria[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortCriteria.createdAt = -1; // Default sort if invalid sortBy
    }

    if (search) {
      // Aggregation pipeline for searching within populated product titles
      // and potentially direct order fields like totalAmount (if number search)
      const searchRegex = { $regex: search, $options: 'i' };

      const aggregationPipeline = [
        { $match: baseMatch }, // Start with base user filter and optional status filter
        {
          $lookup: {
            from: "products", // Ensure this matches your product collection name
            localField: "products.product",
            foreignField: "_id",
            as: "populatedProducts"
          }
        },
        { $unwind: "$products" }, // Unwind original products array
        {
            $lookup: {
                from: "products", // Again, the product collection
                localField: "products.product",
                foreignField: "_id",
                as: "originalProductDetails" // Join again to get product details for the original 'products' array item
            }
        },
        { $unwind: "$originalProductDetails" }, // Unwind the newly populated product details
        {
          $match: {
            $or: [
              { "originalProductDetails.title": searchRegex }, // Search by product title
              // Optional: Search by order totalAmount if `search` is a number
              ...(isNaN(Number(search)) ? [] : [{ totalAmount: Number(search) }]),
              // Add other direct order fields you want to search here
              // e.g., { "address": searchRegex },
              // e.g., { "mobile": searchRegex },
            ]
          }
        },
        {
          $group: {
            _id: "$_id", // Group back by original order _id
            user: { $first: "$user" },
            name: { $first: "$name" },
            address: { $first: "$address" },
            mobile: { $first: "$mobile" },
            products: { $push: { product: "$originalProductDetails._id", quantity: "$products.quantity" } }, // Reconstruct products array with just IDs and quantity for re-population
            totalAmount: { $first: "$totalAmount" },
            deliveryCharge: { $first: "$deliveryCharge" },
            status: { $first: "$status" },
            createdAt: { $first: "$createdAt" },
            updatedAt: { $first: "$updatedAt" },
            __v: { $first: "$__v" }
          }
        },
        { $sort: sortCriteria }, // Apply sorting
        { $skip: skip },
        { $limit: limitNum }
      ];

      orders = await Order.aggregate(aggregationPipeline);

      // Now, populate the 'products.product' field in the aggregated results
      // because the aggregation pipeline only re-added the product IDs.
      orders = await Order.populate(orders, {
        path: "products.product",
        select: "title price discount mainImage", // Fields to populate
      });

      // Get total count for pagination with search filter
      const countPipeline = [
        { $match: baseMatch },
        {
          $lookup: {
            from: "products",
            localField: "products.product",
            foreignField: "_id",
            as: "populatedProducts"
          }
        },
        { $unwind: "$populatedProducts" },
        {
          $match: {
            $or: [
              { "populatedProducts.title": searchRegex },
              ...(isNaN(Number(search)) ? [] : [{ totalAmount: Number(search) }]),
            ]
          }
        },
        { $group: { _id: "$_id" } }, // Group by original order ID to count unique orders
        { $count: "total" }
      ];

      const countResult = await Order.aggregate(countPipeline);
      totalOrders = countResult.length > 0 ? countResult[0].total : 0;

    } else {
      // Original logic for when no search term is provided (but now with pagination and sort)
      [orders, totalOrders] = await Promise.all([
        Order.find(baseMatch)
          .populate("products.product", "title price discount mainImage")
          .sort(sortCriteria) // Apply sorting
          .skip(skip)
          .limit(limitNum),
        Order.countDocuments(baseMatch),
      ]);
    }

    res.json({
      total: totalOrders,
      page: pageNum,
      pages: Math.ceil(totalOrders / limitNum),
      orders: orders,
    });
  } catch (err) {
    console.error("Error in getUserOrders:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.getUserOrdersbyId = async (req, res) => {
  try {
    const userId = req.user._id; // Ensure req.user._id is correctly populated by your auth middleware
    const {
      search,
      page = 1,
      limit = 10,
      status, // Optional: filter by order status
      sortBy = 'createdAt', // Default sort by createdAt
      sortOrder = 'desc',   // Default sort order descending
    } = req.query;

    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.max(Number(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    let orders;
    let totalOrders;

    // Base match filter for the current user
    const baseMatch = { user: userId };

    // Add status filter if provided
    if (status && typeof status === 'string' && ["pending", "processing", "completed", "cancelled"].includes(status)) {
      baseMatch.status = status;
    }

    // Determine sort criteria
    const sortCriteria = {};
    if (sortBy && ['createdAt', 'totalAmount', 'status'].includes(sortBy)) { // Add more sortable fields as needed
      sortCriteria[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortCriteria.createdAt = -1; // Default sort if invalid sortBy
    }

    if (search) {
      // Aggregation pipeline for searching within populated product titles
      // and potentially direct order fields like totalAmount (if number search)
      const searchRegex = { $regex: search, $options: 'i' };

      const aggregationPipeline = [
        { $match: baseMatch }, // Start with base user filter and optional status filter
        {
          $lookup: {
            from: "products", // Ensure this matches your product collection name
            localField: "products.product",
            foreignField: "_id",
            as: "populatedProducts"
          }
        },
        { $unwind: "$products" }, // Unwind original products array
        {
            $lookup: {
                from: "products", // Again, the product collection
                localField: "products.product",
                foreignField: "_id",
                as: "originalProductDetails" // Join again to get product details for the original 'products' array item
            }
        },
        { $unwind: "$originalProductDetails" }, // Unwind the newly populated product details
        {
          $match: {
            $or: [
              { "originalProductDetails.title": searchRegex }, // Search by product title
             
              ...(isNaN(Number(search)) ? [] : [{ totalAmount: Number(search) }]),
          
            ]
          }
        },
        {
          $group: {
            _id: "$_id", // Group back by original order _id
            user: { $first: "$user" },
            address: { $first: "$address" },
            mobile: { $first: "$mobile" },
            products: { $push: { product: "$originalProductDetails._id", quantity: "$products.quantity" } }, // Reconstruct products array with just IDs and quantity for re-population
            totalAmount: { $first: "$totalAmount" },
            deliveryCharge: { $first: "$deliveryCharge" },
            status: { $first: "$status" },
            createdAt: { $first: "$createdAt" },
            updatedAt: { $first: "$updatedAt" },
            __v: { $first: "$__v" }
          }
        },
        { $sort: sortCriteria }, // Apply sorting
        { $skip: skip },
        { $limit: limitNum }
      ];

      orders = await Order.aggregate(aggregationPipeline);

      // Now, populate the 'products.product' field in the aggregated results
      // because the aggregation pipeline only re-added the product IDs.
      orders = await Order.populate(orders, {
        path: "products.product",
        select: "title price discount mainImage", // Fields to populate
      });

      // Get total count for pagination with search filter
      const countPipeline = [
        { $match: baseMatch },
        {
          $lookup: {
            from: "products",
            localField: "products.product",
            foreignField: "_id",
            as: "populatedProducts"
          }
        },
        { $unwind: "$populatedProducts" },
        {
          $match: {
            $or: [
              { "populatedProducts.title": searchRegex },
              ...(isNaN(Number(search)) ? [] : [{ totalAmount: Number(search) }]),
            ]
          }
        },
        { $group: { _id: "$_id" } }, // Group by original order ID to count unique orders
        { $count: "total" }
      ];

      const countResult = await Order.aggregate(countPipeline);
      totalOrders = countResult.length > 0 ? countResult[0].total : 0;

    } else {
      // Original logic for when no search term is provided (but now with pagination and sort)
      [orders, totalOrders] = await Promise.all([
        Order.find(baseMatch)
          .populate("products.product", "title price discount mainImage")
          .sort(sortCriteria) // Apply sorting
          .skip(skip)
          .limit(limitNum),
        Order.countDocuments(baseMatch),
      ]);
    }

    res.json({
      total: totalOrders,
      page: pageNum,
      pages: Math.ceil(totalOrders / limitNum),
      orders: orders,
    });
  } catch (err) {
    console.error("Error in getUserOrders:", err);
    res.status(500).json({ message: err.message });
  }
};
// exports.getMonthlyOrderStats = async (req, res) => {
//   const currentYear = new Date().getFullYear();
//   const stats = await Order.aggregate([
//     {
//       $match: {
//         createdAt: {
//           $gte: new Date(`${currentYear}-01-01`),
//           $lte: new Date(`${currentYear}-12-31`)
//         }
//       }
//     },
//     {
//       $group: {
//         _id: {
//           month: { $month: '$createdAt' },
//           status: '$status'
//         },
//         count: { $sum: 1 }
//       }
//     },
//     {
//       $group: {
//         _id: '$_id.month',
//         statuses: {
//           $push: {
//             status: '$_id.status',
//             count: '$count'
//           }
//         }
//       }
//     },
//     {
//       $sort: { _id: 1 }
//     }
//   ]);

//   res.json(stats);
// };
exports.getMonthlyOrderStats = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const allPossibleStatuses = [
      "pending",
      "processing",
      "completed",
      "cancelled",
    ];

    const aggregatedStats = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
            $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`),
          },
          status: { $in: allPossibleStatuses }, // Only valid statuses
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.month",
          statusCounts: {
            $push: {
              k: "$_id.status",
              v: "$count",
            },
          },
        },
      },
      {
        $addFields: {
          statusCounts: {
            $cond: {
              if: {
                $and: [
                  { $isArray: "$statusCounts" },
                  { $gt: [{ $size: "$statusCounts" }, 0] },
                ],
              },
              then: { $arrayToObject: "$statusCounts" },
              else: {},
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Prepare full 12 months array with zero default counts
    const finalChartData = Array.from({ length: 12 }, (_, i) => {
      const monthNumber = i + 1;
      const monthName = new Date(currentYear, i, 1).toLocaleString("en-US", {
        month: "short",
      });

      const monthData = { month: monthName, monthNumber };

      // Initialize all statuses to 0
      allPossibleStatuses.forEach((status) => {
        monthData[status] = 0;
      });

      // Find aggregation result for this month
      const foundMonthStats = aggregatedStats.find(
        (stat) => stat._id === monthNumber
      );

      if (foundMonthStats) {
        for (const statusKey in foundMonthStats.statusCounts) {
          if (allPossibleStatuses.includes(statusKey)) {
            monthData[statusKey] = foundMonthStats.statusCounts[statusKey];
          }
        }
      }

      return monthData;
    });

    res.json(finalChartData);
  } catch (error) {
    console.error("Error getting monthly order stats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params; // order ID from URL
  const { status } = req.body;
  const validStatuses = ["pending", "processing", "completed", "cancelled"];

  // Validate incoming status
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status specified" });
  }

  try {
    // Get the requesting user from req.user (set by your auth middleware)
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    // Find the order to update
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Authorization & business rules

    if (requestingUser.role === "moderator") {
      // Moderators cannot cancel orders
      if (status === "cancelled") {
        return res
          .status(403)
          .json({ message: "Moderators cannot cancel orders" });
      }

      // Moderators cannot change status of completed or cancelled orders
      if (["completed", "cancelled"].includes(order.status)) {
        return res
          .status(403)
          .json({
            message: "Cannot change status of completed or cancelled orders",
          });
      }

      // Allowed transitions for moderators
      const allowedTransitions = {
        pending: ["processing"],
        processing: ["completed"],
      };

      const allowedNextStatuses = allowedTransitions[order.status] || [];

      if (!allowedNextStatuses.includes(status)) {
        return res.status(403).json({
          message: `Moderators can only change status from '${
            order.status
          }' to one of: ${allowedNextStatuses.join(", ")}`,
        });
      }
    }

    // Only admins and moderators can update status
    if (!["admin", "moderator"].includes(requestingUser.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to update order status" });
    }

    // Update the order status and save
    order.status = status;
    console.log("Before save:", order.status);
    await order.save();
    console.log("After save:", order.status);

    // Return fresh order document after update
    const updatedOrder = await Order.findById(id);

    return res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
