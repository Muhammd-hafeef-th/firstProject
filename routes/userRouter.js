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
const walletController=require('../controllers/user/walletController')
const wishlistController=require('../controllers/user/wishlishtController')
const couponController=require('../controllers/user/couponController')
const referralController=require('../controllers/user/referralController')
const pageController=require('../controllers/user/pageController')
const cartCount=require('../middlewares/cartCount')
const wishlistCount=require('../middlewares/wishlistCount')
const breadcrumbsMiddleware = require('../middlewares/breadcrumbs')


router.use(cartCount)
router.use(wishlistCount)
router.use(breadcrumbsMiddleware)

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


const checkSession = (req, res, next) => {
  if (req.session.user) return res.redirect('/');
  if (req.query.referralCode) req.session.referralCode = req.query.referralCode;
  next();
};

const handleOAuthError = (failureRedirect) => (req, res, next) => {
  if (req.query.error) {
    console.error('Google OAuth error:', req.query.error);
    return res.redirect(`${failureRedirect}?error=google_auth_failed`);
  }
  next();
};

router.get('/auth/google/signup', 
  checkSession,
  passport.authenticate("google-signup", { scope: ["profile", "email"] })
);

router.get('/auth/google/signup/callback',
  handleOAuthError('/signup'),
  passport.authenticate("google-signup", { 
    failureRedirect: "/signup",
    failureFlash: true 
  }),
  (req, res) => {
   
    req.session.user = req.user;
    
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/signup?error=session_error');
      }
      res.redirect('/');
    });
  }
);

router.get('/auth/google/login',
  passport.authenticate("google-login", { scope: ["profile", "email"] })
);

router.get('/auth/google/login/callback',
  handleOAuthError('/login'),
  passport.authenticate("google-login", { 
    failureRedirect: "/login",
    failureFlash: true 
  }),
  (req, res) => {
    
    req.session.user = req.user;
    
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/login?error=session_error');
      }
      res.redirect('/');
    });
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
router.post('/verify-profile-otp',userController.verifyProfileUpdateOtp);
router.post('/resend-profile-otp', userController.resendProfileUpdateOtp);
router.get("/change-password",userController.changePassword);
router.post("/profile-emailOtp",userController.profileEmailOtp)
router.post("/verifyProfileOtp",userController.verifyProfileOtp)
router.get("/profileNewPassword",userController.profileNewPassword)
router.post('/resendProfileOtp',userController.resendProfileOtp)
router.post("/profilePasswordSaving",userController.profilePasswordSaving)

//add to cart

router.post('/addToCart', userController.addToCartAPI);
router.get('/cart',userController.cart)
router.get("/deleteCartProduct",userController.deleteCartProduct);
router.post('/updateCartQuantity', userController.updateCartQuantity);
router.get('/get-cart-state',userController.getCartState)


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
router.post('/razorpay/verify', checkoutController.verifyRazorpayPayment)
router.get('/paymentSuccess/:orderId',checkoutController.paymentSuccess)
router.get('/paymentFailure',checkoutController.paymentFailure)


//coupon management
router.post('/validate-coupon', couponController.validateCoupon)
router.post('/apply-coupon', couponController.applyCoupon)
router.post('/remove-coupon', couponController.removeCoupon)

//order management

router.get('/orders',orderController.GetOrder)
router.get('/order-details',orderController.orderDetails)
router.post('/cancel-order',orderController.cancelOrder)
router.get('/download-invoice/:orderId',orderController.downloadInvoice)
router.post('/submit-return',orderController.returnOrder)


//wallet management

router.get('/wallet',walletController.getWallet)
router.get('/wallet/all-transactions', walletController.getAllTransactions)

//referral management
router.get('/referrals', referralController.getUserReferralDetails)

//wishlist management

router.get('/wishlist',wishlistController.getWishlist)
router.get('/addToWishlist', wishlistController.addToWishlist)
router.get('/removeFromWishlist', wishlistController.removeFromWishlist)
router.post('/moveToCart', wishlistController.moveToCart)

//static pages
router.get('/aboutus', pageController.loadAboutUs)
router.get('/contactus', pageController.loadContactUs)
router.post('/contactus', pageController.submitContactForm)

module.exports = router;













