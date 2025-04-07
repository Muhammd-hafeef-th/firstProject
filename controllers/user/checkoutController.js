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
                model: 'Product'
            }) || { items: [] };

        const cartItems = userCart.items || [];
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

        let subtotal = cartItems.reduce((total, item) => {
            return total + (item.productId.regularPrice * item.quantity);
        }, 0);

        let discount = cartItems.reduce((total, item) => {
            return total + (item.productId.discount * item.quantity);

        }, 0);

        let shipingCharge = cartItems.reduce((total, item) => {
            total += item.productId.shipingCharge
            return total;
        }, 0)


        res.render('checkout', {
            cartItems,
            discount,
            shipingCharge,
            addresses: allAddresses,
            subtotal,
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
                model: 'Product'
            }) || { items: [] };

        const cartItems = userCart.items || [];
        let subtotal = cartItems.reduce((total, item) => {
            return total + (item.productId.regularPrice * item.quantity);
        }, 0);

        let discount = cartItems.reduce((total, item) => {
            return total + (item.productId.discount * item.quantity);

        }, 0);

        let shipingCharge = cartItems.reduce((total, item) => {
            total += item.productId.shipingCharge
            return total;
        }, 0)

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
            discount,
            shipingCharge,
            subtotal,
            addresses: allAddresses
        })
    } catch (error) {
        next(error)
    }
}

const choosePayment = async (req, res, next) => {
    try {
        const body = req.body.payment;
        const id = req.session.user?._id || req.session.user;

        const userCart = await Cart.findOne({ userId: id })
            .populate({
                path: 'items.productId',
                model: 'Product'
            }) || { items: [] };

        const cartItems = userCart.items || [];

        let subtotal = cartItems.reduce((total, item) => {
            return total + (item.productId.regularPrice * item.quantity);
        }, 0);

        let discount = cartItems.reduce((total, item) => {
            return total + (item.productId.discount * item.quantity);
        }, 0);

        let shipingCharge = cartItems.reduce((total, item) => {
            total += item.productId.shipingCharge;
            return total;
        }, 0);

        const finalAmount = subtotal - discount + shipingCharge;

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
        const selectedAddress = allAddresses[0];

        if (body === 'cod') {
            const orderItems = cartItems.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.regularPrice
            }));

            const newOrder = new Order({
                orderItems: orderItems,
                totalPrice: subtotal,
                discount: discount,
                finalAmount: finalAmount,
                address: selectedAddress._id,
                invoiceDate: new Date(),
                status: 'Pending',
                couponApplied: false
            });

            await newOrder.save();

            await Cart.deleteOne({ userId: id });

            res.render('paymentSuccess',{newOrder,selectedAddress});
        } else {
            res.redirect('/pageNotFound');
        }

    } catch (error) {
        next(error)
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
    choosePayment
}