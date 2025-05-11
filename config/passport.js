const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const referralController = require("../controllers/user/referralController");

// Always use production URLs for Google OAuth callbacks
const PRODUCTION_BASE_URL = "https://lb-lybros.shop";
const CALLBACK_PATHS = {
  signup: "/auth/google/signup/callback",
  login: "/auth/google/login/callback"
};

// Log the configuration being used
console.log('Google Auth Config - Using production URLs:', {
  baseUrl: PRODUCTION_BASE_URL,
  signupCallback: `${PRODUCTION_BASE_URL}${CALLBACK_PATHS.signup}`,
  loginCallback: `${PRODUCTION_BASE_URL}${CALLBACK_PATHS.login}`
});



const getStrategyConfig = (type) => {
  // Always use production callback URLs
  const callbackURL = `${PRODUCTION_BASE_URL}${CALLBACK_PATHS[type]}`;
  
  return {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL,
    passReqToCallback: true,
    state: true
  };
};

const handleGoogleAuth = async (req, accessToken, refreshToken, profile, done, isSignup) => {
  try {
    if (!profile?.id || !profile.emails?.[0]?.value) {
      return done(null, false, { message: "Invalid profile data from Google" });
    }

    let user = await User.findOne({ googleId: profile.id });

    if (isSignup) {
      if (user) {

        if (user.isBlocked) {
          return done(null, false, { message: "User is blocked by admin" });
        }
        
        return done(null, user);
      }

      const newUser = await createNewUser(profile, req.session.referralCode);
      if (req.session.referralCode) delete req.session.referralCode;
      return done(null, newUser);
    } else {
      if (!user) return done(null, false, { message: "No account found. Please sign up first." });
      if (user.isBlocked) return done(null, false, { message: "User is blocked by admin" });
      return done(null, user);
    }
  } catch (error) {
    console.error(`Google ${isSignup ? 'signup' : 'login'} error:`, error);
    return done(error, null);
  }
};

async function createNewUser(profile, referralCode) {
  const newReferralCode = referralController.generateReferralCode(profile.displayName);
  
  const user = new User({
    firstname: profile.displayName,
    email: profile.emails[0].value,
    googleId: profile.id,
    referalCode: newReferralCode,
    redeemed: false,
    redeemedUsers: []
  });
  
  await user.save();
  
  if (referralCode) {
    await handleReferralBonus(referralCode, user);
  }
  
  return user;
}

async function handleReferralBonus(referralCode, newUser) {
  const referrer = await User.findOne({ referalCode: referralCode });
  if (referrer) {
    await referralController.addReferralBonus(
      referrer._id, 
      100, 
      `Referral bonus for inviting ${newUser.firstname}`
    );
    await referralController.addReferralBonus(
      newUser._id, 
      50, 
      'Welcome bonus for using a referral code'
    );
    await User.findByIdAndUpdate(
      referrer._id, 
      { $push: { redeemedUsers: newUser._id } }
    );
  }
}

// Strategies
passport.use(
  "google-signup",
  new GoogleStrategy(
    getStrategyConfig('signup'),
    (req, accessToken, refreshToken, profile, done) => 
      handleGoogleAuth(req, accessToken, refreshToken, profile, done, true)
  )
);

passport.use(
  "google-login",
  new GoogleStrategy(
    getStrategyConfig('login'),
    (req, accessToken, refreshToken, profile, done) => 
      handleGoogleAuth(req, accessToken, refreshToken, profile, done, false)
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    done(null, await User.findById(id));
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;