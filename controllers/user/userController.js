const User = require('../../models/userSchema');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema')
const Brand = require("../../models/brandSchema");
const { trace } = require('../../routes/userRouter');
const multer = require("multer");
const Coupon = require('../../models/couponSchema');
const Order =require('../../models/orderSchema')




const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/profile-image/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const loadHomepage = async (req, res, next) => {
    try {
        let gentsMatch = /gents/i;
        let productsData = await Product.find({ quantity: { $gt: 0 }, isListed: true }).populate('brand')
        let featuredData = await Product.find({ isFeatured: true, isListed: true, quantity: { $gt: 0 } }).populate('brand')
        let newArrivalsData = await Product.find({ isNew: true, isListed: true, quantity: { $gt: 0 } }).populate('brand')
        let storyImage = await Product.find({ category: gentsMatch, isListed: true, isNew: true, quantity: { $gt: 0 } }).skip(2).limit(1);
        const brandData = await Brand.find({ isListed: true })


        productsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        productsData = productsData.slice(0, 3)

        featuredData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        featuredData = featuredData.slice(0, 3);

        newArrivalsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        newArrivalsData = newArrivalsData.slice(0, 4);

        const processProducts = (products) => {
            return products.map(product => {
                const brandOffer = product.brand?.brandOffer || 0;
                const productOffer = product.discount || 0;

                const newOffer = Math.max(productOffer, brandOffer);
                const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

                return {
                    ...product._doc,
                    newOffer,
                    salesPrice
                };
            });
        };

        const productsWithPrices = processProducts(productsData);
        const featuredWithPrices = processProducts(featuredData);
        const newArrivalsWithPrices = processProducts(newArrivalsData);

        let userData = null;
        if (req.session.user) {
            const user = await User.findOne({ _id: req.session.user });
            if (user) {
                if (user.isBlocked) {
                    req.session.destroy((err) => {
                        if (err) {
                            console.error('Session destroy error:', err);
                            return next(err);
                        }
                        return res.render('home', {
                            user: null,
                            products: productsWithPrices,
                            featured: featuredWithPrices,
                            newArrival: newArrivalsWithPrices,
                            brands: brandData,
                            storyImage: storyImage[0],
                            messages: "User blocked by admin"
                        });
                    });
                    return;
                }
                userData = user;
            }
        }

        res.render('home', {
            user: userData,
            products: productsWithPrices,
            featured: featuredWithPrices,
            newArrival: newArrivalsWithPrices,
            brands: brandData,
            storyImage: storyImage[0],
            messages: ''
        });

    } catch (error) {
        error.message = "Server error " + error.message;
        next(error);
    }
};

const pageNotFound = async (req, res, next) => {
    try {
        res.render('page-404');
    } catch (error) {
        next(error);
    }
};

const loadSignup = async (req, res, next) => {
    try {
        if (req.session.user) {
            return res.redirect('/');
        }
        res.render('register');
    } catch (error) {
        error.message = "Server error" + error.message;
        next(error);
    }
};


function generateOtp() {
    const digits = '1234567890';
    let otp = '';
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "You OTP for Singup your email",
            text: `You OTP is${otp}`,
            html: `<b><h4>Your OTP:${otp}</h4><br></b>`
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Email Send:', info.messageId);
        return true;

    } catch (error) {
        console.error('Error sending email', error)
        return false;
    }
}


