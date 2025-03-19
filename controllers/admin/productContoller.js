const { mountpath } = require("../../app");
const Product=require("../../models/productSchema");
const fs=require('fs');
const path=require("path");
const multer=require('multer')



const productInfo=async (req,res)=>{
    try {
        const page=parseInt(req.query.page)||1
        const limit=5 ;
        const skip=(page-1)*limit;

        const  productData=await Product.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const totalProduct=await Product.countDocuments();
        const totalPages=Math.ceil(totalProduct/limit);
        res.render('product',{
            product:productData,
            currentPage:page,
            totalPages:totalPages,
            totalProduct:totalProduct
        });
    } catch (error) {
        console.log("Something error in brandinfo",error)
        res.redirect("/pageError")
    }
}

const addProduct=async (req,res)=>{
    try {
        res.render('add-product')
    } catch (error) {
        console.log("something error in adding product")
        res.status(500).json({ error: "Internal Server Error" });
    }
}
const addProductItem=async (req,res)=>{
    try {
        const { name, description, brand, category, amount, stock, featured, new: isNew, colors } = req.body;
        const images = req.files;     
        if (!images) {
            return res.status(400).json({ error: "Please upload an image" });
        }
        
        const newProduct = new Product({
            productName: name.trim(),
            productImageImage: images,
            description:description,
            brand:brand,
            category:category,
            regularPrice:amount,
            quantity:stock,
            color:colors,
            isFeatured:featured,
            isNew:isNew   
            
        });
        console.log("Saving brand:", name);
        await newBrand.save();
        res.status(200).json({ success: true, message: "Brand added successfully" });
      

    } catch (error) {
        console.error("Error adding brand:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

module.exports={
    productInfo,
    addProduct,
    addProductItem,
    upload
}