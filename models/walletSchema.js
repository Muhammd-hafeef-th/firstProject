const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    username: {
      type: String,
      required: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: false
    }
  },
  balance: {
    type: Number,
    default: 0.00,
    required: true
  },
  currency: {
    type: String,
    default: 'RUPEES'
  },
  transactions: [{
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'transfer', 'payment', 'refund','referal'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed'],
      default: 'completed'
    },
    date: {
      type: Date,
      default: Date.now
    },
    counterparty: String, 
    referenceId: String   
  }],
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;