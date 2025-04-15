const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    discount:{
        type:Number,
        required:false,
        min:0
    },
    shipingCharge:{
        type:Number,
        required:true,
        min:0
    },
    brand: {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
        required: true
    },
    category: {
        type: String,
        required: true
    },
    regularPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    salePrice: {
        type: Number,
        required: false,
        min: 0,
    },
    productOffer: {
        type: Number,
        default: 0,
        min: 0,
    },
    quantity: {
        type: Number,
        default: 0,
        min: 0,
    },
    color: {
        type: String,
        required: true,
    },
    productImage: {
        type: [String],
        required: true,
        default:[],
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    isNew: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"],
        required: true,
        default: "Available",
    },
    review:[{
        userId:mongoose.Schema.Types.ObjectId,
        username:String,
        rating:Number,
        Comment:String,
        createdAt:{
            type:Date,
            default:Date.now
        }
    }],

}, { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
