const express = require("express");
const app = express();
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const dotenv = require("dotenv").config();
const db = require("./config/db");
const passport = require("./config/passport");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter")
const bodyParser = require("body-parser");
const methodOverride = require('method-override');


db();

app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));




app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 72 * 60 * 60 * 1000,
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());



app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});
app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
});


app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d'  
}));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  maxAge: '1d'
}));

app.use("/", userRouter);
app.use('/admin', adminRouter);

app.use((err, req, res, next) => {
    console.error("Error:", err.stack);
    if (req.originalUrl.startsWith('/admin')) {
        return res.redirect('/admin/pageError'); 
    }
    if (req.xhr || req.headers.accept.includes('json')) {
        return res.status(500).json({ success: false, message: "Something went wrong." });
    }

    res.status(500).render("page-404", { message: "Something went wrong!" });
});



app.listen(process.env.PORT, () => {
    console.log(`Server is running on PORT ${process.env.PORT}`);
});

module.exports = app;
