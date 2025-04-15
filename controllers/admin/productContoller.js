const { mountpath } = require("../../app");
const Product = require("../../models/productSchema");
const fs = require('fs');
const path = require("path");
const multer = require('multer');
const Brand = require("../../models/brandSchema");
const crypto = require('crypto');

const productInfo = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find({ productName: { $regex: search, $options: 'i' } })
                .populate('brand', ' brandName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Product.countDocuments({ productName: { $regex: search, $options: 'i' } })
        ]);

        res.render('product', {
            products,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalProduct: total
        });
    } catch (error) {
        next(error);
    }
};

const addProduct = async (req, res, next) => {
    try {
        const brands = await Brand.find({});
        res.render('add-product', { brands });
    } catch (error) {
        next(error);
    }
};

const addProductItem = async (req, res) => {
    try {
        if (!req.files || req.files.length !== 3) {
            return res.status(400).json({ error: "Exactly 3 images required" });
        }

        const { name, description, brand, category, amount, discount, salesAmount, shiping, stock, featured, new: isNew, color } = req.body;

        const brandDoc = await Brand.findOne({ _id: brand });
        if (!brandDoc) return res.status(400).json({ error: "Brand not found" });

        const productImages = req.files.map(file => `/uploads/${file.filename}`);

        const newProduct = new Product({
            productName: name.trim(),
            productImage: productImages,
            description: description.trim(),
            brand: brandDoc._id,
            category: category.toLowerCase(),
            regularPrice: parseFloat(amount),
            discount: parseFloat(discount),
            salePrice: parseFloat(salesAmount),
            shipingCharge: parseFloat(shiping),
            quantity: parseInt(stock),
            color: color,
            isFeatured: featured === 'yes',
            isNew: isNew === 'yes',
            status: parseInt(stock) > 0 ? 'Available' : 'Out of stock'
        });

        await newProduct.save();
        res.status(200).json({ success: true, message: "Product added successfully" });

    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};

const editProduct = async (req, res, next) => {
    try {
        const [brands, product] = await Promise.all([
            Brand.find({}),
            Product.findById(req.query.id).populate('brand')
        ]);

        if (!product) return res.status(404).send("Product not found");
        res.render("edit-product", { product, brands });

    } catch (error) {
        next(error);
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

        const { 
            name, 
            description, 
            brand, 
            category, 
            amount,
            saleAmount,
            discount,
            shiping, 
            stock, 
            featured, 
            new: isNew, 
            color,
            existingImages,
            croppedImage1,
            croppedImage2,
            croppedImage3
        } = req.body;

        // Validate brand exists
        const brandExists = await Brand.findById(brand);
        if (!brandExists) {
            return res.redirect(`/admin/edit-product?id=${productId}&error=Brand does not exist. Please add the brand first`);
        }

        // Parse existing images
        let productImages = [];
        try {
            if (typeof existingImages === 'string') {
                productImages = JSON.parse(existingImages);
            } else if (Array.isArray(existingImages)) {
                productImages = [...existingImages];
            } else {
                productImages = [...product.productImage];
            }
        } catch (e) {
            console.error("Error parsing existing images:", e);
            productImages = [...product.productImage];
        }

        // Handle uploaded files and cropped images
        const handleImageUpdates = async () => {
            const imageUpdates = [];
            
            // Process regular file uploads
            for (let i = 1; i <= 3; i++) {
                if (req.files && req.files[`images${i}`]) {
                    imageUpdates.push({
                        index: i-1,
                        filename: `/uploads/${req.files[`images${i}`][0].filename}`
                    });
                }
            }
            
            // Process cropped images (base64)
            for (let i = 1; i <= 3; i++) {
                const croppedImage = req.body[`croppedImage${i}`];
                if (croppedImage && croppedImage.startsWith('data:image')) {
                    // Here you would typically save the base64 image to a file
                    // and get the path, but for simplicity we'll just use the base64
                    // In production, you should save it to disk or cloud storage
                    imageUpdates.push({
                        index: i-1,
                        filename: croppedImage // This would be the file path in real implementation
                    });
                }
            }
            
            return imageUpdates;
        };

        const imageUpdates = await handleImageUpdates();
        
        // Update productImages array with new images
        imageUpdates.forEach(update => {
            productImages[update.index] = update.filename;
        });

        // Calculate sale price if not provided
        let finalSalePrice = parseFloat(saleAmount);
        if (isNaN(finalSalePrice) && discount) {
            const calculatedSalePrice = parseFloat(amount) * (1 - (parseFloat(discount) / 100));
            finalSalePrice = calculatedSalePrice.toFixed(2);
        }

        // Prepare update data
        const updateData = {
            productName: name.trim(),
            description: description.trim(),
            brand: brandExists._id,
            category: category.toLowerCase(),
            regularPrice: parseFloat(amount),
            salePrice: finalSalePrice,
            discount: parseFloat(discount || 0),
            shipingCharge: parseFloat(shiping),
            quantity: parseInt(stock),
            color: color.trim(),
            isFeatured: featured === 'yes',
            isNew: isNew === 'yes',
            status: parseInt(stock) > 0 ? 'Available' : 'Out of stock',
            productImage: productImages
        };

        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.redirect(`/admin/edit-product?id=${productId}&error=Failed to update product`);
        }

        return res.redirect("/admin/products");

    } catch (error) {
        console.error("Error updating product:", error);
        return res.redirect(`/admin/edit-product?id=${req.body.productId}&error=Internal Server Error`);
    }
};
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.query.id);

        product.productImage.forEach(image => {
            fs.unlinkSync(path.join(__dirname, '../../public', image));
        });

        res.redirect('/admin/products');

    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ error: "Server error" });
    }
};

module.exports = {
    productInfo,
    addProduct,
    addProductItem,
    editProduct,
    editProductItem,
    deleteProduct
};