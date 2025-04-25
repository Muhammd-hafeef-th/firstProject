const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * @param {Object} options - Order options
 * @param {number} options.amount - Amount in smallest currency unit (paise for INR)
 * @param {string} options.currency - Currency code (default: INR)
 * @param {string} options.receipt - Receipt ID for your reference
 * @param {Object} options.notes - Additional notes for the order (optional)
 * @returns {Promise<Object>} - Razorpay order object
 */
const createOrder = async (options) => {
    try {
        const order = await razorpay.orders.create({
            amount: options.amount,
            currency: options.currency || 'INR',
            receipt: options.receipt,
            notes: options.notes || {}
        });
        return order;
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        throw error;
    }
};

/**
 * Verify Razorpay payment signature
 * @param {Object} options - Verification options
 * @param {string} options.order_id - Razorpay order ID
 * @param {string} options.payment_id - Razorpay payment ID
 * @param {string} options.signature - Razorpay signature
 * @returns {boolean} - True if signature is valid
 */
const verifyPaymentSignature = (options) => {
    try {
        const crypto = require('crypto');
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(options.order_id + '|' + options.payment_id)
            .digest('hex');
        
        return generatedSignature === options.signature;
    } catch (error) {
        console.error('Razorpay signature verification error:', error);
        return false;
    }
};

module.exports = {
    razorpay,
    createOrder,
    verifyPaymentSignature
}; 