const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const profileController=require('../controllers/user/profileController')
const addressController=require('../controllers/user/addressController')
const checkoutController=require('../controllers/user/checkoutController')
const multer = require("multer");
const path=require('path')
const orderController=require('../controllers/user/orderController')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/profile-image/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);


router.get(
    "/auth/google/signup",
    (req, res, next) => {
        if (req.session.user) {
            return res.redirect("/"); 
        }
        next();
    },
    passport.authenticate("google-signup", { scope: ["profile", "email"] })
);


router.get(
    "/auth/google/signup/callback",
    passport.authenticate("google-signup", { failureRedirect: "/login", failureFlash: true }),
    (req, res) => {
        req.session.user = req.user; 
        res.redirect(302, "/"); 
    }
);


router.get(
    "/auth/google/login",
    passport.authenticate("google-login", { scope: ["profile", "email"] })
);

router.get(
    "/auth/google/login/callback",
    passport.authenticate("google-login", { failureRedirect: "/login", failureFlash: true }),
    (req, res) => {
        req.session.user = req.user; 
        res.redirect("/");
    }
);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout",userController.logout)
router.get('/forgot-password',profileController.forgotPassword)
router.post('/forgot-email-valid',profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.resetPassword)
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword);  

router.get("/featured",userController.featuredProducts);
router.get("/products",userController.products);
router.get("/newArrivals",userController.newArrivals);
router.get("/mensWatch",userController.mensWatch)
router.get("/ladiesWatch",userController.ladiesWatch)
router.get("/couplesWatch",userController.couplesWatch)
router.get("/brandButton",userController.brandButton)
router.post("/filter-product",userController.filterProduct);
router.post("/ladies-brandFilter",userController.ladiesBrandFilter);
router.post("/gents-brandFilter",userController.gentsBrandFilter);
router.post("/couples-brandFilter",userController.couplesBrandFilter);



router.get("/productDetails", userController.productDetails);
router.post("/add-review", userController.addReview);



//profile management

router.get("/profile",userController.profile)
router.get("/profile-edit",userController.profileEdit)
router.patch("/profile-update",upload.single('imageUpload'),userController.profileUpdate);
router.get("/change-password",userController.changePassword);
router.post("/profile-emailOtp",userController.profileEmailOtp)
router.post("/verifyProfileOtp",userController.verifyProfileOtp)
router.get("/profileNewPassword",userController.profileNewPassword)
router.post('/resendProfileOtp',userController.resendProfileOtp)
router.post("/profilePasswordSaving",userController.profilePasswordSaving)

//add to cart

router.get("/addtoCart",userController.addtoCart);
router.get('/cart',userController.cart)
router.post("/deleteCartProduct",userController.deleteCartProduct);
router.post('/updateCartQuantity', userController.updateCartQuantity);


//address management

router.get('/address',addressController.addressPageGet)
router.get('/addAddress',addressController.addAddress);
router.post('/add-address',addressController.addressAdded);
router.get('/editAddress',addressController.editAddress)
router.post('/edit-address/:id', addressController.addressEdit); 
router.patch('/edit-address/:id',addressController.addressEdit)
router.delete('/address/:id',addressController.deleteAddress)

//checkout management

router.get('/checkout',checkoutController.checkout);
router.get('/addAddressCheckout',checkoutController.addAddress)
router.post('/add-address-checkout',checkoutController.addAddressCheckout)
router.get('/editAddress-checkout',checkoutController.editAddress);
router.post('/edit-address-checkout/:id',checkoutController.addressEdit); 
router.patch('/edit-address-checkout/:id',checkoutController.addressEdit)
router.delete('/address-checkout/:id',checkoutController.deleteAddress)
router.post('/setDefaultAddress/:id',checkoutController.setDefaultAddress);
router.get('/proceed-payment',checkoutController.proceedPayment)
router.post('/choose-payment',checkoutController.choosePayment)

//order management

router.get('/orders',orderController.GetOrder)
router.get('/order-details',orderController.orderDetails)


module.exports = router;
