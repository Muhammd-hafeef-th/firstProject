const Brand=require('../../models/brandSchema')
const multer = require("multer");
const path = require("path");
const { nextTick } = require('process');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


const brandInfo = async (req, res,next) => {
    try {
        let Search = "";
        if (req.query.search) {
            Search = req.query.search;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({
            brandName: { $regex: ".*" + Search + ".*", $options: "i" }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalBrand = await Brand.countDocuments({
            brandName: { $regex: ".*" + Search + ".*", $options: "i" }
        });

        const totalPages = Math.ceil(totalBrand / limit);
        res.render('brand', {
            brands: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrand  
        });
    } catch (error) {
       
       next(error)
    }
};


const addBrand = async (req, res,next) => {
    try {
        console.log("Request received");

        const { name, description } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null; 

        if (!image) {
            return res.status(400).json({ error: "Please upload an image" });
        }

        
        const existingBrand = await Brand.findOne({ brandName: { $regex: new RegExp(`^${name}$`, "i") } });

        if (existingBrand) {
            return res.status(400).json({ error: "Brand already exists" });
        }

        const newBrand = new Brand({
            brandName: name.trim(),
            brandImage: image,
            description
        });
        console.log("Saving brand:", name);
        await newBrand.save();
        res.status(200).json({ success: true, message: "Brand added successfully" });
      

    } catch (error) {
        console.error("Error adding brand:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const addBrandItem=async (req,res)=>{
    try {
        res.render("addBrand")
    } catch (error) {
        console.log("something error in adding brand")
        res.status(500).json({ error: "Internal Server Error" });
    }
}
const editBrand = async (req, res) => {
    try {
        const brandId = req.query.id; 
        req.session.brandId = brandId; 
        const brand = await Brand.findById(brandId);
        if (!brand) {
            return res.status(404).send("Brand not found");
        }

        res.render("edit-brand", { brand }); 
    } catch (error) {
        console.error("Error in editBrand:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const editBrandDetails = async (req, res) => {
    try {
        const { brandId, name, description } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;

        if (!brandId) {
            req.flash("error", "Invalid Brand ID");
            return res.redirect("/admin/brands");
        }

        const existingBrand = await Brand.findOne({ brandName: { $regex: new RegExp(`^${name}$`, "i") } });
        const oldName=await Brand.findById({_id:brandId});


        if (existingBrand && name !==oldName.brandName) {
            req.flash("error", "Brand already exists!");
            return res.redirect(`/admin/edit-brand?id=${brandId}`); 
        }

        let updateData = { brandName: name, description };
        if (image) updateData.brandImage = image;

        await Brand.updateOne({ _id: brandId }, { $set: updateData });

        req.flash("success", "Brand updated successfully!");
        return res.redirect("/admin/brands"); 
    } catch (error) {
        console.log("Error in editBrandDetails:", error);
        req.flash("error", "Internal Server Error");
        return res.redirect(`/admin/edit-brand?id=${brandId}`); 
    }
};

const deleteBrand= async (req,res)=>{
    try {
        const brandId=req.query.id;
        await Brand.findOneAndDelete({_id:brandId})
        res.redirect('/admin/brands')
    } catch (error) {
        console.log("Error in delete brand details",error);
        res.status(500).json({error:"Internal Server Error"})
    }
}


module.exports={
    brandInfo,
    addBrand,
    addBrandItem,
    upload,
    editBrand,
    editBrandDetails,
    deleteBrand
}