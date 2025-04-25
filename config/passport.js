const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const referralController = require("../controllers/user/referralController");
require("dotenv").config();

passport.use(
    "google-signup",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_SIGNUP_CALLBACK_URL,
            passReqToCallback: true,
            state: true
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                if (!profile || !profile.id || !profile.emails || !profile.emails[0]) {
                    return done(null, false, { message: "Invalid profile data from Google" });
                }

                let user = await User.findOne({ googleId: profile.id });

                if (!user) {
                    // Get referral code from session if available
                    const referralCode = req.session.referralCode || null;
                    
                    // Generate a unique referral code for this new user
                    const newReferralCode = referralController.generateReferralCode(profile.displayName);
                    
                    user = new User({
                        firstname: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id,
                        referalCode: newReferralCode,
                        redeemed: false,
                        redeemedUsers: []
                    });
                    
                    // Save the new user
                    const savedUser = await user.save();
                    
                    // Process referral code if provided
                    if (referralCode) {
                        // Check if the referral code is valid
                        const referrer = await User.findOne({ referalCode: referralCode });
                        
                        if (referrer) {
                            // Add referral bonus to referrer
                            await referralController.addReferralBonus(
                                referrer._id, 
                                100, 
                                `Referral bonus for inviting ${savedUser.firstname}`
                            );
                            
                            // Add bonus to new user
                            await referralController.addReferralBonus(
                                savedUser._id, 
                                50, 
                                'Welcome bonus for using a referral code'
                            );
                            
                            // Add this user to referrer's redeemedUsers array
                            await User.findByIdAndUpdate(
                                referrer._id, 
                                { $push: { redeemedUsers: savedUser._id } }
                            );
                        }
                    }
                }

                // Clear referral code from session after use
                if (req.session.referralCode) {
                    delete req.session.referralCode;
                }

                req.session.user = user; 
                return done(null, user);
            } catch (error) {
                console.error("Google signup error:", error);
                return done(error, null);
            }
        }
    )
);

passport.use(
    "google-login",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_LOGIN_CALLBACK_URL,
            passReqToCallback: true,
            state: true
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                if (!profile || !profile.id) {
                    return done(null, false, { message: "Invalid profile data from Google" });
                }

                let user = await User.findOne({ googleId: profile.id });

                if (!user) {
                    return done(null, false, { message: "No account found. Please sign up first." });
                }

                req.session.user = user;    
                return done(null, user);
            } catch (error) {
                console.error("Google login error:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
