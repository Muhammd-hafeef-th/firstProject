const Order=require('../../models/orderSchema');
const User=require('../../models/userSchema')
const Address=require('../../models/adressSchema')


const orders = async (req, res) => {
  try {
    const search = req.query.search?.toLowerCase() || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    let orders = await Order.find().populate('user').sort({ createdAt: -1 });
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
    console.error(err);
    res.status(500).send('Server error');
  }
};

const orderDetails=async(req,res)=>{
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
        console.log(error)
    }
}

const changeStatus = async (req, res) => {
    try {
        const status = req.body.status; 
        const orderId = req.query.orderId;
        console.log(status,orderId)

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
const returnAction=async(req,res)=>{
    try {
        const {action,orderId}=req.body;
        const order = await Order.findOne({ orderId });
        if (action === 'accept') {
            order.status = 'Returned';
        } else {
            order.status = 'Return Rejected';
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
}

module.exports={
    orders,
    orderDetails,
    changeStatus,
    returnAction
}