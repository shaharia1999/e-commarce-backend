// const mongoose = require("mongoose");
// const productSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     trim: true,
//     unique: true,
//     required: [true, "Name is required"],
//     validate: {
//       validator: function (v) {
//         return /^[a-zA-Z0-9_ ]+$/.test(v);
//       },
//       message: (props) => `${props.value} is not a valid name!`,
//     },
//   },
//   price: {
//     type: Number,
//     required: true,
//   },
//   rating: {
//     type: Number,
//     min: 1,
//     max: 5,
//     required: true,
//   },
//   description: {
//     type: String,
//     required: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// module.exports = mongoose.model("Product", productSchema); new
const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  stock: { type: Number, required: true },
  mainImage: { type: String, required: true },
  images: [{ type: String }],
  filters: {
    size: [String],
    color: [String],
  },
}, { timestamps: true }); // ✅ createdAt and updatedAt are auto-handled
module.exports = mongoose.model('Product', productSchema);