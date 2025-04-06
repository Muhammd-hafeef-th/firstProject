const Cart = require('../../models/cartSchema');
const Address = require('../../models/adressSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');


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
        const addresses = addressDocs.flatMap(doc => doc.address.map(addr => ({
            ...addr.toObject(),
            _id: addr._id,
        })));

        let subtotal = 0;
        if (cartItems.length > 0) {
            subtotal = cartItems.reduce((total, item) => {
                return total + (item.productId.salePrice * item.quantity);
            }, 0);
        }

        res.render('checkout', {
            cartItems,
            addresses,
            subtotal,
            messages: req.flash()
        });
    } catch (error) {
        next(error);
    }
}
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
const editAddress = async (req, res,next) => {
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

            res.render('editAddress-checkout',{addressDocs:addressDoc})

    } catch (error) {
        next(error)
    }

}
const addressEdit=async (req,res)=>{
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

const deleteAddress=async (req,res)=>{
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


module.exports = {
    checkout,
    addAddress,
    addAddressCheckout,
    editAddress,
    addressEdit,
    deleteAddress
}