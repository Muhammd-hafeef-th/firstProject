const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema');
const { nanoid } = require('nanoid');
const Coupon = require('../../models/couponSchema');
const mongoose = require('mongoose');
const { incrementCouponUsage } = require('../admin/couponController');
const { createOrder: createRazorpayOrder, verifyPaymentSignature } = require('../../utils/razorpay');


const checkout = async (req, res, next) => {
    try {
        const id = req.session.user?._id || req.session.user;

        const userCart = await Cart.findOne({ userId: id })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {
                    path: 'brand',
                    model: 'Brand'
                },
                match: {
                    $and: [
                        { status: { $ne: "Discontinued" } },
                    ]
                }
            }) || { items: [] };

        const validItems = userCart.items?.filter(item => item.productId) || [];

        const invalidItems = validItems.filter(item => {
            return item.quantity > item.productId.quantity || !item.productId.isListed;
        });

        if (invalidItems.length > 0) {
            return res.redirect('/cart');
        }

        const addressDocs = await Address.find({ userId: id });
        let allAddresses = [];

        addressDocs.forEach(doc => {
            allAddresses.push(...doc.address.map(addr => ({
                ...addr.toObject(),
                _id: addr._id
            })));
        });

        allAddresses.sort((a, b) => {
            if (a.position !== undefined && b.position !== undefined) {
                return a.position - b.position;
            }
            return a.createdAt - b.createdAt;
        });

        const calculations = validItems.reduce((acc, item) => {
            const product = item.productId;
            const quantity = item.quantity;
            const itemPrice = product.regularPrice * quantity;

            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;
            const effectiveDiscount = Math.max(brandOffer, productOffer);
            const itemSavings = itemPrice * (effectiveDiscount / 100);

            acc.subtotal += itemPrice;
            acc.discountAmount += itemSavings;
            return acc;
        }, { subtotal: 0, discountAmount: 0, shippingCharge: 0 });

        let couponDiscount = 0;
        if (req.session.appliedCoupon) {
            const couponData = req.session.appliedCoupon;

            if (couponData.discountType === 'percentage') {
                couponDiscount = Math.min(
                    (calculations.subtotal * couponData.offerPrice) / 100,
                    couponData.maxDiscount || Infinity
                );
            } else {
                couponDiscount = Math.min(
                    couponData.offerPrice,
                    calculations.subtotal - calculations.discountAmount
                );
            }
        }

        const discountedSubtotal = calculations.subtotal - calculations.discountAmount - couponDiscount;
        if (calculations.subtotal < 3000) {
            calculations.shippingCharge = 40;
        } else {
            calculations.shippingCharge = 0;
        }

        res.render('checkout', {
            cartItems: validItems,
            discountAmount: calculations.discountAmount,
            shippingCharge: calculations.shippingCharge,
            addresses: allAddresses,
            subtotal: calculations.subtotal,
            couponDiscount: couponDiscount,
            total: discountedSubtotal + calculations.shippingCharge,
            messages: req.flash()
        });

    } catch (error) {
        next(error);
    }
};
const addAddress = async (req, res, next) => {
    try {
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({
                $or: [
                    { _id: req.session.user._id },
                    { _id: req.session.user }
                ]
            });
        }
        res.render('addAddressCheckout', { userDatas: userData });
    } catch (error) {
        next(error);
    }

}
const addAddressCheckout = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        const { name, state, country, city, landMark, pincode, phone, altPhone } = req.body;
        let addressDoc = await Address.findOne({ userId });
        if (addressDoc) {
            addressDoc.address.push({
                name,
                state,
                country,
                city,
                landMark,
                pincode,
                phone,
                altPhone: altPhone || ""
            });
        } else {
            addressDoc = new Address({
                userId,
                address: [{
                    name,
                    state,
                    country,
                    city,
                    landMark,
                    pincode,
                    phone,
                    altPhone: altPhone || ""
                }]
            });
        }

        await addressDoc.save();
        res.redirect('/checkout');

    } catch (error) {
        console.error("Error while adding address:", error);
        res.status(500).redirect('/address');
    }
}
const editAddress = async (req, res, next) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        let addressId = req.query.id;
        let addressDoc = await Address.findOne({
            userId: userId,
            "address._id": addressId
        },
            {
                address: { $elemMatch: { _id: addressId } }
            });

        res.render('editAddress-checkout', { addressDocs: addressDoc })

    } catch (error) {
        next(error)
    }

}
const addressEdit = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user?._id || req.session.user;

        const updatedAddress = {
            "address.$.name": req.body.name,
            "address.$.state": req.body.state,
            "address.$.country": req.body.country,
            "address.$.city": req.body.city,
            "address.$.landMark": req.body.landMark,
            "address.$.pincode": req.body.pincode,
            "address.$.phone": req.body.phone,
            "address.$.altPhone": req.body.altPhone,
        };

        await Address.updateOne(
            { userId: userId, "address._id": addressId },
            { $set: updatedAddress }
        );

        res.redirect('/checkout');
    } catch (error) {
        next(error);
    }
}

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        const addressId = req.params.id;
        console.log(addressId)
        await Address.updateOne(
            { userId: userId },
            { $pull: { address: { _id: addressId } } }
        );
        res.redirect('/checkout');

    } catch (error) {
        next(error)
    }
}

