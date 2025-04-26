const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
    try {
        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt,
            notes
        });
        return order;
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        throw error;
    }
};


const verifyPaymentSignature = ({ order_id, payment_id, signature }) => {
    try {
        const crypto = require('crypto');
        const secret = process.env.RAZORPAY_KEY_SECRET;
        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(`${order_id}|${payment_id}`)
            .digest('hex');
        return generated_signature === signature;
    } catch (error) {
        console.error('Razorpay signature verification error:', error);
        return false;
    }
};


const createRefund = async ({ paymentId, amount, notes = {} }) => {
    try {
        const refund = await razorpay.payments.refund(paymentId, {
            amount,
            notes
        });
        return refund;
    } catch (error) {
        console.error('Razorpay refund creation error:', error);
        throw error;
    }
};

module.exports = {
    razorpay,
    createOrder,
    verifyPaymentSignature,
    createRefund
}; 