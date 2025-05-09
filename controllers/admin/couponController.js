const Coupon = require('../../models/couponSchema');

const getCoupon = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupon.find()
            .populate({
                path: 'userId',
                select: 'firstname lastname email phNumber',
                model: 'User'
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        res.render('coupons', { 
            coupons,
            currentPage: page,
            totalPages,
            totalCoupons
        });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.render('admin-error', { 
            message: 'Failed to fetch coupons',
            error: error.message 
        });
    }
};

const addCoupon = async (req, res) => {
    try {
        const { name, offerPrice, minimumPrice, expireOn, discountType, description, usageLimit } = req.body;

        if (!name || !offerPrice || !minimumPrice || !expireOn || !discountType) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }

        if (discountType === 'percentage') {
            if (Number(offerPrice) <= 0 || Number(offerPrice) > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Percentage discount must be between 1 and 100'
                });
            }
        } else {
            if (Number(offerPrice) >= Number(minimumPrice)) {
                return res.status(400).json({
                    success: false,
                    message: 'Discount amount must be less than minimum purchase amount'
                });
            }
        }

        const existingCoupon = await Coupon.findOne({ name });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists'
            });
        }

        const newCoupon = new Coupon({
            name: name.toUpperCase(),
            description: description || '',
            offerPrice: Number(offerPrice),
            minimumPrice: Number(minimumPrice),
            discountType,
            expireOn: new Date(expireOn),
            createdOn: new Date(),
            usageLimit: Number(usageLimit) || 0,
            usageCount: 0,
            isList: true
        });

        await newCoupon.save();
        
        res.status(201).json({
            success: true,
            message: 'Coupon created successfully'
        });
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create coupon'
        });
    }
};

const editCoupon = async (req, res) => {
    try {
        const { couponId, name, offerPrice, minimumPrice, expireOn, discountType, description, usageLimit } = req.body;

        if (!couponId || !name || !offerPrice || !minimumPrice || !expireOn || !discountType) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }

        if (discountType === 'percentage') {
            if (Number(offerPrice) <= 0 || Number(offerPrice) > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Percentage discount must be between 1 and 100'
                });
            }
        } else {
            if (Number(offerPrice) >= Number(minimumPrice)) {
                return res.status(400).json({
                    success: false,
                    message: 'Discount amount must be less than minimum purchase amount'
                });
            }
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        if (name !== coupon.name) {
            const existingCoupon = await Coupon.findOne({ name });
            if (existingCoupon) {
                return res.status(400).json({
                    success: false,
                    message: 'Coupon code already exists'
                });
            }
        }

        coupon.name = name.toUpperCase();
        coupon.description = description || '';
        coupon.offerPrice = Number(offerPrice);
        coupon.minimumPrice = Number(minimumPrice);
        coupon.discountType = discountType;
        coupon.expireOn = new Date(expireOn);
        coupon.usageLimit = Number(usageLimit) || 0;

        await coupon.save();
        
        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully'
        });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update coupon'
        });
    }
};

const toggleCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const { status } = req.body;

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

        if (status && coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has reached its usage limit and cannot be enabled'
            });
        }

        coupon.isList = Boolean(status);
        await coupon.save();
        
        res.status(200).json({
            success: true,
            message: `Coupon ${status ? 'enabled' : 'disabled'} successfully`
        });
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update coupon status'
        });
    }
};

const incrementCouponUsage = async (couponId) => {
    try {
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return { success: false, message: 'Coupon not found' };
        }

        coupon.usageCount += 1;
        
        if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
            coupon.isList = false;
        }
        
        await coupon.save();
        return { success: true };
    } catch (error) {
        console.error('Error incrementing coupon usage:', error);
        return { success: false, message: error.message || 'Failed to update coupon usage' };
    }
};

const getCouponById = async (req, res) => {
    try {
        const { couponId } = req.params;
        
        const coupon = await Coupon.findById(couponId)
            .populate({
                path: 'userId',
                select: 'firstname lastname email phNumber',
                model: 'User'
            });
            
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }
        
        res.status(200).json(coupon);
    } catch (error) {
        console.error('Error fetching coupon details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch coupon details'
        });
    }
};

module.exports = {
    getCoupon,
    addCoupon,
    editCoupon,
    toggleCoupon,
    getCouponById,
    incrementCouponUsage,
};