const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const addressId = req.params.id;

        const addressDocs = await Address.find({ userId });

        let targetAddress = null;
        let allAddresses = [];

        for (const doc of addressDocs) {
            for (const addr of doc.address) {
                if (addr._id.equals(addressId)) {
                    targetAddress = addr;
                }
                allAddresses.push(addr);
            }
        }

        if (!targetAddress) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        const reordered = [
            targetAddress,
            ...allAddresses.filter(a => !a._id.equals(addressId))
        ];

        for (let i = 0; i < reordered.length; i++) {
            const addr = reordered[i];
            await Address.findOneAndUpdate(
                { userId, "address._id": addr._id },
                { $set: { "address.$.position": i } }
            );
        }

        // Return JSON response instead of redirect
        return res.status(200).json({
            success: true,
            message: 'Default address updated successfully'
        });

    } catch (err) {
        console.error('Error updating default address:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to update default address'
        });
    }
};

const proceedPayment = async (req, res, next) => {
    try {
        const id = req.session.user?._id || req.session.user;
        const userData = await User.findOne({
            $or: [
                { _id: id },
                { _id: id }
            ]
        });

        if (!userData) {
            return res.redirect('/login?error=Please login to continue');
        }

        const wallet = await Wallet.findOne({ 'user.email': userData.email });
        const walletBalance = wallet ? wallet.balance : 0;

        const userCart = await Cart.findOne({ userId: id })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {
                    path: 'brand',
                    model: 'Brand'
                }
            }) || { items: [] };

        const cartItems = userCart.items?.filter(item => item.productId) || [];

        const calculations = cartItems.reduce((acc, item) => {
            const product = item.productId;
            const quantity = item.quantity;
            const itemPrice = product.regularPrice * quantity;

            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;
            const effectiveDiscount = Math.max(brandOffer, productOffer);
            const itemSavings = itemPrice * (effectiveDiscount / 100);

            acc.subtotal += itemPrice;
            acc.discountAmount += itemSavings;
            acc.shippingCharge += (product.shipingCharge || 0);
            return acc;
        }, { subtotal: 0, discountAmount: 0, shippingCharge: 0 });

        const addressDocs = await Address.find({ userId: id });
        let allAddresses = [];

        addressDocs.forEach(doc => {
            allAddresses.push(...doc.address.map(addr => ({
                ...addr.toObject(),
                _id: addr._id
            })));
        });

        allAddresses.sort((a, b) => {
            if (a.position !== undefined && b.position !== undefined) {
                return a.position - b.position;
            }
            return a.createdAt - b.createdAt;
        });

        let couponDiscount = 0;
        if (req.session.appliedCoupon) {
            const couponData = req.session.appliedCoupon;

            if (couponData.discountType === 'percentage') {
                couponDiscount = Math.min(
                    (calculations.subtotal * couponData.offerPrice) / 100,
                    couponData.maxDiscount || Infinity
                );
            } else {
                couponDiscount = Math.min(
                    couponData.offerPrice,
                    calculations.subtotal - calculations.discountAmount
                );
            }
        }
        const totalAmount = calculations.subtotal - calculations.discountAmount - couponDiscount;
        let shippingCharge = 0;

        if (calculations.subtotal < 3000) {
            shippingCharge = 40;
        }

        const canUseWallet = walletBalance >= totalAmount;

        res.render('proceedPayment', {
            cartItems,
            discountAmount: calculations.discountAmount,
            shipingCharge: calculations.shippingCharge,
            subtotal: calculations.subtotal,
            couponDiscount: couponDiscount,
            total: totalAmount,
            addresses: allAddresses,
            walletBalance: walletBalance,
            canUseWallet: canUseWallet,
            userData: userData,
            shippingCharge,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        next(error);
    }
};