const signup = async (req, res, next) => {
    try {
        const { firstname, email, password, confirmPassword, referralCode } = req.body;

        if (password !== confirmPassword) {
            return res.render('register', { message: 'Passwords do not match' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('register', { message: 'User with this email already exists' });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json({ success: false, message: 'Error sending email' });
        }
        console.log("Otp is:", otp)
        req.session.userOtp = otp;
        req.session.userData = { firstname, email, password, referralCode };

        res.render('verify-otp');
    } catch (error) {
        next(error);
    }
};

const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error('Error hashing password', error);
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const hashedPassword = await securePassword(user.password);

            const referralController = require('./referralController');
            const newReferralCode = referralController.generateReferralCode(user.firstname);

            const newUser = new User({
                firstname: user.firstname,
                email: user.email,
                password: hashedPassword,
                referalCode: newReferralCode,
                redeemed: false,
                redeemedUsers: []
            });

            const savedUser = await newUser.save();

            if (user.referralCode && user.referralCode.trim() !== '') {
                const referrer = await User.findOne({ referalCode: user.referralCode });

                if (referrer) {
                    await referralController.addReferralBonus(
                        referrer._id,
                        100,
                        `Referral bonus for inviting ${savedUser.firstname}`
                    );

                    await referralController.addReferralBonus(
                        savedUser._id,
                        50,
                        'Welcome bonus for using a referral code'
                    );

                    await User.findByIdAndUpdate(
                        referrer._id,
                        { $push: { redeemedUsers: savedUser._id } }
                    );
                }
            }

            res.json({ success: true, redirectUrl: "/login" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        error.message = 'An error occurred' + error.message;
        next(error);
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resent OTP:", otp);
            res.status(200).json({ success: true, message: "OTP resent successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, message: "Internal server error. Please try again" });
    }
};

const loadLogin = async (req, res, next) => {
    try {
        if (req.session.user) {
            return res.redirect('/profile');
        }
        res.render('login');
    } catch (error) {
        next(error);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render("login", { 
                message: "Email and Password are required",
                email: email || '' 
            });
        }

        const user = await User.findOne({ isAdmin: 0, email });
        if (!user) {
            return res.render("login", { 
                message: "User not found",
                email 
            });
        }

        if (user.isBlocked) {
            return res.render("login", { 
                message: "User is blocked by admin",
                email 
            });
        }

        if (!user.password) {
            return res.render("login", { 
                message: "Password not set. Please login using Google or reset your password.",
                email 
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.render("login", { 
                message: "Incorrect Password",
                email 
            });
        }

        req.session.user = user._id;
        res.redirect("/");
    } catch (error) {
        console.error("Login error", error);
        res.render("login", { 
            message: "Login failed. Please try again",
            email: req.body.email || '' 
        });
    }
};
const logout = async (req, res, next) => {
    try {
        delete req.session.user;
        res.redirect("/login");
    } catch (error) {
        next(error);
    }
};





const featuredProducts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        let baseQuery = {
            quantity: { $gt: 0 },
            isFeatured: true,
            isListed: true
        };
        let featuredData = await Product.find(baseQuery)
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec();

        const featuredWithPrices = await Promise.all(featuredData.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalProducts / limit);
        res.render("featured-products", {
            featured: featuredWithPrices,
            currentPage: page,
            totalPages: totalPages,
            query: req.query
        });
    } catch (error) {
        next(error);
    }
};
const products = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 16;
        const skip = (page - 1) * limit;
        const { search, category, brand, sort, priceFrom, priceTo } = req.query;
        const query = {
            quantity: { $gt: 0 },
            isListed: true
        };

        if (search) {
            query.productName = { $regex: search, $options: "i" };
        }
        if (category) {
            query.category = category;
        }
        if (brand) {
            const brandDoc = await Brand.findOne({
                brandName: brand
            });
            if (brandDoc) {
                query.brand = brandDoc._id;
            }

        }
        if (priceFrom || priceTo) {
            query.regularPrice = {};
            if (priceFrom) query.regularPrice.$gte = Number(priceFrom);
            if (priceTo) query.regularPrice.$lte = Number(priceTo);
        }
        let sortOption = {};
        switch (sort) {
            case 'ZtoA': sortOption = { productName: -1 }; break;
            case 'highToLow': sortOption = { regularPrice: -1 }; break;
            case 'lowToHigh': sortOption = { regularPrice: 1 }; break;
            default: sortOption = { productName: 1 };
        }
        const productsData = await Product.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec();

        const productsWithPrices = await Promise.all(productsData.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const brands = await Brand.find({ isListed: true });
        const filters = new URLSearchParams(req.query).toString().replace(/page=\d+&?/, '');

        res.render("products", {
            products: productsWithPrices,
            brands,
            currentPage: page,
            totalPages,
            searchQuery: search,
            query: req.query,
            filters: filters.replace(/^&|&$/g, '')
        });
    } catch (error) {
        next(error);
    }
};
const newArrivals = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        let baseQuery = {
            isNew: true,
            isListed: true
        };

        let newArrivalData = await Product.find(baseQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec();

        const newArrivalsWithPrices = await Promise.all(newArrivalData.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("new-arrivals", {
            newArrivals: newArrivalsWithPrices,
            currentPage: page,
            totalPages: totalPages,
            query: req.query
        });
    } catch (error) {
        next(error);
    }
};

const mensWatch = async (req, res, next) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        let brands = await Brand.find({ isListed: true })
        let gentsMatch = /gents/i;

        let mensWatch = await Product.find({ category: gentsMatch, isListed: true })
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec()

        const mensWatchWithPrices = await Promise.all(mensWatch.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments({ category: gentsMatch });
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("mens-watch", {
            gents: mensWatchWithPrices,
            brands: brands,
            currentPage: page,
            totalPages: totalPages,
            query: req.query,
            selectedBrand: ""
        })
    } catch (error) {
        next(error);
    }
}
const ladiesWatch = async (req, res, next) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        const brands = await Brand.find({ isListed: true });
        const ladiesMatch = /ladies/i;
        const ladiesProducts = await Product.find({ category: ladiesMatch, isListed: true })
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec()

        const ladiesWithPrices = await Promise.all(ladiesProducts.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments({ category: ladiesMatch });
        const totalPages = Math.ceil(totalProducts / limit);


        res.render("ladies-watch", {
            ladies: ladiesWithPrices,
            brands: brands,
            query: req.query,
            selectedBrand: '',
            currentPage: page,
            totalPages: totalPages,
        });
    } catch (error) {
        next(error);
    }
};
const couplesWatch = async (req, res, next) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        let brands = await Brand.find({ isListed: true })
        let couplesMatch = /couples/i;
        let couplesWatch = await Product.find({ category: couplesMatch, isListed: true })
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec()

        const couplesWithPrices = await Promise.all(couplesWatch.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments({ category: couplesMatch });
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("couples-watch", {
            couples: couplesWithPrices,
            brands: brands,
            query: req.query,
            selectedBrand: "",
            currentPage: page,
            totalPages: totalPages,
        })
    } catch (error) {
        next(error);
    }
}

