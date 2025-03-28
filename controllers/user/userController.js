const User = require('../../models/userSchema');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Product = require('../../models/productSchema')
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

const loadHomepage = async (req, res) => {
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
        console.error('Home page is not found', error);
        res.status(500).send('Server error');
    }
};

const pageNotFound = async (req, res) => {
    try {
        res.render('page-404');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const loadSignup = async (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/');
        }
        res.render('register');
    } catch (error) {
        console.error('Signup page is not loading', error);
        res.status(500).send('Server error');
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


const signup = async (req, res) => {
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
        console.error("Signup error", error);
        res.redirect("/pageNotFound");
    }
};

const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error('Error hashing password', error);
    }
};

const verifyOtp = async (req, res) => {
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
        console.error("Error verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occurred" });
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

const loadLogin = async (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/profile');
        }
        res.render('login');
    } catch (error) {
        res.redirect('/pageNotFound');
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

        req.session.user = user.id;
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



const featuredProducts = async (req, res) => {
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
        console.log("Featured products error:", error);
        res.redirect('/pageNotFound');
    }
};
const products = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
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
        console.log("Products error:", error);
        res.redirect('/pageNotFound');
    }
};
const newArrivals = async (req, res) => {
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
        console.log("New Arrivals error")
        res.redirect('/pageNotFound');
    }
}

const mensWatch = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 9;
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
        console.log("mens watch error")
        res.redirect('/pageNotFound');
    }
}
const ladiesWatch = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 9;
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
        console.error("Ladies watch error:", error);
        res.redirect('/pageNotFound');
    }
};
const couplesWatch = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 9;
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
        console.log("couples watch error")
        res.redirect('/pageNotFound');

    }
}

const productDetails = async (req, res) => {
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
        console.log("Something went wrong in product details:", error);
        res.redirect("/pageNotFound");
    }
};

const addReview = async (req, res) => {
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
        console.log("Error adding review:", error);
        res.redirect("/pageNotFound");
    }
};

const filterProduct = async (req, res) => {
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
        console.error("Error in filterProduct:", error);
        return res.status(500).send("Internal Server Error");
    }
};
const ladiesBrandFilter = async (req, res) => {
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
        console.error("Filter error:", error);
        res.redirect('/pageNotFound');
    }
};
const gentsBrandFilter = async (req, res) => {
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
        console.error("Filter error:", error);
        res.redirect('/pageNotFound');
    }
};
const couplesBrandFilter = async (req, res) => {
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
        console.error("Filter error:", error);
        res.redirect('/pageNotFound');
    }
};



const brandButton = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
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
        console.log("Error in brand Button:", error);
        res.redirect("/pageNotFound");
    }
}

const profile = async (req, res) => {
    try {
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }

        res.render("profile", { userDatas: userData })
    } catch (error) {
        console.log("Something error in profile", error)
        res.redirect("/pageNotFound");
    }
}
const profileEdit = async (req, res) => {
    try {
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        res.render('profile-edit', { userDatas: userData })
    } catch (error) {

    }
}
const profileUpdate = async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Uploaded file:', req.file);
        const updates = {
            firstname: req.body.username,
            phNumber: req.body.phone,
            email: req.body.email,
            gender: req.body.gender
        };

        if (req.file) {
            updates.userImage = `/uploads/profile-image/${req.file.filename}`;
        }

        await User.findByIdAndUpdate(req.user._id, updates);

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Profile update failed'
        });
    }
}

const changePassword = async (req, res) => {
    try {
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        res.render("userChange-password", { userDatas: userData })
    } catch (error) {
        console.log("Something error in user change password", error)
        res.redirect("/pageNotFound")
    }
}
const profileEmailOtp = async (req, res) => {
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
        res.redirect('/pageNotFound');
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
const verifyProfileOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: "/profileNewPassword" });
        } else {
            res.json({ success: false, message: "Otp is not matching" })
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occured.Please try again" })
    }
}
const profileNewPassword = async (req, res) => {
    try {
        let userData = null
        if (req.session.user) {
            userData = await User.findOne({ _id: req.session.user._id })
        }
        res.render('profileNewPassword', { userDatas: userData })
    } catch (error) {
        console.log("something error in new profile password");
        res.redirect("/pageNotFound")
    }
}
const resendProfileOtp = async (req, res) => {
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
        console.error('Error in resend otp', error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}

const profilePasswordSaving = async (req, res) => {
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
        console.error("Error in postNewPassword:", error);
        res.redirect("/pageNotFound");
    }
}

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
    profilePasswordSaving
};
