const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

const GetOrder = async (req, res, next) => {
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
        res.render('order',{userDatas: userData})
    } catch (error) {
        next(error)
    }
}

module.exports = {
    GetOrder
}