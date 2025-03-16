const { response } = require('../../app');
const User=require('../../models/userSchema');
const env=require('dotenv').config();
const nodemailer=require('nodemailer')
const bcrypt=require('bcrypt')

const loadHomepage=async (req,res)=>{
    try {
        return res.render('home');
    } catch (error) {
        console.log('Home page is not found');
        res.status(500).send('Server error')
    }
}

const pageNotFound=async(req,res)=>{
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const loadSignup=async(req,res)=>{
    try {
        return res.render('register')
    } catch (error) {
        console.log('Home page is not loading')
        res.status(500).send('Server error')
    }
}
function generateOtp(){
    return Math.floor(100000 +Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp) {
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
        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP:${otp}</b>`,
        })
        return info.accepted.length>0
    } catch (error) {
        console.log('Error sending email',error);
        return false    
    }
}

const signup=async(req,res)=>{
   
    try {
        const {firstname,email,password,confirmPassword}=req.body;
        if(password!==confirmPassword){
            return res.render('register',{message:'Password donot match'})
        }
        const findUser= await User.findOne({email});
        if(findUser){
            return res.render('register',{message:'User with this email already exists'})
        }
        const otp=generateOtp();

        const emailSend= await sendVerificationEmail(email,otp);
        if(!emailSend){
            return res.json('email-error')
        }
        req.session.userOtp=otp;
        req.session.userData={firstname,email,password};

        res.render('verify-otp')
        console.log('Otp send',otp)
    } catch (error) {
        console.log("signup error",error)
        res.redirect("/pageNotFound")
        
    }
}
const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
        
    }
}

const verifyOtp=async(req,res)=>{
    try {
        const {otp}=req.body
        console.log(otp)
        if(otp===req.session.userOtp){
            const user=req.session.userData
            const passwordHash= await securePassword(user.password);
            const saveUserData=new User({
                firstname:user.firstname,
                email:user.email,
                password:passwordHash
            })
            await saveUserData.save();
            req.session.user=saveUserData._id;
            res.json({success:true,redirectUrl:"/login"})
        }else{
            res.status(400).json({success:false,message:"Invalide OTP ,Please try again"})
        }
        
    } catch (error) {
        console.error("Error verifying otp",error);
        res.status(500).json({success:false,message:"An error occured"})
    }
}

const resendOtp=async(req,res)=>{
    try {
        const {email}=req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp=generateOtp();
        req.session.userOtp=otp

        const emailSend=await sendVerificationEmail(email,otp);
        if(emailSend){
            console.log("Resend otp:",otp)
            res.status(200).json({success:true,message:"Otp resend successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend otp please try agian "})
        }
    } catch (error) {
        console.error("Error resending Otp",error);
        res.status(500).json({success:false,message:"Internal server error . please try again"})
    }
}

const loadLogin = async (req, res) => {
    try {
        if(req.session.user){
            return res.redirect('/')
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

        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render("login", { message: "User not found" });
        }

        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" });
        }

        if (!findUser.password) { 
            return res.render("login", { message: "Password not set. Please login using Google or reset your password." });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect Password" });
        }

        req.session.user = findUser.id;

        res.redirect("/");
    } catch (error) {
        console.error("Login error", error);
        res.render("login", { message: "Login failed. Please try again" });
    }
};


module.exports={
    loadHomepage,
    pageNotFound,
    signup,
    loadSignup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login
}