const productDetails = async (req, res, next) => {
    try {
        let productId = req.query.id;
        let productDe = await Product.findById(productId);
        
        // Check if product exists
        if (!productDe) {
            return res.redirect('/products?error=Product not available');
        }
        
        // Check if product is unlisted
        if (!productDe.isListed) {
            return res.redirect('/products?error=This product is not available');
        }
        
        let brandId = productDe.brand;
        let brand = await Brand.findOne({ _id: brandId });
        
        // Check if brand is unlisted
        if (!brand || !brand.isListed) {
            return res.redirect('/products?error=This product is not available');
        }

        let brandOffer = brand?.brandOffer || 0;
        let productOffer = productDe.discount

        let newOffer = productOffer;

        if (productOffer < brandOffer) {
            newOffer = brandOffer;
        }

        let salesPrice = Math.round(productDe.regularPrice * (1 - newOffer / 100));

        let avgRating = 0;
        if (productDe.review.length > 0) {
            let total = productDe.review.reduce((sum, review) => sum + review.rating, 0);
            avgRating = total / productDe.review.length;
        }

        res.render("product-details", { productDet: productDe, avgRating, brand, newOffer, salesPrice });
    } catch (error) {
        next(error);
    }
};

const addReview = async (req, res, next) => {
    try {
        const { productId, username, rating, comment } = req.body;

        await Product.findByIdAndUpdate(
            productId,
            {
                $push: {
                    review: {
                        username,
                        rating: parseInt(rating),
                        Comment: comment,
                    },
                },
            },
            { new: true }
        );

        res.redirect(`/productDetails?id=${productId}`);
    } catch (error) {
        next(error);
    }
};

const filterProduct = async (req, res, next) => {
    try {
        const brandsdetails = await Brand.find({ isListed: true });
        const { category, brands, sortByPrice, priceTo, priceFrom } = req.body;

        const filter = { isListed: true };

        if (category) {
            filter.category = category;
        }

        if (brands) {
            const brandDoc = await Brand.findOne({
                brandName: brands
            });
            if (brandDoc) {
                filter.brand = brandDoc._id;
            }

        }

        if (priceTo || priceFrom) {
            filter.regularPrice = {};
            if (priceFrom) filter.regularPrice.$gte = parseInt(priceFrom);
            if (priceTo) filter.regularPrice.$lte = parseInt(priceTo);
        }

        let sortOption = {};
        if (sortByPrice === "AtoZ") {
            sortOption.productName = 1;
        } else if (sortByPrice === "ZtoA") {
            sortOption.productName = -1;
        } else if (sortByPrice === "highToLow") {
            sortOption.regularPrice = -1;
        } else if (sortByPrice === "lowToHigh") {
            sortOption.regularPrice = 1;
        }

        const products = await Product.find(filter).sort(sortOption);
        return res.render("products", { products: products, brands: brandsdetails });
    } catch (error) {
        error.message = "Error in filterProduct: " + error.message;
        next(error);
    }
};

const ladiesBrandFilter = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        const { brands: selectedBrand } = req.body;
        const filter = { category: /ladies/i, isListed: true };

        const brand = await Brand.findOne({ brandName: selectedBrand });

        if (selectedBrand) {
            filter.brand = brand._id
        }

        const brands = await Brand.find({ isListed: true });
        const filteredProducts = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec();

        const productsWithPrices = await Promise.all(filteredProducts.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("ladies-watch", {
            ladies: productsWithPrices,
            brands: brands,
            selectedBrand: selectedBrand,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        next(error);
    }
};
const gentsBrandFilter = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        const { brands: selectedBrand } = req.body;
        const filter = { category: /gents/i, isListed: true };

        const brand = await Brand.findOne({ brandName: selectedBrand });


        if (selectedBrand) {
            filter.brand = brand._id;
        }
        const brands = await Brand.find({ isListed: true });

        const filteredProducts = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec();

        const productsWithPrices = await Promise.all(filteredProducts.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("mens-watch", {
            gents: productsWithPrices,
            brands: brands,
            selectedBrand: selectedBrand,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        next(error);
    }
};
const couplesBrandFilter = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        const { brands: selectedBrand } = req.body;
        const filter = { category: /couples/i, isListed: true };
        const brand = await Brand.findOne({ brandName: selectedBrand });
        if (selectedBrand) {
            filter.brand = brand._id
        }
        const brands = await Brand.find({ isListed: true });
        const filteredProducts = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .populate('brand')
            .exec();

        const productsWithPrices = await Promise.all(filteredProducts.map(async (product) => {
            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("couples-watch", {
            couples: productsWithPrices,
            brands: brands,
            selectedBrand: selectedBrand,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        next(error);
    }
};



const brandButton = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        const selectedCategory = req.query.category || "";

        const brandId = req.query.id;
        if (!brandId) {
            return res.redirect("/pageNotFound");
        }
        const brand = await Brand.findOne({ _id: brandId });
        if (!brand) {
            return res.redirect("/pageNotFound");
        }

        let query = { brand: brand._id, isListed: true };

        if (selectedCategory) {
            query.category = selectedCategory;
        }

        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .exec();

        const productsWithPrices = await Promise.all(products.map(async (product) => {
            const brandOffer = brand?.brandOffer || 0;
            const productOffer = product.discount || 0;

            const newOffer = Math.max(productOffer, brandOffer);
            const salesPrice = Math.round(product.regularPrice * (1 - newOffer / 100));

            return {
                ...product._doc,
                newOffer,
                salesPrice
            };
        }));

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const brandItem = await Brand.find({});

        res.render("brands-details", {
            products: productsWithPrices,
            brands: brand,
            brandItems: brandItem,
            selectedCategory: selectedCategory,
            currentPage: page,
            totalPages: totalPages
        });

    } catch (error) {
        next(error);
    }
}

const profile = async (req, res, next) => {
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
        res.render("profile", { userDatas: userData })
    } catch (error) {
        next(error);
    }
}
const profileEdit = async (req, res, next) => {
    try {
        let google = req.session.user._id;
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({
                $or: [
                    { _id: req.session.user._id },
                    { _id: req.session.user }
                ]
            });
        }
        res.render('profile-edit', { userDatas: userData, google })
    } catch (error) {
        next(error);
    }
}
const sendVerifyEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "You OTP for password reset",
            text: `You OTP is${otp}`,
            html: `<b><h4>Your OTP:${otp}</h4><br></b>`
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Email Send:', info.messageId);
        return true;

    } catch (error) {
        console.error('Error sending email', error)
        return false;
    }
}
const profileUpdate = async (req, res, next) => {
    try {
        const user = await User.findOne({
            $or: [
                { _id: req.session.user._id },
                { _id: req.session.user }
            ]
        });
        const oldEmail = user.email;
        const newEmail = req.body.email;

        const updates = {
            firstname: req.body.username,
            phNumber: req.body.phone,
            gender: req.body.gender
        };

        if (req.file) {
            updates.userImage = `/uploads/profile-image/${req.file.filename}`;
        }

        if (oldEmail !== newEmail) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter a valid email address'
                });
            }

            const emailExists = await User.findOne({ email: newEmail });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use by another account'
                });
            }

            const otp = generateOtp();
            const emailSent = await sendVerifyEmail(newEmail, otp);

            if (emailSent) {
                req.session.profileUpdate = {
                    otp: otp,
                    newEmail: newEmail,
                    updates: updates,
                    oldEmail: oldEmail,
                    expiresAt: Date.now() + 1 * 60 * 1000
                };

                console.log(`OTP sent to ${newEmail}: ${otp}`);
                return res.json({
                    success: true,
                    requiresOtp: true,
                    message: 'OTP sent to your new email address for verification',
                    expiresIn: 1 * 60
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send verification email. Please try again.'
                });
            }
        }

        await User.findOneAndUpdate(user, updates);
        return res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Profile update error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating your profile'
        });
    }
};

const verifyProfileUpdateOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;

        const user = await User.findOne({
            $or: [
                { _id: req.session.user._id },
                { _id: req.session.user }
            ]
        });

        if (!req.session.profileUpdate) {
            return res.status(400).json({
                success: false,
                message: 'OTP session expired. Please try updating your email again.'
            });
        }

        if (Date.now() > req.session.profileUpdate.expiresAt) {
            delete req.session.profileUpdate;
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        if (otp !== req.session.profileUpdate.otp) {


            return res.status(400).json({
                success: false,
                message: `Incorrect OTP. `
            });
        }

        const { updates, newEmail } = req.session.profileUpdate;
        updates.email = newEmail;

        updates.emailVerified = false;
        await User.findOneAndUpdate(user, updates);

        delete req.session.profileUpdate;

        return res.json({
            success: true,
            message: 'Email changed and profile updated successfully. Please verify your new email address.'
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during OTP verification'
        });
    }
};

const resendProfileUpdateOtp = async (req, res, next) => {
    try {
        if (!req.session.profileUpdate) {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please try updating your email again.'
            });
        }

        const { newEmail } = req.session.profileUpdate;

        const newOtp = generateOtp();
        const emailSent = await sendVerifyEmail(newEmail, newOtp);

        if (emailSent) {
            req.session.profileUpdate.otp = newOtp;
            req.session.profileUpdate.expiresAt = Date.now() + 1 * 60 * 1000;

            console.log(`New OTP sent to ${newEmail}: ${newOtp}`);
            return res.json({
                success: true,
                message: 'New OTP sent to your email address',
                expiresIn: 1 * 60
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Failed to resend OTP. Please try again.'
            });
        }

    } catch (error) {
        console.error('Resend OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while resending OTP'
        });
    }
};
const changePassword = async (req, res, next) => {
    try {
        let email = req.query.email
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        res.render("userChange-password", { userDatas: userData, email })
    } catch (error) {
        next(error);
    }
}
const profileEmailOtp = async (req, res, next) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerifyEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render('profileOtpVerify', { userDatas: userData })
                console.log("Otp:", otp)
            } else {
                res.json({ success: false, message: "Failed to send Otp.Plese try again" });
            }
        }
        else {
            res.redirect('/change-password')
        }
    } catch (error) {
        next(error);
    }
}

function generateOtp() {
    const digits = '1234567890';
    let otp = '';
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp
}

const verifyProfileOtp = async (req, res, next) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: "/profileNewPassword" });
        } else {
            res.json({ success: false, message: "Otp is not matching" })
        }
    } catch (error) {
        error.message = 'An error occured.Please try again ' + error.message;
        next(error);
    }
}
const profileNewPassword = async (req, res, next) => {
    try {
        let userData = null;
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id });
        }
        res.render('profileNewPassword', { userDatas: userData });
    } catch (error) {
        next(error);
    }
};
const resendProfileOtp = async (req, res, next) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("resending otp to email:", email);
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("resend otp is:", otp);
            res.status(200).json({ success: true, message: "Resend OTP successful" });
        }
    } catch (error) {
        error.message = 'Error in resend otp: ' + error.message;
        next(error);
    }
};

const profilePasswordSaving = async (req, res, next) => {
    try {
        const email = req.session.email;
        const { password, confirmPassword } = req.body;
        if (password === confirmPassword) {
            const passwordHash = await securePassword(password);
            await User.updateOne({ email: email }, { $set: { password: passwordHash } });
            res.redirect('/profile-edit');
        } else {
            res.render("profileNewPassword", { message: 'Passwords do not match' });
        }
    } catch (error) {
        next(error);
    }
}



