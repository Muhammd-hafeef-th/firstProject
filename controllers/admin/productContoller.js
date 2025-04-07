const { mountpath } = require("../../app");
const Product = require("../../models/productSchema");
const fs = require('fs');
const path = require("path");
const multer = require('multer')
const Brand = require("../../models/brandSchema")

const productInfo = async (req, res) => {
    try {
        let Search = "";
        if (req.query.search) {
            Search = req.query.search;
        }

        const page = parseInt(req.query.page) || 1
        const limit = 5;
        const skip = (page - 1) * limit;

        const productData = await Product.find({
            productName: { $regex: ".*" + Search + ".*", $options: "i" }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalProduct = await Product.countDocuments({
            productName: { $regex: ".*" + Search + ".*", $options: "i" }
        });
        const totalPages = Math.ceil(totalProduct / limit);
        res.render('product', {
            products: productData,
            currentPage: page,
            totalPages: totalPages,
            totalProduct: totalProduct
        });
    } catch (error) {
        console.log("Something error in brandinfo", error)
        res.redirect("/pageError")
    }
}

const addProduct = async (req, res) => {
    const brand= await Brand.find({})
    try {
        res.render('add-product',{brand:brand})
    } catch (error) {
        console.log("something error in adding product")
        res.status(500).json({ error: "Internal Server Error" });
    }
}
const addProductItem = async (req, res) => {
    try {
        const { name, description, brand, category, amount,discount,salesAmount,shiping, stock, featured, new: isNew, colors } = req.body;
        const productImages = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
        if (!productImages) {
            return res.status(400).json({ error: "Please upload three images" });
        }
        const brandExists = await Brand.findOne({ brandName: brand.trim() });
        if (!brandExists) {
            return res.status(400).json({ error: "Brand does not exist. Please add the brand first." });
        }



        const newProduct = new Product({
            productName: name.trim(),
            productImage: productImages,
            description: description,
            brand: brand,
            category: category,
            regularPrice: amount,
            discount:discount,
            salePrice:salesAmount,
            shipingCharge:shiping,
            quantity: stock,
            color: colors,
            isFeatured: featured,
            isNew: isNew

        });
        console.log("Saving Product:", name);
        await newProduct.save();
        res.status(200).json({ success: true, message: "Product added successfully" });


    } catch (error) {
        console.error("Error adding Product:", error);
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


const editProduct = async (req, res) => {
    const brand=await Brand.find({})
    try {
        const productId = req.query.id;
        if (!productId) {
            return res.status(400).send("Product ID is missing");
        }
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.render("edit-product", { product,brand:brand });
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).send("Internal Server Error");
    }
};

const editProductItem = async (req, res) => {
    try {
        const productId = req.body.productId;
        if (!productId) {
            return res.redirect(`/admin/edit-product?id=${productId}&error=Product ID is missing`);
        }
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect(`/admin/edit-product?id=${productId}&error=Product not found`);
        }
        const { name, description, brand, category, amount,saleAmount,discount,shiping, stock, featured, new: isNew, colors } = req.body;
        const colorArray = Array.isArray(colors) ? colors.filter(c => c.trim() !== "") : (colors ? [colors] : []);
        const isFeatured = featured === "yes";
        const newProduct = isNew === "yes";
        let productImages = [...product.productImage];
        if (req.files) {
            if (req.files['images1']) {
                productImages[0] = '/uploads/' + req.files['images1'][0].filename; 
            }
            if (req.files['images2']) {
                productImages[1] = '/uploads/' + req.files['images2'][0].filename; 
            }
            if (req.files['images3']) {
                productImages[2] = '/uploads/' + req.files['images3'][0].filename; 
            }
        }
        const brandExists = await Brand.findOne({ brandName: brand.trim() });
        if (!brandExists) {
            return res.redirect(`/admin/edit-product?id=${productId}&error=Brand does not exist. Please add the brand first`);
        }
        const updateData = {
            productName: name,
            description,
            brand,
            category,
            regularPrice: isNaN(parseFloat(amount)) ? 0 : parseFloat(amount),
            saleAmount:isNaN(parseFloat(amount)) ? 0 : parseFloat(amount),
            discount:discount,
            shipingCharge:shiping,
            quantity: isNaN(parseInt(stock)) ? 0 : parseInt(stock),
            isFeatured,
            isNew: newProduct,
            color: colorArray,
            productImage: productImages
        };
        const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });
        if (!updatedProduct) {
            return res.redirect(`/admin/edit-product?id=${productId}&error=No changes made to the product`);
        }

        res.redirect("/admin/products");

    } catch (error) {
        console.error("Error updating product:", error);
        return res.redirect(`/admin/edit-product?id=${productId}&error=Internal Server Error`);
    }
};

const deleteProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        console.log("the product Id is:",productId)
        if (!productId || productId.trim() === "") {
            return res.status(400).json({ error: "Product ID is missing or invalid" });
        }
        await Product.findOneAndDelete({ _id: productId });
        res.redirect('/admin/products');

    } catch (error) {
        console.log("Error in delete product details", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};




module.exports = {
    productInfo,
    addProduct,
    addProductItem,
    upload,
    editProduct,
    editProductItem,
    deleteProduct
}