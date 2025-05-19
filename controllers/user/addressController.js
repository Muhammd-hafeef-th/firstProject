const User = require('../../models/userSchema');
const Address = require('../../models/adressSchema')


const addressPageGet = async (req, res, next) => {
    try {
        let address = null;
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({
                $or: [
                    { _id: req.session.user._id },
                    { _id: req.session.user }
                ]
            });
            address = await Address.findOne({
                $or: [
                    { userId: req.session.user._id },
                    { userId: req.session.user }
                ]
            })


        }
          if (!userData) {
            return res.redirect('/login');
        }
        res.render('address', { userDatas: userData, addresses: address || { address: [] } })
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
        res.render('addAddress', { userDatas: userData });
    } catch (error) {
        next(error);
    }

}

const addressAdded = async (req, res,next) => {
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
        res.redirect('/address');

    } catch (error) {
        console.error("Error while adding address:", error);
        res.status(500).redirect('/address');
    }
};

const editAddress = async (req, res, next) => {
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

        const userId = req.session.user?._id || req.session.user;
        let addressId = req.query.id;
        let addressDoc = await Address.findOne({
            userId: userId,
            "address._id": addressId
        },
            {
                address: { $elemMatch: { _id: addressId } }
            });

        res.render('editAddress', { userDatas: userData, addressDocs: addressDoc })
    } catch (error) {
        next(error);
    }
}

const addressEdit = async (req, res, next) => {
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

        res.redirect('/address');
    } catch (error) {
        next(error);
    }
}

const deleteAddress =async (req,res,next)=>{
    try {
        const userId = req.session.user?._id || req.session.user;
        const addressId = req.params.id;
        
        await Address.updateOne(
            { userId: userId },
            { $pull: { address: { _id: addressId } } }
        );
        res.redirect('/address');
    
    } catch (error) {
        next(error)
    }
}

module.exports = {
    addressPageGet,
    addAddress,
    addressAdded,
    editAddress,
    addressEdit,
    deleteAddress
}