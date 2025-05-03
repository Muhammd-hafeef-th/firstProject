const mongoose=require('mongoose')
const {Schema}=mongoose;
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFXYZ1234567890', 5);

const orderSchema=new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderId: {
        type: String,
        default: () => `ORD-${nanoid()}`,
        unique: true
      },
    orderItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:'Product',
            required:true
        },
        quantity:{
            type:Number,
            required:true,
        },
        price:{
            type:Number,
            default:0,
        }
    }],
    totalPrice:{
        type:Number,
        required:true,
    },
    discount:{
         type:Number, 
         default:0
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    coupon: {
        id: {
            type: Schema.Types.ObjectId,
            ref: 'Coupon'
        },
        code: String,
        discountType: {
            type: String,
            enum: ['percentage', 'amount']
        },
        discountValue: Number
    },
    finalAmount:{
        type:Number,
        required:true
    },
    paymentMethod: {
        type: {
            type: String,
            enum: ['cod', 'razorpay', 'wallet'],
            required: true
        },
        details: {
            transactionId: String,
            
            codVerification: {
                type: String,
                enum: ['pending', 'verified', 'rejected'],
                default: 'pending'
            },
            
            razorpayOrderId: String,
            razorpayPaymentId: String,
            
            walletId: {
                type: Schema.Types.ObjectId,
                ref: 'Wallet'
            },
            walletBalanceUsed: Number
        }
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    address:{
        name: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        landMark: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        altPhone: {
            type: String,
            default: ""
        },
        country: {
            type: String,
            required: true
        }
    },
    invoiceDate:{
        type:Date,
    },
    status:{
        type:String,
        required:true,
        enum:['Pending','Processing','Shipped','Delivered','Cancelled','Return Request','Returned','Return Rejected'],
        default:'Pending'
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    cancelReason:{
        type:String,
        required:false
    },
    returnReason:{
        type:String,
        required:false
    },
    shippingCharge:{
        type:Number,
        required:false
    }
})

const Order=mongoose.model("Order",orderSchema)

module.exports=Order