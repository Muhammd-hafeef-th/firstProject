const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const profileController=require('../controllers/user/profileController')
const multer = require("multer");
const path=require('path')

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

module.exports = router;
