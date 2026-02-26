const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Optional: only set if logged in
    default: null,
  },
  address: { type: String, required: true },
  mobile: { type: String, required: true },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: { type: Number, required: true },
    }
  ],
  totalAmount: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  
   status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled'],
    default: 'pending',
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
