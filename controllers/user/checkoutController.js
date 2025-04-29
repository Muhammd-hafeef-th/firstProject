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
            acc.shippingCharge += (product.shipingCharge || 0) * quantity;
            return acc;
        }, { subtotal: 0, discountAmount: 0, shippingCharge: 0 });

        let couponDiscount = 0;
        if (req.session.appliedCoupon) {
            const couponData = req.session.appliedCoupon;
            
            if (couponData.discountType === 'percentage') {
                couponDiscount = (calculations.subtotal * couponData.offerPrice) / 100;
            } else {
                couponDiscount = couponData.offerPrice;
            }
        }
        
        res.render('checkout', {
            cartItems: validItems,
            discountAmount: calculations.discountAmount,
            shipingCharge: calculations.shippingCharge,
            addresses: allAddresses,
            subtotal: calculations.subtotal,
            couponDiscount: couponDiscount,
            total: calculations.subtotal - calculations.discountAmount - couponDiscount + calculations.shippingCharge,
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
            throw new Error('Address not found');
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

        req.flash('success', 'Default address updated');
        res.redirect('/checkout');

    } catch (err) {
        req.flash('error', 'Failed to update default address');
        res.redirect('/checkout');
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
            
            if (calculations.subtotal >= couponData.minimumPrice) {
                couponDiscount = (calculations.subtotal * couponData.offerPrice) / 100;
            }
        }

        const totalAmount = calculations.subtotal - calculations.discountAmount - couponDiscount + calculations.shippingCharge;
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
        const userData = await User.findOne({
            $or: [
                { _id: userId },
                { _id: userId }
            ]
        });

        if (!userData) {
            return res.redirect('/login?error=Please login to continue');
        }

        if (!['cod', 'razorpay', 'wallet'].includes(paymentMethod)) {
            return res.status(400).redirect('/cart?error=Invalid payment method');
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
            return res.redirect('/cart?error=Cart is empty');
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
            acc.shippingCharge += (product.shipingCharge || 0) * item.quantity;
            return acc;
        }, { subtotal: 0, discountAmount: 0, shippingCharge: 0 });

        let finalAmount = calculations.subtotal - calculations.discountAmount + calculations.shippingCharge;
        
        let appliedCoupon = null;
        let couponDiscount = 0;
        
        if (req.session.appliedCoupon) {
            const couponData = req.session.appliedCoupon;
            
            if (calculations.subtotal >= couponData.minimumPrice) {
                appliedCoupon = couponData;
                
                if (couponData.discountType === 'percentage') {
                    couponDiscount = (calculations.subtotal * couponData.offerPrice) / 100;
                } else {
                    couponDiscount = couponData.offerPrice;
                }
                
                finalAmount -= couponDiscount;
            }
        }

        const addressDoc = await Address.findOne({ userId });
        const selectedAddress = addressDoc?.address?.[0];

        if (!selectedAddress) {
            return res.redirect('/checkout?error=No shipping address found');
        }

        const orderItems = userCart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.regularPrice,
            discountApplied: Math.max(item.productId.discount || 0, item.productId.brand?.brandOffer || 0) 
        }));

        const newOrder = new Order({
            user: userId,
            orderItems,
            totalPrice: calculations.subtotal,
            discountAmount: calculations.discountAmount,
            couponDiscount: couponDiscount,
            finalAmount,
            address: selectedAddress._id, 
            paymentMethod: {
                type: paymentMethod,
                details: {}
            },
            paymentStatus: 'pending',
            status: 'Pending'
        });
        
        if (appliedCoupon) {
            newOrder.coupon = {
                id: appliedCoupon.id,
                code: appliedCoupon.name,
                discountType: appliedCoupon.discountType,
                discountValue: appliedCoupon.offerPrice
            };
            
            await incrementCouponUsage(appliedCoupon.id);
            
            await Coupon.findByIdAndUpdate(appliedCoupon.id, {
                $addToSet: { userId: userId }
            });
            
            delete req.session.appliedCoupon;
        }

        const isJsonRequest = req.headers['content-type'] === 'application/json' || 
                           req.headers.accept.includes('application/json');

        switch (paymentMethod) {
            case 'cod':
                newOrder.paymentStatus = 'pending';
                await newOrder.save();
                break;

            case 'razorpay':
                try {
                    req.session.pendingOrderData = {
                        user: userId,
                        orderItems,
                        totalPrice: calculations.subtotal,
                        discountAmount: calculations.discountAmount,
                        couponDiscount: couponDiscount,
                        finalAmount,
                        address: selectedAddress._id,
                        paymentMethod: {
                            type: paymentMethod,
                            details: {}
                        }
                    };

                    if (appliedCoupon) {
                        req.session.pendingOrderData.coupon = {
                            id: appliedCoupon.id,
                            code: appliedCoupon.name,
                            discountType: appliedCoupon.discountType,
                            discountValue: appliedCoupon.offerPrice
                        };
                    }

                    const razorpayOrder = await createRazorpayOrder({
                        amount: Math.round(finalAmount * 100), 
                        currency: 'INR',
                        receipt: `order_${nanoid(8)}`,
                        notes: {
                            userId: userId.toString(),
                            cartItems: JSON.stringify(orderItems)
                        }
                    });

                    req.session.razorpayOrderId = razorpayOrder.id;

                    if (isJsonRequest) {
                        return res.json({
                            success: true,
                            razorpay: {
                                key: process.env.RAZORPAY_KEY_ID,
                                order_id: razorpayOrder.id,
                                amount: razorpayOrder.amount,
                                currency: razorpayOrder.currency,
                                name: 'LB Watch Store',
                                description: 'Order Payment',
                                prefill: {
                                    name: userData?.firstname || '',
                                    email: userData?.email || '',
                                    contact: userData?.phNumber || ''
                                }
                            }
                        });
                    }

                    return res.render('razorpayCheckout', {
                        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                        razorpayOrderId: razorpayOrder.id,
                        amount: razorpayOrder.amount,
                        currency: razorpayOrder.currency,
                        userName: userData?.firstname || '',
                        userEmail: userData?.email || '',
                        userPhone: userData?.phNumber || ''
                    });
                } catch (error) {
                    console.error('Razorpay order creation error:', error);
                    
                    if (isJsonRequest) {
                        return res.status(500).json({
                            success: false,
                            message: 'Failed to create payment. Please try again.'
                        });
                    }
                    
                    return res.redirect('/checkout?error=Payment initialization failed');
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
                    description: `Payment for order #${newOrder.orderId}`,
                    status: 'completed',
                    referenceId: `ORDER-${newOrder.orderId}`,
                    date: new Date()
                });
                await wallet.save();

                newOrder.paymentStatus = 'completed';
                newOrder.status = 'Processing';
                newOrder.paymentMethod.details.walletId = wallet._id;
                newOrder.paymentMethod.details.walletBalanceUsed = finalAmount;
                await newOrder.save();

                await Promise.all([
                    ...orderItems.map(item =>
                        Product.findByIdAndUpdate(item.product, {
                            $inc: { quantity: -item.quantity }
                        })
                    ),
                    Cart.deleteOne({ userId })
                ]);

                return res.render('paymentSuccess', {
                    newOrder,
                    selectedAddress,
                    paymentMethod: 'wallet',
                    discountAmount: calculations.discountAmount,
                    couponDiscount: couponDiscount,
                    subtotal: calculations.subtotal,
                    shippingCharge: calculations.shippingCharge
                });
                break;

            default:
                throw new Error('Invalid payment method');
        }

        if (paymentMethod !== 'wallet' && paymentMethod !== 'razorpay') {
            await Promise.all(orderItems.map(item =>
                Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: -item.quantity }
                })
            ));
            
            await Cart.deleteOne({ userId });
            
            return res.render('paymentSuccess', {
                newOrder,
                selectedAddress,
                paymentMethod,
                discountAmount: calculations.discountAmount,
                couponDiscount: couponDiscount,
                subtotal: calculations.subtotal,
                shippingCharge: calculations.shippingCharge
            });
        }

    } catch (error) {
        console.error('Payment processing error:', error);
        next(error);
    }
};

const verifyRazorpayPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || 
            !req.session.pendingOrderData || razorpay_order_id !== req.session.razorpayOrderId) {
            req.flash('error', 'Payment failed: Invalid payment information');
            return res.redirect('/checkout');
        }
        
        const isValid = verifyPaymentSignature({
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            signature: razorpay_signature
        });
        
        if (!isValid) {
            req.flash('error', 'Payment failed: Invalid payment signature');
            return res.redirect('/checkout');
        }
        
        const newOrder = new Order(req.session.pendingOrderData);
        newOrder.paymentMethod.details.razorpayPaymentId = razorpay_payment_id;
        newOrder.paymentMethod.details.signature = razorpay_signature;
        newOrder.paymentMethod.details.razorpayOrderId = razorpay_order_id;
        newOrder.paymentStatus = 'completed';
        newOrder.status = 'Processing';
        
        await newOrder.save();

        if (req.session.appliedCoupon) {
            await incrementCouponUsage(req.session.appliedCoupon.id);
            await Coupon.findByIdAndUpdate(req.session.appliedCoupon.id, {
                $addToSet: { userId: newOrder.user }
            });
            delete req.session.appliedCoupon;
        }
        
        await Promise.all([
            ...newOrder.orderItems.map(item =>
                Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: -item.quantity }
                })
            ),
            Cart.deleteOne({ userId: newOrder.user })
        ]);
        
        delete req.session.pendingOrderData;
        delete req.session.razorpayOrderId;
        
        return res.json({
            success: true,
            orderId: newOrder._id,
            message: 'Payment successful'
        });
        
    } catch (error) {
        console.error('Razorpay verification error:', error);
        req.flash('error', 'Payment failed: Please try again');
        return res.redirect('/checkout');
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

        const addressDoc = await Address.findOne({ 
            userId: order.user,
            'address._id': order.address
        });

        if (!addressDoc) {
            return res.redirect('/orders?error=Address not found');
        }

        const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === order.address.toString());
        if (!selectedAddress) {
            return res.redirect('/orders?error=Specific address not found');
        }
        
        const calculations = {
            subtotal: order.totalPrice,
            discountAmount: order.discountAmount || 0,
            couponDiscount: order.couponDiscount || 0,
            shippingCharge: order.finalAmount - (order.totalPrice - order.discountAmount - (order.couponDiscount || 0))
        };

        res.render('paymentSuccess', {
            newOrder: order,
            selectedAddress: selectedAddress,
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