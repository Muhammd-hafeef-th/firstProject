const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/adressSchema');
const Product = require('../../models/productSchema');
const { trace } = require('../../routes/userRouter');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const GetOrder = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;
        const search = req.query.search ? req.query.search.trim() : "";
        let userData = null;
        let orders = [];
        let totalOrders = 0;
        if (req.session.user) {
            const userId = req.session.user._id || req.session.user;
            userData = await User.findById(userId);
            const searchFilter = {
                user: userId,
                $or: [
                    { orderId: { $regex: search, $options: "i" } },
                    { status: { $regex: search, $options: "i" } }
                ]
            };
            const finalFilter = search ? searchFilter : { user: userId };
            totalOrders = await Order.countDocuments(finalFilter);
            orders = await Order.find(finalFilter)
                .sort({ createdOn: -1 })
                .skip(skip)
                .limit(limit)
                .populate({
                    path: 'orderItems.product',
                    select: 'productName productImage salePrice regularPrice name'
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
            limit: limit,
            search: search
        });
    } catch (error) {
        next(error);
    }
};

const orderDetails = async (req, res, next) => {
    try {
        const orderId = req.query.orderId;
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
        let progress = 0;
        switch (order.status) {
            case 'Pending': progress = 12; break;
            case 'Processing': progress = 36.33; break; 
            case 'Shipped': progress = 66.66; break;    
            case 'Delivered': progress = 100; break;   
        }


        res.render('order-details', { order: order, selectedAddress: selectedAddress, progress });
    } catch (error) {
        next(error)
    }
}

const cancelOrder = async (req, res, next) => {
    try {
        const { orderId, reason, otherReason } = req.body;
        const finalReason = reason === 'other' ? otherReason : reason;
        const order = await Order.findOne({ orderId }).populate('orderItems.product');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (['Cancelled', 'Returned'].includes(order.status)) {
            return res.status(400).json({ message: 'Order already cancelled or returned' });
        }
        for (const item of order.orderItems) {
            const product = item.product;
            product.quantity += item.quantity;
            await product.save();
        }
        order.status = 'Cancelled';
        order.cancelReason = finalReason;
        await order.save();
        res.status(200).json({
            message: 'Order cancelled and product stock updated successfully',
            order
        });
    } catch (error) {
        next(error);
    }
};

const downloadInvoice = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId: orderId })
            .populate('user')
            .populate('orderItems.product')

        const fullAddressDoc = await Address.findOne(
            { "address._id": order.address }
        );

        let selectedAddress = null;
        if (fullAddressDoc) {
            selectedAddress = fullAddressDoc.address.find(addr => addr._id.equals(order.address));
        }

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const doc = new PDFDocument();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);

        doc.pipe(res);

        doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
        doc.moveDown();

        doc.fontSize(10).font('Helvetica');
        doc.text(`Invoice No: INV-${orderId}`, 50);
        doc.text(`Order Date: ${order.invoiceDate.toLocaleDateString()}`);
        doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        doc.fontSize(12).font('Helvetica-Bold').text('Billing Address:', 50);
        doc.fontSize(10).font('Helvetica');
        doc.text(`${selectedAddress.name}`);
        doc.text(`${selectedAddress.landMark}, ${selectedAddress.city}`);
        doc.text(`${selectedAddress.state} - ${selectedAddress.pincode}`);
        doc.text(`Phone: ${selectedAddress.phone}`);
        doc.moveDown();

        let y = doc.y + 10;

        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Product Name', 50, y, { width: 140 });
        doc.text('Qty', 190, y, { width: 40, align: 'right' });
        doc.text('Gross Amt', 240, y, { width: 60, align: 'right' });
        doc.text('Discount', 310, y, { width: 60, align: 'right' });
        doc.text('Tax', 380, y, { width: 60, align: 'right' });
        doc.text('IGST', 450, y, { width: 50, align: 'right' });
        doc.text('Total', 510, y, { width: 50, align: 'right' });

        doc.moveTo(50, y + 15).lineTo(560, y + 15).stroke();
        doc.font('Helvetica');

        y += 25;
        order.orderItems.forEach(item => {
            const grossAmt = item.price * item.quantity;
            const discount = item.product.discount * item.quantity;
            const taxable = 0.00;
            const igst = 0.00;
            const total = grossAmt - discount + taxable + igst;

            doc.fontSize(10);
            doc.text(item.product.productName, 50, y, { width: 140 });
            doc.text(item.quantity.toString(), 190, y, { width: 40, align: 'right' });
            doc.text(grossAmt.toFixed(2), 240, y, { width: 60, align: 'right' });
            doc.text(discount.toFixed(2), 310, y, { width: 60, align: 'right' });
            doc.text(taxable.toFixed(2), 370, y, { width: 60, align: 'right' });
            doc.text(igst.toFixed(2), 440, y, { width: 50, align: 'right' });
            doc.text(total.toFixed(2), 500, y, { width: 50, align: 'right' });

            y += 20;
        });


        y += 10;
        doc.moveTo(50, y).lineTo(560, y).stroke();
        y += 10;
        doc.font('Helvetica-Bold');
        doc.text('Grand Total', 400, y, { width: 100, align: 'right' });
        doc.text(` ${order.finalAmount.toFixed(2)}`, 510, y, { width: 50, align: 'right' });
        doc.font('Helvetica');


        y += 50;
        doc.fontSize(10).text('LB Internet Private Limited', 50, y);
        doc.text('Registered Office: Buildings Alyssa, Begonia and Clover situated in Embassy Tech Village, Outer Ring Road, Devarabeesanahalli Village, Bengaluru – 560103, India');

        y += 40;

        doc.font('Helvetica-Bold').text('Authorized Signatory', 50, y + 20);

        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ error: 'Failed to generate invoice' });
    }
}

const returnOrder = async (req, res, next) => {
    try {
        const { orderId, reason, otherReason } = req.body;
        if (!orderId || !reason) {
            return res.status(400).json({
                message: 'Order ID and reason are required'
            });
        }
        const finalReason = reason === 'other' ? otherReason : reason;
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }
        if (order.status === 'Return-Requested') {
            return res.status(400).json({
                message: 'Return request already submitted for this order'
            });
        }
        if (!['Delivered', 'Shipped'].includes(order.status)) {
            return res.status(400).json({
                message: 'Order cannot be returned in its current status'
            });
        }
        order.status = 'Return Request';
        order.returnReason = finalReason;
        await order.save();
        res.status(200).json({
            success: true,
            message: 'Return request submitted successfully',
            order
        });

    } catch (error) {
        console.error('Error processing return request:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing your return request'
        });
        next(error)
    }
};


module.exports = {
    GetOrder,
    orderDetails,
    cancelOrder,
    downloadInvoice,
    returnOrder
}