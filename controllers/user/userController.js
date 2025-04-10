const User = require('../../models/userSchema');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema')
const Brand = require("../../models/brandSchema");
const { trace } = require('../../routes/userRouter');
const multer = require("multer");


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
        let productsData = await Product.find({ quantity: { $gt: 0 } })
        let featuredData = await Product.find({ isFeatured: true, quantity: { $gt: 0 } })
        let newArrivalsData = await Product.find({ isNew: true, quantity: { $gt: 0 } })
        const brandData = await Brand.find({})

        productsData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productsData = productsData.slice(0, 3)

        featuredData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        featuredData = featuredData.slice(0, 3);

        newArrivalsData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        newArrivalsData = newArrivalsData.slice(0, 4);

        const user = await User.findOne({ _id: req.session.user });

        let userData = null;
        if (req.session.user) {
            if (user.isBlocked) {
                req.session.destroy((err) => {
                    if (err) console.error('Session destroy error:', err);
                });
                res.redirect('/login')
            }
            else if (user) {
                userData = user;
            }
        }
        res.render('home', {
            user: userData,
            products: productsData,
            featured: featuredData,
            newArrival: newArrivalsData,
            brands: brandData
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
        const { firstname, email, password, confirmPassword } = req.body;

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
        req.session.userData = { firstname, email, password };

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

            const newUser = new User({
                firstname: user.firstname,
                email: user.email,
                password: hashedPassword
            });

            await newUser.save();
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
            return res.render("login", { message: "Email and Password are required" });
        }

        const user = await User.findOne({ isAdmin: 0, email });
        if (!user) {
            return res.render("login", { message: "User not found" });
        }

        if (user.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" });
        }

        if (!user.password) {
            return res.render("login", { message: "Password not set. Please login using Google or reset your password." });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.render("login", { message: "Incorrect Password" });
        }

        req.session.user = user._id;
        res.redirect("/");
    } catch (error) {
        console.error("Login error", error);
        res.render("login", { message: "Login failed. Please try again" });
    }
};
const logout = (req, res) => {
    req.logout((err) => {
        if (err) return res.redirect("/");
        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.redirect("/login");
        });
    });
};



const featuredProducts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        let baseQuery = {
            quantity: { $gt: 0 },
            isFeatured: true
        };
        let featuredData = await Product.find(baseQuery)
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .exec();
        const totalProducts = await Product.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalProducts / limit);
        res.render("featured-products", {
            featured: featuredData,
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
            quantity: { $gt: 0 }
        };
        if (search) {
            query.productName = { $regex: search, $options: "i" };
        }
        if (category) {
            query.category = category;
        }
        if (brand) {
            query.brand = brand;
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
            .exec();

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const brands = await Brand.find({});
        const filters = new URLSearchParams(req.query).toString().replace(/page=\d+&?/, '');

        res.render("products", {
            products: productsData,
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
            quantity: { $gt: 0 },
            isNew: true
        };
        let newArrivalsData = await Product.find(baseQuery)
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProducts = await Product.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalProducts / limit);


        res.render("new-arrivals", {
            newArrivals: newArrivalsData,
            currentPage: page,
            totalPages: totalPages,
            query: req.query
        })
    } catch (error) {
        next(error);
    }
}

