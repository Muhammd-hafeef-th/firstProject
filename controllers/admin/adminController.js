const User=require('../../models/userSchema')
const mongoose=require('mongoose')
const bcrypt=require('bcrypt')
const flash=require('connect-flash')




const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin")
    }
    res.render('admin-login',{message:null})
}
const login=async(req,res,next)=>{
    try {
        const {email,password}=req.body
        const admin=await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch=await bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin=admin._id
                return res.redirect('/admin')
            }else{
                req.flash('error',"Password is wrong")
                return res.redirect('/admin/login')
            }
        }else{
            req.flash('error',"Email is wrong")
            return res.redirect('/admin/login')
        }
    } catch (error) {
       next(error)
    }
}
const loadDashboard=async(req,res,next)=>{
   if(req.session.admin){
    try {
        res.render('dashboard')
    } catch (error) {
       next(error)
    }
   }
}
const pageError=async(req,res)=>{
    res.render("admin-error")
}
const logout=async(req,res,next)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error occured destroy session",err);
                return res.redirect("/pageError")
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
       next(error)
        
    }
}

module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout
}