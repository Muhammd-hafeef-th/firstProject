    const mongoose = require("mongoose");
    const { Schema } = mongoose;

    const userSchema = new Schema(
        {
            firstname: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true,
                unique: true
            },
            userImage:{
                type:String,
                required:false
            },
            phNumber:{
                type:String,
                required:false,
                unique:true
            },
            gender:{
                type:String,
                required:false
            },
            
            googleId: {
                type: String,
                unique: true,
                sparse: true
            },
            password: {
                type: String
            },
            isBlocked: {
                type: Boolean,
                default: false
            },
            isAdmin: {
                type: Boolean,
                default: false
            },
            
            wallet: {
                type:mongoose.Schema.Types.ObjectId,
                ref:'Wallet'
            },
            
            orderHistory: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Order"
                }
            ],
            referalCode: {
                type: String
            },
            redeemed: {
                type: Boolean
            },
            redeemedUsers: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "User"
                }
            ],
            searchHistory: [
                {
                    category: {
                        type: Schema.Types.ObjectId,
                        ref: "Category"
                    },
                    brand: {
                        type: String
                    },
                    searchOn: {
                        type: Date,
                        default: Date.now
                    }
                }
            ]
        },
        { timestamps: true }
    );

    const User = mongoose.model("User", userSchema);
    module.exports = User;
