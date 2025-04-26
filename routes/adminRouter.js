const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const { userAuth, adminAuth } = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const brandController = require('../controllers/admin/brandController');
const orderController = require('../controllers/admin/orderController')
const productController = require('../controllers/admin/productContoller')
const couponController = require("../controllers/admin/couponController")
const { upload } = require('../middlewares/multerConfig');
const { editUpload } = require('../middlewares/multerConfig')


//login management
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/', adminAuth, adminController.loadDashboard)
router.get('/sales-report', adminAuth, adminController.loadSalesReport);
router.get('/download-report', adminAuth, adminController.downloadReport)
router.post('/logout', adminController.logout);

router.get('/pageError', adminController.pageError);
//user management
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerUnblocked);
router.get("/add-user", adminAuth, customerController.addUser);
router.get("/edit-user", adminAuth, customerController.editUser);

//brand management
router.get('/brands', adminAuth, brandController.brandInfo)
router.post("/addBrand", adminAuth, brandController.upload.single("image"), brandController.addBrand);
router.get('/add-brandItem', adminAuth, brandController.addBrandItem)
router.get("/edit-brand", adminAuth, brandController.editBrand)
router.post("/editBrandDetails", adminAuth, brandController.upload.single("image"), brandController.editBrandDetails);
router.post('/delete-brand', adminAuth, brandController.deleteBrand)
router.post('/toggle-brand-status', brandController.toggleBrandStatus);
router.post('/add-brand-offer', adminAuth, brandController.addBrandOffer)

//products management
router.get('/products', adminAuth, productController.productInfo);
router.get("/add-product", adminAuth, productController.addProduct);
router.post("/add-productItem", adminAuth, upload, productController.addProductItem);
router.get("/edit-product", adminAuth, productController.editProduct);
router.post("/edit-productItem", adminAuth, editUpload, productController.editProductItem);
router.post("/delete-product", adminAuth, productController.deleteProduct)
router.post('/toggle-product-status', productController.toggleProductStatus);

//order management
router.get('/orders', adminAuth, orderController.orders);
router.get('/order-admin-details', adminAuth, orderController.orderDetails)
router.post('/change-status', adminAuth, orderController.changeStatus)
router.post('/return-action', adminAuth, orderController.returnAction)

//coupons management
router.get('/coupons', adminAuth, couponController.getCoupon)
router.post('/add-coupon', adminAuth, couponController.addCoupon)
router.post('/edit-coupon', adminAuth, couponController.editCoupon)
router.post('/toggle-coupon/:couponId', adminAuth, couponController.toggleCoupon)
router.get('/get-coupon/:couponId', adminAuth, couponController.getCouponById)

module.exports = router;