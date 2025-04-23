const Wishlist = require("../models/wishlistSchema");

const getWishlistCount = async (req, res, next) => {
    try {
        let wishlistCount = 0;

        if (req.session && req.session.user) {
            const userId = req.session.user._id || req.session.user;
            if (userId) {
                const wishlist = await Wishlist.findOne({ userId: userId });
                wishlistCount = wishlist ? wishlist.products.length : 0;
            }
        }

        res.locals.wishlistCount = wishlistCount;
        req.session.wishlistCount = wishlistCount;

        next();
    } catch (error) {
        console.error("Error getting wishlist count:", error);
        res.locals.wishlistCount = 0;
        next();
    }
};

module.exports = getWishlistCount; 