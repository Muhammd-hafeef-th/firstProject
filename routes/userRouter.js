const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("passport");
const profileController=require('../controllers/user/profileController')

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);


router.get(
    "/auth/google/signup",
    passport.authenticate("google-signup", { scope: ["profile", "email"] })
);

router.get(
    "/auth/google/signup/callback",
    passport.authenticate("google-signup", { failureRedirect: "/login", failureFlash: true }),
    (req, res) => {
        req.session.user = req.user; 
        res.redirect("/");
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
module.exports = router;
