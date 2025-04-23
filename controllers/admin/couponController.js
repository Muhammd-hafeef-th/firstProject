const Coupon = require('../../models/couponSchema');

const getCoupon = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdOn: -1 });
        res.render('coupons', { coupons });
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
        const { name, offerPrice, minimumPrice, expireOn } = req.body;

        if (!name || !offerPrice || !minimumPrice || !expireOn) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (Number(offerPrice) >= Number(minimumPrice)) {
            return res.status(400).json({
                success: false,
                message: 'Discount amount must be less than minimum purchase amount'
            });
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
            offerPrice: Number(offerPrice),
            minimumPrice: Number(minimumPrice),
            expireOn: new Date(expireOn),
            createdOn: new Date(),
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
        const { couponId, name, offerPrice, minimumPrice, expireOn } = req.body;

        if (!couponId || !name || !offerPrice || !minimumPrice || !expireOn) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (Number(offerPrice) >= Number(minimumPrice)) {
            return res.status(400).json({
                success: false,
                message: 'Discount amount must be less than minimum purchase amount'
            });
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
        coupon.offerPrice = Number(offerPrice);
        coupon.minimumPrice = Number(minimumPrice);
        coupon.expireOn = new Date(expireOn);

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

const getCouponById = async (req, res) => {
    try {
        const { couponId } = req.params;
        
        const coupon = await Coupon.findById(couponId);
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
    getCouponById
};