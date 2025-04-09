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
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
        type:Schema.Types.ObjectId,
        ref:"Address",
        required:true
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
    }
})

const Order=mongoose.model("Order",orderSchema)

module.exports=Order