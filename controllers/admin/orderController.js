const Order=require('../../models/orderSchema');
const User=require('../../models/userSchema')
const Address=require('../../models/adressSchema')
const Wallet=require('../../models/walletSchema')


const orders = async (req, res,next) => {
  try {
    const search = req.query.search?.toLowerCase() || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    let orders = await Order.find().populate('user').sort({ invoiceDate: -1 });
    if (search) {
      orders = orders.filter(order =>
        order.orderId.toLowerCase().includes(search) ||
        order.status.toLowerCase().includes(search) ||
        order.user.firstname.toLowerCase().includes(search)
      );
    }
    const totalOrders = orders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const paginatedOrders = orders.slice((page - 1) * limit, page * limit);
    res.render('admin-order', {
      orders: paginatedOrders,
      currentPage: page,
      totalPages,
      search: req.query.search || ''
    });

  } catch (err) {
    next(err)
  }
};

const orderDetails=async(req,res,next)=>{
    try {
        const orderId=req.query.orderId;
        const order = await Order.findOne({ orderId: orderId })
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

        res.render('admin-order-details',{order:order,selectedAddress:selectedAddress});
    } catch (error) {
        next(error)
    }
}

const changeStatus = async (req, res) => {
    try {
        const status = req.body.status; 
        const orderId = req.query.orderId;

        await Order.findOneAndUpdate(
            { orderId: orderId },
            { $set: { status: status } }
        );

        res.redirect(`/admin/order-admin-details?orderId=${orderId}`);
    } catch (error) {
        console.error('Error changing status:', error);
        res.status(500).send('Internal Server Error');
    }
};
const returnAction = async (req, res) => {
    try {
        const { action, orderId } = req.body;
        
        const order = await Order.findOne({ orderId }).populate('user').populate('orderItems.product')
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        if (action === 'accept') {
            order.status = 'Returned';
            const refundAmount = order.finalAmount;

            const wallet = await Wallet.findOneAndUpdate(
                { 'user.email': order.user.email },
                {
                    $inc: { balance: refundAmount },
                    $setOnInsert: { 
                        user: {
                            username: order.user.firstname,
                            email: order.user.email,
                            password: order.user.password
                        },
                        currency: 'USD',
                        status: 'active',
                        transactions: []
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

           
            await Wallet.findByIdAndUpdate(wallet._id, {
                $push: {
                    transactions: {
                        amount: refundAmount,
                        type: 'refund',
                        description: `Order Return #${orderId}`,
                        status: 'completed',
                        date: new Date(),
                        counterparty: order.merchantName || 'System',
                        referenceId: orderId
                    }
                }
            });

        } else {
            order.status = 'Return Rejected';
        }
        for (const item of order.orderItems) {
            const product = item.product;
            product.quantity += item.quantity;
            await product.save();
        }

    
        await order.save();

        res.status(200).json({
            success: true,
            message: `Return request ${action}ed successfully`,
            order
        });

    } catch (error) {
        console.error('Error handling return action:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports={
    orders,
    orderDetails,
    changeStatus,
    returnAction
}