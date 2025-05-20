const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const Brand=require('../../models/brandSchema');
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const flash = require('connect-flash')
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit-table')
const fs = require('fs')

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin")
    }
    res.render('admin-login', { message: null })
}

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = admin._id
                return res.redirect('/admin')
            } else {
                req.flash('error', "Password is wrong")
                return res.redirect('/admin/login')
            }
        } else {
            req.flash('error', "Email is wrong")
            return res.redirect('/admin/login')
        }
    } catch (error) {
        next(error)
    }
}

const loadDashboard = async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments({ isListed: true });
        const totalOrders = await Order.countDocuments({
            status: { $nin: ['Cancelled', 'Returned'] }
        });
        const totalUsers = await User.countDocuments({ isBlocked: false, isAdmin: false });

        const orderStatusData = await Order.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $match: { _id: { $ne: null } } }
        ]);

        const totalSalesData = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$finalAmount" }
                }
            }
        ]);
        const totalSales = totalSalesData[0]?.total || 0;

        res.render('dashboard', {
            totalProducts,
            totalOrders,
            totalUsers,
            orderStatusData,
            totalSales
        });

    } catch (error) {
        console.error('Error in loadDashboard:', error);
        res.status(500).render('error', { error: 'Failed to load dashboard' });
    }
};



