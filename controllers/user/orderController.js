const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Address=require('../../models/adressSchema');
const { trace } = require('../../routes/userRouter');

const GetOrder = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        let userData = null;
        let orders = [];
        let totalOrders = 0;

        if (req.session.user) {
            userData = await User.findOne({
                $or: [
                    { _id: req.session.user._id },
                    { _id: req.session.user }
                ]
            });

            totalOrders = await Order.countDocuments({
                $or: [
                    { user: req.session.user._id },
                    { user: req.session.user }
                ]
            });

            orders = await Order.find({
                $or: [
                    { user: req.session.user._id },
                    { user: req.session.user }
                ]
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage salePrice regularPrice'
            })            
            .populate('address');
        }

        const formattedOrders = orders.map(order => ({
            id: order.orderId,
            price: order.finalAmount,
            date: order.createdOn.toLocaleDateString('en-GB'),
            mobileDate: order.createdOn.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: order.status,
            items: order.orderItems.map(item => ({
                image: item.product.productImage[0], 
                name: item.product.name,
                quantity: item.quantity,
                price: item.price
            }))
        }));

        const totalPages = Math.ceil(totalOrders / limit);

        res.render('order', {
            userDatas: userData,
            orders: formattedOrders,
            currentPage: page,
            totalPages: totalPages,
            limit: limit
        });
    } catch (error) {
        next(error);
    }
}

const orderDetails=async(req,res,next)=>{
    try {
        const orderId=req.query.orderId;
        const order= await Order.findOne({orderId:orderId})
        .populate({
            path: 'orderItems.product',
            select: 'productName productImage salePrice regularPrice description'
        })  

        const fullAddressDoc = await Address.findOne(
            { "address._id": order.address }
        );

        let selectedAddress = null;
        if (fullAddressDoc) {
            selectedAddress = fullAddressDoc.address.find(addr => addr._id.equals(order.address));
        }
        console.log(order.product);
        console.log(fullAddressDoc);
        console.log(order.address);
        console.log(selectedAddress);
        console.log(order);

       res.render('order-details',{order:order,selectedAddress:selectedAddress});
    } catch (error) {
        next(error)
    }
}

module.exports = {
    GetOrder,
    orderDetails
}