const mensWatch = async (req, res, next) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        let brands = await Brand.find({})
        let gentsMatch = /gents/i;

        let mensWatch = await Product.find({ category: gentsMatch })
            .skip(skip)
            .limit(limit)
            .exec()

        const totalProducts = await Product.countDocuments({ category: gentsMatch });
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("mens-watch", {
            gents: mensWatch,
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

        const brands = await Brand.find({});
        const ladiesMatch = /ladies/i;
        const ladiesProducts = await Product.find({ category: ladiesMatch })
            .skip(skip)
            .limit(limit)
            .exec()

        const totalProducts = await Product.countDocuments({ category: ladiesMatch });
        const totalPages = Math.ceil(totalProducts / limit);


        res.render("ladies-watch", {
            ladies: ladiesProducts,
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

        let brands = await Brand.find({})
        let couplesMatch = /couples/i;
        let couplesWatch = await Product.find({ category: couplesMatch })
            .skip(skip)
            .limit(limit)
            .exec()

        const totalProducts = await Product.countDocuments({ category: couplesMatch });
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("couples-watch", {
            couples: couplesWatch,
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

        let avgRating = 0;
        if (productDe.review.length > 0) {
            let total = productDe.review.reduce((sum, review) => sum + review.rating, 0);
            avgRating = total / productDe.review.length;
        }

        res.render("product-details", { productDet: productDe, avgRating });
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
        const brandsdetails = await Brand.find({});
        const { category, brands, sortByPrice, priceTo, priceFrom } = req.body;
        const filter = {};
        if (category) {
            filter.category = category;
        }
        if (brands) {
            filter.brand = brands;
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
        const filter = { category: /ladies/i };

        if (selectedBrand) {
            filter.brand = selectedBrand;
        }

        const brands = await Brand.find({});
        const filteredProducts = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .exec();
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("ladies-watch", {
            ladies: filteredProducts,
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
        const filter = { category: /gents/i };

        if (selectedBrand) {
            filter.brand = selectedBrand;
        }

        const brands = await Brand.find({});
        const filteredProducts = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .exec();
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("mens-watch", {
            gents: filteredProducts,
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
        const filter = { category: /couples/i };

        if (selectedBrand) {
            filter.brand = selectedBrand;
        }

        const brands = await Brand.find({});
        const filteredProducts = await Product.find(filter)
            .skip(skip)
            .limit(limit)
            .exec();
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("couples-watch", {
            couples: filteredProducts,
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

        let query = { brand: brand.brandName };

        if (selectedCategory) {
            query.category = selectedCategory;
        }

        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .exec();

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const brandItem = await Brand.find({});

        res.render("brands-details", {
            products: products,
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
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        res.render('profile-edit', { userDatas: userData })
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
        const user = await User.findById(req.user._id);
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

        await User.findByIdAndUpdate(req.user._id, updates);
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
        await User.findByIdAndUpdate(req.user._id, updates);

        // await sendEmailVerification(newEmail, req.user._id);

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
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        res.render("userChange-password", { userDatas: userData })
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
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        res.render('profileNewPassword', { userDatas: userData })
    } catch (error) {
        next(error);
    }
}
const resendProfileOtp = async (req, res, next) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("resending otp to email:", email)
        const emailSent = await sendVerificationEmail(email, otp)
        if (emailSent) {
            console.log("resend otp is:", otp)
            res.status(200).json({ success: true, message: "Resend OTP successful" })
        }
    } catch (error) {
        error.message = 'Error in resend otp: ' + error.message;
        next(error);
    }
}

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

const addtoCart = async (req, res, next) => {
    try {
        const productId = req.query.id;
        const requestedQuantity = parseInt(req.query.quantity) || 1;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.redirect('/login');
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found");
        }

        let cart = await Cart.findOne({ userId }) || new Cart({ userId, items: [] });

        const existingItemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId
        );

        if (existingItemIndex >= 0) {
            const newTotalQuantity = cart.items[existingItemIndex].quantity + requestedQuantity;

            if (newTotalQuantity > product.quantity) {
                req.flash("error", "Not enough stock available");
                return res.redirect('/cart');
            }

            cart.items[existingItemIndex].quantity = newTotalQuantity;
            cart.items[existingItemIndex].totalPrice = newTotalQuantity * product.regularPrice;
        } else {
            if (requestedQuantity > product.quantity) {
                req.flash("error", "Not enough stock available");
                return res.redirect('/cart');
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
        req.flash("success", "Item added to cart");
        res.redirect('/cart');

    } catch (error) {
        error.message = "Error in addtoCart: " + error.message;
        next(error);
    }
};


const cart = async (req, res, next) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }
        const userCart = await Cart.findOne({ userId }).populate('items.productId') || { items: [] };
        const cartItems = {
            items: userCart.items || []
        };
        res.render('addToCart', { cartItems });
    } catch (error) {
        error.message = "Error in cart controller: " + error.message;
        next(error);
    }

}

const deleteCartProduct = async (req, res, next) => {
    try {
        const productId = req.query.id;
        const userId = req.session.user._id;
        await Cart.updateOne(
            { userId: userId },
            { $pull: { items: { _id: productId } } }
        )
        res.redirect('/cart')
    } catch (error) {
        next(error);
    }
}

const updateCartQuantity = async (req, res, next) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }
        const { itemId, quantity } = req.body;
        const newQuantity = Math.max(parseInt(quantity, 10), 1);
        const cart = await Cart.findOne({ userId });
        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
        const product = await Product.findById(cart.items[itemIndex].productId);
        if (newQuantity > product.quantity) {
            req.flash("error", "The selected quantity exceeds available stock");
            return res.redirect("/cart");
        }
        cart.items[itemIndex].quantity = newQuantity;
        cart.items[itemIndex].totalPrice = newQuantity * product.regularPrice;
        await cart.save();
        req.flash("success", "Cart updated successfully");
        res.redirect('/cart');
    } catch (error) {
        next(error);
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
    profileNewPassword,
    resendProfileOtp,
    profilePasswordSaving,
    addtoCart,
    cart,
    deleteCartProduct,
    updateCartQuantity,
    verifyProfileUpdateOtp,
    resendProfileUpdateOtp
};


