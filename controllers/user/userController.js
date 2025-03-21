const User = require('../../models/userSchema');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Product=require('../../models/productSchema')
const Brand=require("../../models/brandSchema")

const loadHomepage = async (req, res) => {
    try {
        const user=req.session.user
        let productsData=await Product.find({quantity:{$gt:0}})
        let featuredData=await Product.find({isFeatured:true,quantity:{$gt:0}})
        let newArrivalsData=await Product.find({isNew:true,quantity:{$gt:0}})
        const brandData=await Brand.find({})
         
        productsData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        productsData=productsData.slice(0,3)

        featuredData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        featuredData=featuredData.slice(0,3);

        newArrivalsData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        newArrivalsData=newArrivalsData.slice(0,4);

        if(user){
            const userData=await User.findOne({_id:user._id})
            res.render('home', { user:userData,products:productsData,featured:featuredData,newArrival:newArrivalsData,brands:brandData});
        }else{
            return res.render('home',{products:productsData,featured:featuredData,newArrival:newArrivalsData,brands:brandData});
        }
       
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
        res.render('register');
    } catch (error) {
        console.error('Signup page is not loading', error);
        res.status(500).send('Server error');
    }
};

function generateOtp(){
    const digits='1234567890';
    let otp='';
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp
}

const sendVerificationEmail =async (email,otp)=>{
    try {
        const transporter=nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })
        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"You OTP for Singup your email",
            text:`You OTP is${otp}`,
            html:`<b><h4>Your OTP:${otp}</h4><br></b>`
        }

        const info=await transporter.sendMail(mailOptions);
        console.log('Email Send:',info.messageId);
        return true;

    } catch (error) { 
        console.error('Error sending email',error)
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
        console.log("Otp is:",otp)
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
            return res.redirect('/');
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



const featuredProducts=async (req,res)=>{
    try {
        let featuredData=await Product.find({isFeatured:true,quantity:{$gt:0}})
        featuredData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        res.render("featured-products",{featured:featuredData})
    } catch (error) {
        console.log("Featured products error")
        res.redirect('/pageNotFound');
    }
}
const products=async (req,res)=>{
    try {
        let productsData=await Product.find({quantity:{$gt:0}})
        productsData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));

        res.render("products",{products:productsData})
    } catch (error) {
        console.log("Products error")
        res.redirect('/pageNotFound');
        
    }
}
const newArrivals=async (req,res)=>{
    try {
        let newArrivalsData=await Product.find({isNew:true,quantity:{$gt:0}})
        newArrivalsData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));

        res.render("new-arrivals",{newArrivals:newArrivalsData})
    } catch (error) {
        console.log("New Arrivals error")
        res.redirect('/pageNotFound');
    }
}

const mensWatch=async (req,res)=>{
    try {
        let gentsMatch = /gents/i;
        let mensWatch=await Product.find({category:gentsMatch});
        res.render("mens-watch",{gents:mensWatch})
    } catch (error) {
        console.log("mens watch error")
        res.redirect('/pageNotFound');
    }
}
const ladiesWatch=async (req,res)=>{
    try {
        let ladiesMatch = /ladies/i;
        let ladiesWatch=await Product.find({category:ladiesMatch});
        res.render("ladies-watch",{ladies:ladiesWatch})
    } catch (error) {
        console.log("ladies watch error")
        res.redirect('/pageNotFound');
        
    }
}
const couplesWatch=async (req,res)=>{
    try {
        let couplesMatch = /couples/i;
        let couplesWatch=await Product.find({category:couplesMatch});
        res.render("couples-watch",{couples:couplesWatch})
    } catch (error) {
        console.log("couples watch error")
        res.redirect('/pageNotFound');
        
    }
}
const brandButton =async (req,res)=>{
    try {
        
    } catch (error) {
        
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
    brandButton
};