const loadSalesReport = async (req, res) => {
    try {
        const period = req.query.period || 'today';
        let startDate, endDate;

        switch (period) {
            case 'today':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'week':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                endDate = new Date();
                break;
            case 'month':
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
                endDate = new Date();
                break;
            case 'custom':
                startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
                endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
            default:
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
        }

        const totalOrders = await Order.countDocuments({
            status: 'Delivered',
            createdOn: { $gte: startDate, $lte: endDate }
        });

        const salesData = await Order.aggregate([
            {
                $match: {
                    status: 'Delivered',
                    createdOn: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$finalAmount' },
                    totalDiscount: { $sum: { $subtract: ['$totalPrice', '$finalAmount'] } },
                    avgOrderValue: { $avg: '$finalAmount' }
                }
            }
        ]);

        const paymentMethodData = await Order.aggregate([
            {
                $match: {
                    status: 'Delivered',
                    createdOn: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$paymentMethod.type',
                    total: { $sum: '$finalAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const orderStatusData = await Order.aggregate([
            {
                $match: {
                    createdOn: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const topProducts = await Order.aggregate([
            {
                $match: {
                    status: 'Delivered',
                    createdOn: { $gte: startDate, $lte: endDate }
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: '$orderItems.product',
                    name: { $first: '$productDetails.productName' },
                    image: { $first: { $arrayElemAt: ['$productDetails.productImage', 0] } },
                    totalQuantity: { $sum: '$orderItems.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);

        const topBrands = await Order.aggregate([
            {
                $match: {
                    status: 'Delivered',
                    createdOn: { $gte: startDate, $lte: endDate }
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $lookup: {
                    from: 'brands',
                    localField: 'productDetails.brand',
                    foreignField: '_id',
                    as: 'brandDetails'
                }
            },
            { $unwind: '$brandDetails' },
            {
                $group: {
                    _id: '$brandDetails.brandName',
                    totalSales: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } },
                    totalItems: { $sum: '$orderItems.quantity' }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 }
        ]);

        const topCoupons = await Order.aggregate([
            {
                $match: {
                    status: 'Delivered',
                    createdOn: { $gte: startDate, $lte: endDate },
                    coupon: { $exists: true }
                }
            },
            {
                $group: {
                    _id: '$coupon.code',
                    discountType: { $first: '$coupon.discountType' },
                    discountValue: { $first: '$coupon.discountValue' },
                    usageCount: { $sum: 1 },
                    totalDiscount: { $sum: { $subtract: ['$totalPrice', '$finalAmount'] } }
                }
            },
            { $sort: { usageCount: -1 } },
            { $limit: 5 }
        ]);

        const salesTrendData = await Order.aggregate([
            {
                $match: {
                    status: 'Delivered',
                    createdOn: {
                        $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
                        $lte: new Date()
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdOn' } },
                    totalSales: { $sum: '$finalAmount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        const orders = await Order.find({
            status: 'Delivered',
            createdOn: { $gte: startDate, $lte: endDate }
        })
            .populate('user', 'firstname')
            .sort({ createdOn: -1 })
            .limit(50);

        const result = {
            totalSales: salesData[0]?.totalSales || 0,
            totalDiscount: salesData[0]?.totalDiscount || 0,
            avgOrderValue: salesData[0]?.avgOrderValue || 0,
            totalOrders,
            orders,
            paymentMethodData,
            orderStatusData, 
            topProducts,
            topBrands,
            topCoupons,
            salesTrendData,
            period,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };

        res.render('salesReport', result);
    } catch (error) {
        console.error('Error in loadSalesReport:', error);
        res.status(500).render('error', { error: 'Failed to load sales report' });
    }
};

const downloadReport = async (req, res) => {
    try {
        const format = req.query.format;
        const period = req.query.period || 'today';
        let startDate, endDate;

        switch (period) {
            case 'today':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'week':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                endDate = new Date();
                break;
            case 'month':
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
                endDate = new Date();
                break;
            case 'custom':
                startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
                endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
            default:
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
        }

        const orders = await Order.find({
            status: 'Delivered',
            createdOn: { $gte: startDate, $lte: endDate }
        }).populate('user', 'firstname').sort({ createdOn: -1 });

        const totalSales = orders.reduce((sum, order) => sum + order.totalPrice, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.totalPrice - order.finalAmount), 0);

        if (format === 'excel') {
            const Excel = require('exceljs');
            const workbook = new Excel.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { width: 15 },
                { width: 15 },
                { width: 20 },
                { width: 20 },
                { width: 15 },
                { width: 15 },
                { width: 15 }
            ];

            worksheet.mergeCells('A1:G1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'LB - SALES REPORT';
            titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6d28d9' }
            };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:G2');
            let periodText = '';
            switch (period) {
                case 'today':
                    periodText = 'Today';
                    break;
                case 'week':
                    periodText = 'Last 7 Days';
                    break;
                case 'month':
                    periodText = 'Last 30 Days';
                    break;
                case 'custom':
                    periodText = `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
                    break;
            }
            const periodCell = worksheet.getCell('A2');
            periodCell.value = `Report Period: ${periodText}`;
            periodCell.font = { size: 12, italic: true };
            periodCell.alignment = { horizontal: 'center' };

            worksheet.mergeCells('A3:G3');
            worksheet.getCell('A3').value = 'SUMMARY';
            worksheet.getCell('A3').font = { bold: true };

            worksheet.addRow(['Total Orders', 'Total Sales', 'Total Discount', 'Net Amount', '', '', '']);
            const summaryRow = worksheet.lastRow;
            summaryRow.font = { bold: true };
            summaryRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF3F4F6' }
            };

            worksheet.mergeCells('A4:D4');
            worksheet.getCell('A4').value = orders.length;
            worksheet.getCell('E4').value = totalSales;
            worksheet.getCell('F4').value = totalDiscount;
            worksheet.getCell('G4').value = totalSales - totalDiscount;

            ['E4', 'F4', 'G4'].forEach(cell => {
                worksheet.getCell(cell).numFmt = '₹#,##0.00';
            });

            worksheet.addRow([]);

            const headerRow = worksheet.addRow([
                'Order ID', 'Date', 'Customer', 'Payment Method', 'Total Amount', 'Discount', 'Final Amount'
            ]);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4B5563' }
            };
            headerRow.alignment = { horizontal: 'center' };

            orders.forEach(order => {
                const row = worksheet.addRow([
                    order.orderId,
                    new Date(order.createdOn).toLocaleDateString(),
                    order.user && order.user.firstname ? order.user.firstname : 'N/A',
                    order.paymentMethod.type.toUpperCase(),
                    order.totalPrice,
                    order.totalPrice - order.finalAmount,
                    order.finalAmount
                ]);

                if (row.number % 2 === 0) {
                    row.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF9FAFB' }
                    };
                }
            });

            const lastRow = worksheet.lastRow.number;
            for (let i = 6; i <= lastRow; i++) {
                ['E', 'F', 'G'].forEach(col => {
                    const cell = worksheet.getCell(`${col}${i}`);
                    if (cell.value) {
                        cell.numFmt = '₹#,##0.00';
                    }
                });
            }

            worksheet.mergeCells(`A${lastRow + 2}:G${lastRow + 2}`);
            const footerCell = worksheet.getCell(`A${lastRow + 2}`);
            footerCell.value = `Generated on ${new Date().toLocaleString()}`;
            footerCell.font = { size: 10, italic: true };
            footerCell.alignment = { horizontal: 'right' };

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=lb-sales-report.xlsx');

            await workbook.xlsx.write(res);
            return res.end();

        } else if (format === 'pdf') {
            const PDFDocument = require('pdfkit');
            const fs = require('fs');
            const path = require('path');
            const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
            const fontPath = path.join(__dirname, '../../public/fonts/Roboto-Regular.ttf');
            doc.font(fontPath);


            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=lb-sales-report.pdf');

            doc.pipe(res);

            const logoPath = path.join(__dirname, '../../public/images/hand watch2.png');
            let yPosition = 40;

            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 40, yPosition, { width: 40 });
                doc.fillColor('#6d28d9')
                    .fontSize(18)
                    .text('LB', 90, yPosition + 5)
                    .fontSize(10)
                    .text('SALES REPORT', 90, yPosition + 25);
            } else {
                doc.fillColor('#6d28d9')
                    .fontSize(20)
                    .text('LUXURY BRANDS - SALES REPORT', 40, yPosition);
            }

            yPosition += 50;

            let periodText = '';
            switch (period) {
                case 'today': periodText = 'Today'; break;
                case 'week': periodText = 'Last 7 Days'; break;
                case 'month': periodText = 'Last 30 Days'; break;
                case 'custom': periodText = `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`; break;
            }

            doc.fontSize(10)
                .fillColor('#6b7280')
                .text(`Report Period: ${periodText} | Generated: ${new Date().toLocaleString()}`,
                    { width: 500, align: 'right' });

            yPosition += 30;

            doc.fillColor('#111827')
                .fontSize(14)
                .text('SUMMARY', 40, yPosition, { underline: true });

            yPosition += 25;

            doc.roundedRect(40, yPosition, 515, 90, 5)
                .fill('#f8fafc')
                .stroke('#e2e8f0');

            const summaryCol1 = 60;
            const summaryCol2 = 200;
            const summaryCol3 = 340;
            const summaryCol4 = 480;
            const summaryY = yPosition + 20;


            doc.fontSize(10)
                .fillColor('#64748b')
                .text('Metric', summaryCol1, summaryY)
                .text('Value', summaryCol2, summaryY)
                .text('Metric', summaryCol3, summaryY)
                .text('Value', summaryCol4, summaryY);

            doc.fontSize(12)
                .fillColor('#111827')
                .text('Total Orders', summaryCol1, summaryY + 25)
                .text(orders.length.toString(), summaryCol2, summaryY + 25)
                .text('Total Discount', summaryCol3, summaryY + 25)
                .text(`₹${totalDiscount.toLocaleString()}`, summaryCol4, summaryY + 25)

                .text('Total Sales', summaryCol1, summaryY + 50)
                .text(`₹${totalSales.toLocaleString()}`, summaryCol2, summaryY + 50)
                .text('Net Amount', summaryCol3, summaryY + 50)
                .text(`₹${(totalSales - totalDiscount).toLocaleString()}`, summaryCol4, summaryY + 50);

            yPosition += 120;

            doc.fillColor('#111827')
                .fontSize(14)
                .text('ORDER DETAILS', 40, yPosition, { underline: true });

            yPosition += 25;

            const colWidths = [70, 70, 110, 80, 60, 60, 60];
            const headers = ['Order ID', 'Date', 'Customer', 'Payment', 'Total', 'Discount', 'Final'];

            doc.fontSize(10)
                .fillColor('#ffffff');

            let xPosition = 40;
            headers.forEach((header, i) => {
                doc.rect(xPosition, yPosition, colWidths[i], 20)
                    .fill('#4b5563')
                    .fillColor('#ffffff')
                    .text(header, xPosition + 5, yPosition + 5, { width: colWidths[i] - 10, align: 'center' });
                xPosition += colWidths[i];
            });

            yPosition += 20;

            doc.fontSize(9);
            orders.forEach((order, index) => {
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 40;

                    xPosition = 20;
                    headers.forEach((header, i) => {
                        doc.rect(xPosition, yPosition, colWidths[i], 20)
                            .fill('#4b5563')
                            .fillColor('#ffffff')
                            .text(header, xPosition + 5, yPosition + 5, { width: colWidths[i] - 10, align: 'center' });
                        xPosition += colWidths[i];
                    });
                    yPosition += 20;
                }

                doc.fillColor(index % 2 === 0 ? '#ffffff' : '#f8fafc');
                xPosition = 40;
                for (let i = 0; i < colWidths.length; i++) {
                    doc.rect(xPosition, yPosition, colWidths[i], 20).fill();
                    xPosition += colWidths[i];
                }

                doc.fillColor('#111827');
                xPosition = 40;
                doc.text(order.orderId, xPosition + 5, yPosition + 5, { width: colWidths[0] - 10 });
                xPosition += colWidths[0];

                doc.text(new Date(order.createdOn).toLocaleDateString(), xPosition + 5, yPosition + 5, { width: colWidths[1] - 10, align: 'center' });
                xPosition += colWidths[1];

                doc.text(order.user && order.user.firstname ? order.user.firstname : 'N/A', xPosition + 5, yPosition + 5, { width: colWidths[2] - 10 });
                xPosition += colWidths[2];

                doc.text(order.paymentMethod.type.toUpperCase(), xPosition + 5, yPosition + 5, { width: colWidths[3] - 10, align: 'center' });
                xPosition += colWidths[3];

                doc.text(`₹${order.totalPrice.toLocaleString()}`, xPosition + 5, yPosition + 5, { width: colWidths[4] - 10, align: 'right' });
                xPosition += colWidths[4];

                doc.text(`₹${(order.totalPrice - order.finalAmount).toLocaleString()}`, xPosition + 5, yPosition + 5, { width: colWidths[5] - 10, align: 'right' });
                xPosition += colWidths[5];

                doc.text(`₹${order.finalAmount.toLocaleString()}`, xPosition + 5, yPosition + 5, { width: colWidths[6] - 10, align: 'right' });

                yPosition += 20;
            });

            const pages = doc.bufferedPageRange().count;
            for (let i = 0; i < pages; i++) {
                doc.switchToPage(i);
                doc.fontSize(8)
                    .fillColor('#64748b')
                    .text(`Page ${i + 1} of ${pages}`, 40, 800, { align: 'center' });
            }

            doc.end();

        }

    } catch (error) {
        console.error('Error in downloadReport:', error);
        res.status(500).send('Failed to generate report');
    }
};

const pageError = async (req, res) => {
    res.render("admin-error")
}

const logout = (req, res, next) => {
    try {
        delete req.session.admin;
        res.redirect('/admin/login');
    } catch (error) {
        next(error);
    }
};


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    loadSalesReport,
    downloadReport,
    pageError,
    logout
}