const cart = async (req, res, next) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        if (!userId) return res.redirect('/login');

        const cartData = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                model: 'Product',
                populate: {
                    path: 'brand',
                    model: 'Brand'
                },
                match: {
                    $and: [
                        { status: { $ne: "Discontinued" } },
                    ]
                }
            })
            .lean();

        const validItems = cartData?.items?.filter(item => item.productId) || [];
        const itemsWithStatusInfo = validItems.map(item => {
            return {
                ...item,
                isOutOfStock: item.quantity > item.productId.quantity,
                isUnlisted: !item.productId.isListed,
                availableQuantity: item.productId.quantity
            };
        });

        let cartItems = {
            items: itemsWithStatusInfo,
            subtotal: 0,
            discountAmount: 0,
            shippingCharge: 0,
            total: 0,
            hasOutOfStockItems: false,
            hasUnlistedItems: false
        };

        if (itemsWithStatusInfo.length > 0) {
            cartItems = itemsWithStatusInfo.reduce((acc, item) => {
                const product = item.productId;
                const quantity = item.quantity;

                if (!product) return acc;

                if (product.isListed && product.status !== "Discontinued") {
                    const itemPrice = product.regularPrice * quantity;
                    const brandOffer = product.brand?.brandOffer || 0;
                    const productOffer = product.discount || 0;

                    const effectiveDiscount = Math.max(brandOffer, productOffer);
                    const itemSavings = itemPrice * (effectiveDiscount / 100);

                    acc.subtotal += itemPrice;
                    acc.discountAmount += itemSavings;
                }

                if (item.isOutOfStock) {
                    acc.hasOutOfStockItems = true;
                }

                if (item.isUnlisted) {
                    acc.hasUnlistedItems = true;
                }

                acc.items.push(item);
                return acc;
            }, {
                items: [],
                subtotal: 0,
                discountAmount: 0,
                shippingCharge: 0,
                total: 0,
                hasOutOfStockItems: false,
                hasUnlistedItems: false
            });
            
            const discountedSubtotal = cartItems.subtotal - cartItems.discountAmount;
            if (discountedSubtotal < 3000) {
                cartItems.shippingCharge = 40;
            } else {
                cartItems.shippingCharge = 0;
            }
            
            cartItems.total = discountedSubtotal + cartItems.shippingCharge;
        }

        const currentDate = new Date();

        let applicableCoupons = [];
        if (cartItems.subtotal > 0) {
            const usedCoupons = await Order.distinct('couponApplied', { userId });
            
            applicableCoupons = await Coupon.find({
                minimumPrice: { $lte: cartItems.subtotal },
                expireOn: { $gt: currentDate },
                isList: true,
                $or: [
                    { usageLimit: 0 },
                    { $expr: { $lt: ["$usageCount", "$usageLimit"] } }
                ],
                _id: { $nin: usedCoupons },
                userId: { $ne: userId }
            }).sort({ offerPrice: -1 }).limit(5);
        }

        const appliedCoupon = req.session.appliedCoupon || null;
        let couponDiscount = 0;

        if (appliedCoupon && !cartItems.hasOutOfStockItems && !cartItems.hasUnlistedItems) {
            const isValidCoupon = applicableCoupons.some(c => {
                if (!appliedCoupon?.id && !c?._id) return false;
                return c._id.toString() === appliedCoupon.id.toString();
            });
            
            if (isValidCoupon) {
                if (appliedCoupon.discountType === 'percentage') {
                    couponDiscount = Math.min(
                        (cartItems.subtotal * appliedCoupon.offerPrice) / 100,
                        appliedCoupon.maxDiscount || Infinity
                    );
                } else {
                    couponDiscount = Math.min(
                        appliedCoupon.offerPrice,
                        cartItems.subtotal - cartItems.discountAmount
                    );
                }
                cartItems.couponDiscount = couponDiscount;
                
                const discountedSubtotal = cartItems.subtotal - cartItems.discountAmount - couponDiscount;
                
                
                cartItems.total = Math.max(0, discountedSubtotal + cartItems.shippingCharge);
            } else {
                req.session.appliedCoupon = null;
            }
        }

        res.render('addToCart', {
            cartItems,
            regularPriceTotal: cartItems.subtotal,
            discountedPriceTotal: cartItems.total,
            shippingCharge: cartItems.shippingCharge,
            applicableCoupons,
            appliedCoupon: appliedCoupon ? {
                code: appliedCoupon.name,
                discountType: appliedCoupon.discountType,
                offerPrice: appliedCoupon.offerPrice
            } : null,
            couponDiscount,
            messages: {
                hasUnlistedItems: cartItems.hasUnlistedItems,
                hasOutOfStockItems: cartItems.hasOutOfStockItems
            }
        });
    } catch (error) {
        error.message = "Error in cart controller: " + error.message;
        next(error);
    }
};

