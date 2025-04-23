const Cart = require("../models/cartSchema");

const getCartCount = async (req, res, next) => {
    try {
        let cartCount = 0;

        if (req.session && req.session.user) {
            const userId = req.session.user._id || req.session.user;
            if (userId) {
                const cart = await Cart.findOne({ userId: userId });
                cartCount = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
            }
        }

        res.locals.cartCount = cartCount;
        req.session.cartCount = cartCount;

        next();
    } catch (error) {
        console.error("Error getting cart count:", error);
        res.locals.cartCount = 0;
        next();
    }
};

module.exports = getCartCount;