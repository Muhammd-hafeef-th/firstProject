const User=require('../../models/userSchema')
const mongoose=require('mongoose')
const bcrypt=require('bcrypt')




const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render('admin-login',{message:null})
}
const login=async(req,res)=>{
    try {
        const {email,password}=req.body
        const admin=await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch=bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin=true
                return res.redirect('/admin')
            }else{
                return res.redirect('/admin/login')
            }
        }else{
            return res.redirect('/admin/login')
        }
    } catch (error) {
        console.error("login error",error);
        res.redirect('/pageError')
    }
}
const loadDashboard=async(req,res)=>{
   if(req.session.admin){
    try {
        res.render('dashboard')
    } catch (error) {
        res.redirect('/pageError')
    }
   }
}
const pageError=async(req,res)=>{
    res.render("admin-error")
}
const logout=async(req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error occured destrou session",err);
                return res.redirect("/pageError")
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.log("Unexpected error during logout",error);
        res.redirect('pageError')
        
    }
}

module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout
}