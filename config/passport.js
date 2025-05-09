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
                    const referralCode = req.session.referralCode || null;
                    
                    const newReferralCode = referralController.generateReferralCode(profile.displayName);
                    
                    user = new User({
                        firstname: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id,
                        referalCode: newReferralCode,
                        redeemed: false,
                        redeemedUsers: []
                    });
                    
                    const savedUser = await user.save();
                    
                    if (referralCode) {
                        const referrer = await User.findOne({ referalCode: referralCode });
                        
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
                }

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

                if(user.isBlocked){
                    return done(null,false,{message:"User is blocked by admin"});
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