const deleteCartProduct = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        const { id: itemId } = req.query;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to continue' });
        }

        if (!itemId) {
            return res.status(400).json({ success: false, message: 'Item ID is required' });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'brand',
                model: 'Brand'
            },
            match: { status: { $ne: "Discontinued" } }
        });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        cart.items = cart.items.filter(item => item._id.toString() !== itemId);

        let couponInvalid = false;
        if (req.session.appliedCoupon) {
            const cartSubtotal = cart.items.reduce((acc, item) => {
                if (item.productId) {
                    return acc + item.productId.regularPrice * item.quantity;
                }
                return acc;
            }, 0);

            if (cartSubtotal < req.session.appliedCoupon.minimumPrice) {
                couponInvalid = true;
                delete req.session.appliedCoupon;
            }
        }

        await cart.save();

        const validItems = cart.items.filter(item => item.productId !== null);
        const itemsWithStatusInfo = validItems.map(item => ({
            ...item.toObject(),
            isOutOfStock: item.quantity > item.productId.quantity,
            isUnlisted: !item.productId.isListed
        }));

        const hasOutOfStockItems = itemsWithStatusInfo.some(item => item.isOutOfStock);
        const hasUnlistedItems = itemsWithStatusInfo.some(item => item.isUnlisted);

        const calculations = validItems.reduce((acc, item) => {
            const product = item.productId;
            const quantity = item.quantity;
            const itemPrice = product.regularPrice * quantity;

            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;
            const effectiveDiscount = Math.max(brandOffer, productOffer);
            const itemSavings = itemPrice * (effectiveDiscount / 100);

            acc.subtotal += itemPrice;
            acc.discountAmount += itemSavings;
            return acc;
        }, { subtotal: 0, discountAmount: 0 });

        let total = calculations.subtotal - calculations.discountAmount;
        let shippingCharge = total < 3000 ? 40 : 0;
        total += shippingCharge;

        let couponDiscount = 0;
        const appliedCoupon = req.session.appliedCoupon || null;

        let applicableCoupons = [];
        if (calculations.subtotal > 0) {
            const usedCoupons = await Order.distinct('couponApplied', { userId });
            applicableCoupons = await Coupon.find({
                minimumPrice: { $lte: calculations.subtotal },
                expireOn: { $gt: new Date() },
                isList: true,
                $or: [
                    { usageLimit: 0 },
                    { $expr: { $lt: ["$usageCount", "$usageLimit"] } }
                ],
                _id: { $nin: usedCoupons },
                userId: { $ne: userId }
            }).sort({ offerPrice: -1 }).limit(5).lean();
        }

        if (appliedCoupon && !couponInvalid) {
            couponDiscount = appliedCoupon.discountType === 'percentage'
                ? Math.min(
                    (calculations.subtotal * appliedCoupon.offerPrice) / 100,
                    appliedCoupon.maxDiscount || Infinity
                )
                : Math.min(
                    appliedCoupon.offerPrice,
                    calculations.subtotal - calculations.discountAmount
                );

            total = calculations.subtotal - calculations.discountAmount - couponDiscount + shippingCharge;
        }

        const message = couponInvalid
            ? 'Item removed successfully. Coupon removed as cart no longer meets requirements.'
            : 'Item removed successfully';

        return res.status(200).json({
            success: true,
            message,
            cartSummary: {
                subtotal: parseFloat(calculations.subtotal.toFixed(2)),
                discountAmount: parseFloat(calculations.discountAmount.toFixed(2)),
                shippingCharge: parseFloat(shippingCharge.toFixed(2)),
                couponDiscount: parseFloat(couponDiscount.toFixed(2)),
                total: parseFloat(total.toFixed(2))
            },
            itemCount: validItems.length,
            hasOutOfStockItems,
            hasUnlistedItems,
            appliedCoupon: appliedCoupon && !couponInvalid ? {
                code: appliedCoupon.name,
                discountType: appliedCoupon.discountType,
                offerPrice: appliedCoupon.offerPrice
            } : null,
            applicableCoupons
        });
    } catch (error) {
        console.error("Delete Cart Product Error:", error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while removing the item',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to continue' });
        }

        const { itemIds, quantities } = req.body;

        if (!itemIds || !quantities || !Array.isArray(itemIds) || !Array.isArray(quantities) || itemIds.length !== quantities.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data'
            });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'brand',
                model: 'Brand'
            },
            match: { status: { $ne: "Discontinued" } }
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        cart.items = cart.items.filter(item => item.productId !== null);

        const MAX_QUANTITY = 10;
        const MIN_QUANTITY = 1;
        const errors = [];
        const originalQuantities = {};

        itemIds.forEach((itemId) => {
            const cartItem = cart.items.find(item => item._id.toString() === itemId);
            if (cartItem) {
                originalQuantities[itemId] = cartItem.quantity;
            }
        });

        await Promise.all(itemIds.map(async (itemId, index) => {
            const quantity = parseInt(quantities[index], 10);
            const cartItem = cart.items.find(item => item._id.toString() === itemId);

            if (!cartItem || isNaN(quantity) || quantity < MIN_QUANTITY) {
                errors.push(`Invalid quantity for item ${itemId}`);
                return;
            }

            const product = cartItem.productId;
            if (!product) {
                errors.push(`Product not available for item ${itemId}`);
                return;
            }

            if (quantity > product.quantity) {
                errors.push(`Only ${product.quantity} available for ${product.productName}`);
                return;
            }

            if (quantity > MAX_QUANTITY) {
                errors.push(`Maximum ${MAX_QUANTITY} allowed for ${product.productName}`);
                return;
            }

            cartItem.quantity = quantity;
            cartItem.totalPrice = quantity * product.regularPrice;
        }));

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: errors.join('. '),
                originalQuantity: originalQuantities[itemIds[0]]
            });
        }

        await cart.save();

        const validItems = cart.items.filter(item => item.productId !== null);
        const itemsWithStatusInfo = validItems.map(item => ({
            ...item.toObject(),
            isOutOfStock: item.quantity > item.productId.quantity,
            isUnlisted: !item.productId.isListed
        }));

        const hasOutOfStockItems = itemsWithStatusInfo.some(item => item.isOutOfStock);
        const hasUnlistedItems = itemsWithStatusInfo.some(item => item.isUnlisted);

        const calculations = validItems.reduce((acc, item) => {
            const product = item.productId;
            const quantity = item.quantity;
            const itemPrice = product.regularPrice * quantity;

            const brandOffer = product.brand?.brandOffer || 0;
            const productOffer = product.discount || 0;
            const effectiveDiscount = Math.max(brandOffer, productOffer);
            const itemSavings = itemPrice * (effectiveDiscount / 100);

            acc.subtotal += itemPrice;
            acc.discountAmount += itemSavings;
            return acc;
        }, { subtotal: 0, discountAmount: 0 });

        let total = calculations.subtotal - calculations.discountAmount;
        let shippingCharge = total < 3000 ? 40 : 0;
        total += shippingCharge;

        let couponDiscount = 0;
        const appliedCoupon = req.session.appliedCoupon || null;

        let applicableCoupons = [];
        if (calculations.subtotal > 0) {
            const usedCoupons = await Order.distinct('couponApplied', { userId });
            applicableCoupons = await Coupon.find({
                minimumPrice: { $lte: calculations.subtotal },
                expireOn: { $gt: new Date() },
                isList: true,
                $or: [
                    { usageLimit: 0 },
                    { $expr: { $lt: ["$usageCount", "$usageLimit"] } }
                ],
                _id: { $nin: usedCoupons },
                userId: { $ne: userId }
            }).sort({ offerPrice: -1 }).limit(5).lean();
        }

        if (appliedCoupon) {
            if (calculations.subtotal < appliedCoupon.minimumPrice || hasOutOfStockItems || hasUnlistedItems) {
                delete req.session.appliedCoupon;
                return res.status(200).json({
                    success: true,
                    message: 'Cart updated successfully. Coupon removed as cart no longer meets requirements.',
                    cartSummary: {
                        subtotal: parseFloat(calculations.subtotal.toFixed(2)),
                        discountAmount: parseFloat(calculations.discountAmount.toFixed(2)),
                        shippingCharge: parseFloat(shippingCharge.toFixed(2)),
                        total: parseFloat(total.toFixed(2))
                    },
                    itemCount: validItems.length,
                    hasOutOfStockItems,
                    hasUnlistedItems,
                    appliedCoupon: null,
                    applicableCoupons
                });
            }

            couponDiscount = appliedCoupon.discountType === 'percentage'
                ? Math.min(
                    (calculations.subtotal * appliedCoupon.offerPrice) / 100,
                    appliedCoupon.maxDiscount || Infinity
                )
                : Math.min(
                    appliedCoupon.offerPrice,
                    calculations.subtotal - calculations.discountAmount
                );

            total = calculations.subtotal - calculations.discountAmount - couponDiscount + shippingCharge;
        }

        const cartCount = validItems.reduce((sum, item) => sum + item.quantity, 0);
        req.session.cartCount = cartCount;

        return res.status(200).json({
            success: true,
            message: 'Cart updated successfully',
            cartSummary: {
                subtotal: parseFloat(calculations.subtotal.toFixed(2)),
                discountAmount: parseFloat(calculations.discountAmount.toFixed(2)),
                shippingCharge: parseFloat(shippingCharge.toFixed(2)),
                couponDiscount: parseFloat(couponDiscount.toFixed(2)),
                total: parseFloat(total.toFixed(2))
            },
            itemCount: validItems.length,
            hasOutOfStockItems,
            hasUnlistedItems,
            appliedCoupon: appliedCoupon ? {
                code: appliedCoupon.name,
                discountType: appliedCoupon.discountType,
                offerPrice: appliedCoupon.offerPrice
            } : null,
            applicableCoupons
        });
    } catch (error) {
        console.error("Update Cart Error:", error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the cart',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const addToCartAPI = async (req, res) => {
    try {
        const productId = req.body.productId;
        const requestedQuantity = parseInt(req.body.quantity) || 1;
        const userId = req.session.user?._id || req.session.user;
        const MAX_QUANTITY_PER_PRODUCT = 10;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (!product.isListed) {
            return res.status(400).json({ success: false, message: 'This product is currently unavailable' });
        }

        if (product.status === "Discontinued") {
            return res.status(400).json({ success: false, message: 'This product has been discontinued' });
        }

        if (requestedQuantity > MAX_QUANTITY_PER_PRODUCT) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${MAX_QUANTITY_PER_PRODUCT} items allowed per product`
            });
        }

        let cart = await Cart.findOne({ userId }) || new Cart({ userId, items: [] });

        const existingItemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId
        );

        if (existingItemIndex >= 0) {
            const newTotalQuantity = cart.items[existingItemIndex].quantity + requestedQuantity;

            if (newTotalQuantity > product.quantity) {
                return res.status(400).json({ success: false, message: 'Not enough stock available' });
            }

            if (newTotalQuantity > MAX_QUANTITY_PER_PRODUCT) {
                return res.status(400).json({
                    success: false,
                    message: `Maximum ${MAX_QUANTITY_PER_PRODUCT} items allowed per product`
                });
            }

            cart.items[existingItemIndex].quantity = newTotalQuantity;
            cart.items[existingItemIndex].totalPrice = newTotalQuantity * product.regularPrice;
        } else {
            if (requestedQuantity > product.quantity) {
                return res.status(400).json({ success: false, message: 'Not enough stock available' });
            }

            if (requestedQuantity > MAX_QUANTITY_PER_PRODUCT) {
                return res.status(400).json({
                    success: false,
                    message: `Maximum ${MAX_QUANTITY_PER_PRODUCT} items allowed per product`
                });
            }

            cart.items.push({
                productId: product._id,
                price: product.regularPrice,
                quantity: requestedQuantity,
                totalPrice: requestedQuantity * product.regularPrice,
                status: "active",
                cancelationReason: "none"
            });
        }

        await cart.save();

        const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        req.session.cartCount = cartCount;

        return res.status(200).json({
            success: true,
            message: 'Product added to cart successfully',
            cartCount: cartCount
        });

    } catch (error) {
        console.error('Error adding to cart:', error);
        return res.status(500).json({ success: false, message: 'Failed to add to cart' });
    }
};
const getCartState = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to continue' });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'brand',
                model: 'Brand'
            },
            match: { status: { $ne: "Discontinued" } }
        }).lean();

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const validItems = cart.items.filter(item => item.productId);
        const itemsWithStatusInfo = validItems.map(item => ({
            ...item,
            isOutOfStock: item.quantity > item.productId.quantity,
            isUnlisted: !item.productId.isListed,
            availableQuantity: item.productId.quantity
        }));

        let cartSummary = {
            items: itemsWithStatusInfo,
            subtotal: 0,
            discountAmount: 0,
            shippingCharge: 0,
            total: 0,
            couponDiscount: 0,
            hasOutOfStockItems: false,
            hasUnlistedItems: false
        };

        if (itemsWithStatusInfo.length > 0) {
            cartSummary = itemsWithStatusInfo.reduce((acc, item) => {
                const product = item.productId;
                const quantity = item.quantity;

                if (product.isListed && product.status !== "Discontinued") {
                    const itemPrice = product.regularPrice * quantity;
                    const brandOffer = product.brand?.brandOffer || 0;
                    const productOffer = product.discount || 0;
                    const effectiveDiscount = Math.max(brandOffer, productOffer);
                    const itemSavings = itemPrice * (effectiveDiscount / 100);

                    acc.subtotal += itemPrice;
                    acc.discountAmount += itemSavings;
                }

                if (item.isOutOfStock) acc.hasOutOfStockItems = true;
                if (item.isUnlisted) acc.hasUnlistedItems = true;

                acc.items.push(item);
                return acc;
            }, {
                items: [],
                subtotal: 0,
                discountAmount: 0,
                shippingCharge: 0,
                total: 0,
                couponDiscount: 0,
                hasOutOfStockItems: false,
                hasUnlistedItems: false
            });

            const discountedSubtotal = cartSummary.subtotal - cartSummary.discountAmount;
            cartSummary.shippingCharge = discountedSubtotal < 3000 ? 40 : 0;
            cartSummary.total = discountedSubtotal + cartSummary.shippingCharge;
        }

        const currentDate = new Date();
        let applicableCoupons = [];
        if (cartSummary.subtotal > 0) {
            const usedCoupons = await Order.distinct('couponApplied', { userId });
            applicableCoupons = await Coupon.find({
                minimumPrice: { $lte: cartSummary.subtotal },
                expireOn: { $gt: currentDate },
                isList: true,
                $or: [
                    { usageLimit: 0 },
                    { $expr: { $lt: ["$usageCount", "$usageLimit"] } }
                ],
                _id: { $nin: usedCoupons },
                userId: { $ne: userId }
            }).sort({ offerPrice: -1 }).limit(5).lean();
        }

        const appliedCoupon = req.session.appliedCoupon || null;
        if (appliedCoupon && !cartSummary.hasOutOfStockItems && !cartSummary.hasUnlistedItems) {
            const isValidCoupon = applicableCoupons.some(c => c._id.toString() === appliedCoupon.id.toString());
            if (isValidCoupon) {
                cartSummary.couponDiscount = appliedCoupon.discountType === 'percentage'
                    ? Math.min(
                        (cartSummary.subtotal * appliedCoupon.offerPrice) / 100,
                        appliedCoupon.maxDiscount || Infinity
                    )
                    : Math.min(
                        appliedCoupon.offerPrice,
                        cartSummary.subtotal - cartSummary.discountAmount
                    );

                const discountedSubtotal = cartSummary.subtotal - cartSummary.discountAmount - cartSummary.couponDiscount;
                cartSummary.total = Math.max(0, discountedSubtotal + cartSummary.shippingCharge);
            } else {
                req.session.appliedCoupon = null;
            }
        }

        return res.status(200).json({
            success: true,
            cartSummary,
            applicableCoupons,
            appliedCoupon: appliedCoupon ? {
                code: appliedCoupon.name,
                discountType: appliedCoupon.discountType,
                offerPrice: appliedCoupon.offerPrice
            } : null
        });
    } catch (error) {
        console.error("Get Cart State Error:", error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching cart state',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    loadHomepage,
    pageNotFound,
    signup,
    loadSignup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    featuredProducts,
    products,
    newArrivals,
    mensWatch,
    ladiesWatch,
    couplesWatch,
    brandButton,
    productDetails,
    filterProduct,
    addReview,
    ladiesBrandFilter,
    gentsBrandFilter,
    couplesBrandFilter,
    profile,
    profileEdit,
    profileUpdate,
    changePassword,
    profileEmailOtp,
    verifyProfileOtp,
    resendProfileOtp,
    profilePasswordSaving,
    cart,
    deleteCartProduct,
    updateCartQuantity,
    verifyProfileUpdateOtp,
    resendProfileUpdateOtp,
    addToCartAPI,
    profileNewPassword,
    getCartState
};