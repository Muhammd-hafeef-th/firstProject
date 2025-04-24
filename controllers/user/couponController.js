const Coupon = require('../../models/couponSchema');
const { incrementCouponUsage } = require('../admin/couponController');

const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user?._id || req.session.user;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code is required'
            });
        }

        const coupon = await Coupon.findOne({ name: code.toUpperCase() });
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        if (!coupon.isList) {
            return res.status(400).json({
                success: false,
                message: 'This coupon is not active'
            });
        }

        const currentDate = new Date();
        if (new Date(coupon.expireOn) < currentDate) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has expired'
            });
        }

        if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has reached its maximum usage limit'
            });
        }

        if (coupon.userId.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You have already used this coupon'
            });
        }
        
        req.session.appliedCoupon = {
            id: coupon._id,
            name: coupon.name,
            description: coupon.description,
            discountType: coupon.discountType,
            offerPrice: coupon.offerPrice,
            minimumPrice: coupon.minimumPrice
        };

        return res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            coupon: {
                id: coupon._id,
                name: coupon.name,
                description: coupon.description,
                discountType: coupon.discountType,
                offerPrice: coupon.offerPrice,
                minimumPrice: coupon.minimumPrice
            }
        });
    } catch (error) {
        console.error('Error validating coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong, please try again later'
        });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponId } = req.body;
        const userId = req.session.user?._id || req.session.user;
        
        if (!couponId) {
            return res.status(400).json({
                success: false,
                message: 'Coupon ID is required'
            });
        }

        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }
        
        if (!coupon.isList) {
            return res.status(400).json({
                success: false,
                message: 'This coupon is not active'
            });
        }

        const currentDate = new Date();
        if (new Date(coupon.expireOn) < currentDate) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has expired'
            });
        }

        if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has reached its maximum usage limit'
            });
        }

        if (coupon.userId.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You have already used this coupon'
            });
        }
        
        req.session.appliedCoupon = {
            id: coupon._id,
            name: coupon.name,
            description: coupon.description,
            discountType: coupon.discountType,
            offerPrice: coupon.offerPrice,
            minimumPrice: coupon.minimumPrice
        };

        return res.status(200).json({
            success: true,
            message: 'Coupon applied successfully to your cart'
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong, please try again later'
        });
    }
};

const removeCoupon = async (req, res) => {
    try {
        if (req.session.appliedCoupon) {
            delete req.session.appliedCoupon;
        }

        return res.status(200).json({
            success: true,
            message: 'Coupon removed successfully'
        });
    } catch (error) {
        console.error('Error removing coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong, please try again later'
        });
    }
};

module.exports = {
    validateCoupon,
    applyCoupon,
    removeCoupon
}; 