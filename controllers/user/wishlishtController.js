const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');

const getWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        const userId = req.session.user?._id || req.session.user;

        const wishlist = await Wishlist.findOne({ userId: userId });

        let wishlistItems = [];
        if (wishlist && wishlist.products.length > 0) {
            wishlistItems = await Promise.all(
                wishlist.products.map(async (item) => {
                    const product = await Product.findById(item.productId);
                    return {
                        _id: item._id,
                        productId: product,
                        addedOn: item.addedOn
                    };
                })
            );

            wishlistItems = wishlistItems.filter(item => item.productId);
        }

        res.render('wishlist', { wishlistItems });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).render('error', { error: 'Failed to load wishlist' });
    }
};

const addToWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please login to add items to wishlist' });
        }
        const productId = req.query.id || req.body.productId;
        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const userId = req.session.user?._id || req.session.user;

        let wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            wishlist = new Wishlist({
                userId:userId,
                products: []
            });
        }
        const existingProduct = wishlist.products.find(item =>
            item.productId.toString() === productId.toString()
        );
        if (existingProduct) {
            return res.status(200).json({ success: true, message: 'Product is already in your wishlist' });
        }
        wishlist.products.push({ productId });
        await wishlist.save();
        req.session.wishlistCount = wishlist.products.length;

        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(200).json({ success: true, message: 'Product added to wishlist' });
        } else {
            req.session.message = { type: 'success', text: 'Product added to wishlist!' };
            return res.redirect('/productDetails?id=' + productId);
        }
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
        } else {
            req.session.message = { type: 'error', text: 'Failed to add to wishlist' };
            return res.redirect('back');
        }
    }
};
const removeFromWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please login to manage your wishlist' });
        }
        const itemId = req.query.id;
        if (!itemId) {
            return res.status(400).json({ success: false, message: 'Item ID is required' });
        }
        const userId = req.session.user?._id || req.session.user;
        const wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }
        const productIndex = wishlist.products.findIndex(item => item._id.toString() === itemId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in wishlist' });
        }
        wishlist.products.splice(productIndex, 1);
        await wishlist.save();
        req.session.wishlistCount = wishlist.products.length;

        return res.status(200).json({ success: true, message: 'Item removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        return res.status(500).json({ success: false, message: 'Failed to remove item from wishlist' });
    }
};

const moveToCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
        }
        const { productId, wishlistItemId } = req.body;

        if (!productId || !wishlistItemId) {
            return res.status(400).json({ success: false, message: 'Product ID and Wishlist Item ID are required' });
        }
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const userId = req.session.user?._id || req.session.user;

        let cart = await Cart.findOne({ userId: userId });
        if (!cart) {
            cart = new Cart({
                userId: req.session.user._id,
                items: [],
                totalPrice: 0
            });
        }
        const existingCartItem = cart.items.find(item =>
            item.productId.toString() === productId.toString()
        );

        if (existingCartItem) {
            existingCartItem.quantity += 1;
            existingCartItem.totalPrice = existingCartItem.quantity * existingCartItem.price;
        } else {
            const price = product.salesPrice || product.regularPrice;
            cart.items.push({
                productId: product._id,
                quantity: 1,
                price: price,
                totalPrice: price
            });
        }
        cart.totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
        await cart.save();
        req.session.cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const wishlist = await Wishlist.findOne({ userId: userId });
        if (wishlist) {
            const itemIndex = wishlist.products.findIndex(item => item._id.toString() === wishlistItemId);
            if (itemIndex !== -1) {
                wishlist.products.splice(itemIndex, 1);
                await wishlist.save();
                req.session.wishlistCount = wishlist.products.length;
            }
        }
        return res.status(200).json({
            success: true,
            message: 'Product moved to cart successfully',
            cartCount: cart.items.length,
            wishlistCount: wishlist ? wishlist.products.length : 0
        });
    } catch (error) {
        console.error('Error moving to cart:', error);
        return res.status(500).json({ success: false, message: 'Failed to move item to cart' });
    }
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    moveToCart
};
