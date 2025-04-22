const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema')


const checkout = async (req, res, next) => {
    try {
        const id = req.session.user?._id || req.session.user;

        const userCart = await Cart.findOne({ userId: id })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {  // Add brand population
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

        // Updated calculations with the same discount logic
        const calculations = validItems.reduce((acc, item) => {
            const product = item.productId;
            const quantity = item.quantity;
            const itemPrice = product.regularPrice * quantity;

            // Apply the same discount logic as other controllers
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;
            const effectiveDiscount = Math.max(brandOffer, productOffer);
            const itemSavings = itemPrice * (effectiveDiscount / 100);

            acc.subtotal += itemPrice;
            acc.discountAmount += itemSavings; // Actual savings amount
            acc.shippingCharge += (product.shipingCharge || 0) * quantity;
            return acc;
        }, { subtotal: 0, discountAmount: 0, shippingCharge: 0 });

        res.render('checkout', {
            cartItems: validItems,
            discountAmount: calculations.discountAmount, // Changed from discount to discountAmount
            shipingCharge: calculations.shippingCharge,
            addresses: allAddresses,
            subtotal: calculations.subtotal,
            total: calculations.subtotal - calculations.discountAmount + calculations.shippingCharge,
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

        res.render('proceedPayment', {
            cartItems,
            discountAmount: calculations.discountAmount, 
            shipingCharge: calculations.shippingCharge,
            subtotal: calculations.subtotal,
            total: calculations.subtotal - calculations.discountAmount,
            addresses: allAddresses
        });
    } catch (error) {
        next(error);
    }
};

const choosePayment = async (req, res, next) => {
    try {
        const paymentMethod = req.body.payment;
        const userId = req.session.user?._id || req.session.user;

        if (!['cod', 'paypal', 'wallet'].includes(paymentMethod)) {
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

        const finalAmount = calculations.subtotal - calculations.discountAmount + calculations.shippingCharge;

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
            finalAmount,
            address: selectedAddress._id,
            paymentMethod: {
                type: paymentMethod,
                details: {}
            },
            paymentStatus: 'pending',
            status: 'Pending'
        });

        switch (paymentMethod) {
            case 'cod':
                newOrder.paymentStatus = 'completed';
                await newOrder.save();
                break;

            case 'paypal':
                const paypalPayment = await createPayPalPayment(finalAmount);

                newOrder.paymentMethod.details = {
                    paymentId: paypalPayment.id,
                    approvalUrl: paypalPayment.links.find(l => l.rel === 'approval_url').href
                };
                await newOrder.save();

                return res.redirect(paypalPayment.links.find(l => l.rel === 'approval_url').href);

            case 'wallet':
                const userWallet = await Wallet.findOne({ user: userId });

                if (!userWallet || userWallet.balance < finalAmount) {
                    return res.redirect('/checkout?error=Insufficient wallet balance');
                }

                userWallet.balance -= finalAmount;
                await userWallet.save();

                newOrder.paymentStatus = 'completed';
                newOrder.paymentMethod.details = {
                    walletTransaction: `WALLET-${nanoid()}`,
                    previousBalance: userWallet.balance + finalAmount,
                    newBalance: userWallet.balance
                };
                await newOrder.save();
                break;

            default:
                throw new Error('Invalid payment method');
        }

        await Promise.all(orderItems.map(item =>
            Product.findByIdAndUpdate(item.product, {
                $inc: { quantity: -item.quantity }
            })
        ));

        await Cart.deleteOne({ userId });

        res.render('paymentSuccess', {
            newOrder,
            selectedAddress,
            paymentMethod,
            discountAmount: calculations.discountAmount, // Pass discountAmount to view
            subtotal: calculations.subtotal,
            shippingCharge: calculations.shippingCharge
        });

    } catch (error) {
        if (error.message.includes('PAYPAL')) {
            await Order.deleteOne({ _id: newOrder._id });
            return res.redirect('/checkout?error=Payment processing failed');
        }

        next(error);
    }
};




module.exports = {
    checkout,
    addAddress,
    addAddressCheckout,
    editAddress,
    addressEdit,
    deleteAddress,
    setDefaultAddress,
    proceedPayment,
    choosePayment
}