const choosePayment = async (req, res, next) => {
    try {
        const paymentMethod = req.body.payment;
        const userId = req.session.user?._id || req.session.user;
        const userData = await User.findById(userId);

        if (!userData) {
            return res.status(401).json({
                success: false,
                message: 'Please login to continue'
            });
        }

        if (!['cod', 'razorpay', 'wallet'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method'
            });
        }

        const userCart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {
                    path: 'brand',
                    model: 'Brand'
                }
            }) || { items: [] };

        if (!userCart?.items?.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        const calculations = userCart.items.reduce((acc, item) => {
            const product = item.productId;
            if (!product) return acc;

            const itemPrice = product.regularPrice * item.quantity;
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;
            const effectiveDiscount = Math.max(brandOffer, productOffer);
            const itemSavings = itemPrice * (effectiveDiscount / 100);

            acc.subtotal += itemPrice;
            acc.discountAmount += itemSavings;
            return acc;
        }, { subtotal: 0, discountAmount: 0, shippingCharge: 0 });

        let couponDiscount = 0;
        let appliedCoupon = null;

        if (req.session.appliedCoupon) {
            const couponData = req.session.appliedCoupon;

            if (calculations.subtotal >= couponData.minimumPrice) {
                appliedCoupon = couponData;

                if (couponData.discountType === 'percentage') {
                    couponDiscount = (calculations.subtotal * couponData.offerPrice) / 100;
                } else {
                    couponDiscount = couponData.offerPrice;
                }
            }
        }

        const discountedSubtotal = calculations.subtotal - calculations.discountAmount - couponDiscount;
        if (calculations.subtotal < 3000) {
            calculations.shippingCharge = 40;
        } else {
            calculations.shippingCharge = 0;
        }

        let finalAmount = calculations.subtotal - calculations.discountAmount - couponDiscount + calculations.shippingCharge;

        const addressDoc = await Address.findOne({ userId });
        const selectedAddress = addressDoc?.address?.[0];

        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: 'No shipping address found'
            });
        }

        const orderItems = userCart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.regularPrice,
            discountApplied: Math.max(item.productId.discount || 0, item.productId.brand?.brandOffer || 0)
        }));

        switch (paymentMethod) {
            case 'cod':
                const codOrder = new Order({
                    user: userId,
                    orderItems,
                    totalPrice: calculations.subtotal,
                    discount: calculations.discountAmount,
                    couponDiscount: couponDiscount,
                    shippingCharge: calculations.shippingCharge,
                    finalAmount,
                    address: {
                        name: selectedAddress.name,
                        city: selectedAddress.city,
                        landMark: selectedAddress.landMark,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                        phone: selectedAddress.phone,
                        altPhone: selectedAddress.altPhone || "",
                        country: selectedAddress.country
                    },
                    paymentMethod: {
                        type: 'cod',
                        details: {}
                    },
                    paymentStatus: 'pending',
                    status: 'Pending'
                });

                if (appliedCoupon) {
                    codOrder.coupon = {
                        id: appliedCoupon.id,
                        code: appliedCoupon.name,


                        discountType: appliedCoupon.discountType,
                        discountValue: appliedCoupon.offerPrice
                    };

                    await incrementCouponUsage(appliedCoupon.id);
                    await Coupon.findByIdAndUpdate(appliedCoupon.id, {
                        $addToSet: { userId: userId }
                    });
                }

                await codOrder.save();

                await Promise.all([
                    ...orderItems.map(item =>
                        Product.findByIdAndUpdate(item.product, {
                            $inc: { quantity: -item.quantity }
                        })
                    ),
                    Cart.deleteOne({ userId })
                ]);

                return res.json({
                    success: true,
                    paymentMethod: 'cod',
                    orderId: codOrder._id,
                    redirect: `/paymentSuccess/${codOrder._id}`
                });

            case 'razorpay':
                try {
                    const razorpayOrderData = {
                        user: userId,
                        orderItems,
                        totalPrice: calculations.subtotal,
                        discount: calculations.discountAmount,
                        couponDiscount: couponDiscount,
                        shippingCharge: calculations.shippingCharge,
                        finalAmount,
                        address: {
                            name: selectedAddress.name,
                            city: selectedAddress.city,
                            landMark: selectedAddress.landMark,
                            state: selectedAddress.state,
                            pincode: selectedAddress.pincode,
                            phone: selectedAddress.phone,
                            altPhone: selectedAddress.altPhone || "",
                            country: selectedAddress.country
                        },
                        paymentMethod: {
                            type: 'razorpay',
                            details: {
                                status: 'pending'
                            }
                        },
                        paymentStatus: 'pending',
                        status: 'Pending'
                    };

                    if (appliedCoupon) {
                        razorpayOrderData.coupon = {
                            id: appliedCoupon.id,
                            code: appliedCoupon.name,
                            discountType: appliedCoupon.discountType,
                            discountValue: appliedCoupon.offerPrice
                        };
                    }

                    req.session.pendingRazorpayOrder = razorpayOrderData;
                    const tempOrderId = nanoid();
                    req.session.tempOrderId = tempOrderId;

                    const rzpOrder = await createRazorpayOrder({
                        amount: Math.round(finalAmount * 100),
                        currency: 'INR',
                        receipt: tempOrderId,
                        notes: {
                            userId: userId.toString(),
                            tempOrderId: tempOrderId
                        }
                    });

                    return res.json({
                        success: true,
                        paymentMethod: 'razorpay',
                        tempOrderId: tempOrderId,
                        razorpay: {
                            key: process.env.RAZORPAY_KEY_ID,
                            order_id: rzpOrder.id,
                            amount: rzpOrder.amount,
                            currency: rzpOrder.currency,
                            name: 'LB Watch Store',
                            description: 'Order Payment',
                            prefill: {
                                name: userData.firstname + ' ' + userData.lastname,
                                email: userData.email,
                                contact: userData.phNumber
                            }
                        }
                    });

                } catch (error) {
                    console.error('Razorpay error:', error);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to initialize payment'
                    });
                }

            case 'wallet':
                const wallet = await Wallet.findOne({ 'user.email': userData.email });
                if (!wallet || wallet.balance < finalAmount) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient wallet balance'
                    });
                }

                wallet.balance -= finalAmount;
                wallet.transactions.push({
                    amount: finalAmount,
                    type: 'payment',
                    description: `Payment for order`,
                    status: 'completed',
                    referenceId: `ORDER-${new Date().getTime()}`,
                    date: new Date()
                });
                await wallet.save();

                const walletOrder = new Order({
                    user: userId,
                    orderItems,
                    totalPrice: calculations.subtotal,
                    discount: calculations.discountAmount,
                    couponDiscount: couponDiscount,
                    shippingCharge: calculations.shippingCharge,
                    finalAmount,
                    address: {
                        name: selectedAddress.name,
                        city: selectedAddress.city,
                        landMark: selectedAddress.landMark,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                        phone: selectedAddress.phone,
                        altPhone: selectedAddress.altPhone || "",
                        country: selectedAddress.country
                    },
                    paymentMethod: {
                        type: 'wallet',
                        details: {
                            walletId: wallet._id,
                            walletBalanceUsed: finalAmount
                        }
                    },
                    paymentStatus: 'completed',
                    status: 'Processing'
                });

                if (appliedCoupon) {
                    walletOrder.coupon = {
                        id: appliedCoupon.id,
                        code: appliedCoupon.name,
                        discountType: appliedCoupon.discountType,
                        discountValue: appliedCoupon.offerPrice
                    };

                    await incrementCouponUsage(appliedCoupon.id);
                    await Coupon.findByIdAndUpdate(appliedCoupon.id, {
                        $addToSet: { userId: userId }
                    });
                }

                await walletOrder.save();

                await Promise.all([
                    ...orderItems.map(item =>
                        Product.findByIdAndUpdate(item.product, {
                            $inc: { quantity: -item.quantity }
                        })
                    ),
                    Cart.deleteOne({ userId })
                ]);

                return res.json({
                    success: true,
                    paymentMethod: 'wallet',
                    orderId: walletOrder._id,
                    redirect: `/paymentSuccess/${walletOrder._id}`
                });

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment method'
                });
        }

    } catch (error) {
        console.error('Payment processing error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const verifyRazorpayPayment = async (req, res, next) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;


        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
            console.log("Missing parameters:", {
                payment_id_missing: !razorpay_payment_id,
                order_id_missing: !razorpay_order_id,
                signature_missing: !razorpay_signature,
                orderId_missing: !orderId
            });
            return res.status(400).json({
                success: false,
                message: 'Missing payment details'
            });
        }

        const isValid = verifyPaymentSignature({
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            signature: razorpay_signature
        });

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        const pendingOrder = req.session.pendingRazorpayOrder;
        if (!pendingOrder) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        pendingOrder.paymentMethod.details = {
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpaySignature: razorpay_signature,
            status: 'completed'
        };
        pendingOrder.paymentStatus = 'completed';
        pendingOrder.status = 'Processing';

        const order = new Order(pendingOrder);
        await order.save();

        await Promise.all(
            order.orderItems.map(item =>
                Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: -item.quantity }
                })
            )
        );

        await Cart.deleteOne({ userId: order.user });

        if (order.coupon) {
            await incrementCouponUsage(order.coupon.id);
            await Coupon.findByIdAndUpdate(order.coupon.id, {
                $addToSet: { userId: order.user }
            });
        }

        delete req.session.pendingRazorpayOrder;
        delete req.session.tempOrderId;

        return res.json({
            success: true,
            orderId: order._id,
            message: 'Payment successful and order placed'
        });

    } catch (error) {
        console.error('Razorpay verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
};


const paymentSuccess = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate({
                path: 'orderItems.product',
                model: 'Product'
            });

        if (!order) {
            return res.redirect('/orders?error=Order not found');
        }

        if (order.user.toString() !== (req.session.user?._id || req.session.user).toString()) {
            return res.redirect('/orders?error=Unauthorized access');
        }

        if (order.paymentStatus !== 'completed') {
            return res.redirect('/checkout?error=Payment not completed');
        }

        const selectedAddress = order.address;
        if (!selectedAddress) {
            return res.redirect('/orders?error=Address not found');
        }

        const calculations = {
            subtotal: order.totalPrice,
            discountAmount: order.discountAmount || 0,
            couponDiscount: order.couponDiscount || 0,
            shippingCharge: order.finalAmount - (order.totalPrice - order.discountAmount - (order.couponDiscount || 0))
        };

        res.render('paymentSuccess', {
            newOrder: order,
            selectedAddress: order.address,
            paymentMethod: order.paymentMethod.type,
            discountAmount: calculations.discountAmount,
            couponDiscount: calculations.couponDiscount,
            subtotal: calculations.subtotal,
            shippingCharge: calculations.shippingCharge
        });
    } catch (error) {
        console.error('Error rendering success page:', error);
        next(error);
    }
}

module.exports = {
    checkout,
    addAddress,
    addAddressCheckout,
    editAddress,
    addressEdit,
    deleteAddress,
    setDefaultAddress,
    proceedPayment,
    choosePayment,
    verifyRazorpayPayment,
    paymentSuccess
}