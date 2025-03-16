const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
require("dotenv").config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                } else {
                    const email =
                        profile.emails && profile.emails.length > 0
                            ? profile.emails[0].value
                            : null;

                    if (!email) {
                        return done(new Error("No email found in Google profile"), null);
                    }
                    if (!profile.id) {
                        return done(new Error("Google ID is missing"), null);
                    }

                    user = new User({
                        firstname: profile.displayName,
                        email: profile.emails ? profile.emails[0].value : "", 
                        googleId: profile.id || null  
                    });
                    
                    await user.save();
                    return done(null, user);
                }
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then((user) => {
            done(null, user);
        })
        .catch((err) => {
            done(err, null);
        });
});

module.exports = passport;
