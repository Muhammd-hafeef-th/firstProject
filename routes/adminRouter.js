const express=require('express')
const router=express.Router();
const adminController=require('../controllers/admin/adminController');
const {userAuth,adminAuth}=require("../middlewares/auth");
const customerController=require("../controllers/admin/customerController");
const brandController=require('../controllers/admin/brandController');
const productController=require("../controllers/admin/productContoller")


//login management
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout);

router.get('/pageError',adminController.pageError);
//user management
router.get('/users',adminAuth,customerController.customerInfo);
router.get('/blockCustomer',adminAuth,customerController.customerBlocked);
router.get('/unblockCustomer',adminAuth,customerController.customerUnblocked);
router.get("/add-user",adminAuth,customerController.addUser);
router.get("/edit-user",adminAuth,customerController.editUser);

//brand management
router.get('/brands',adminAuth,brandController.brandInfo)
router.post("/addBrand", adminAuth, brandController.upload.single("image"), brandController.addBrand);
router.get('/add-brandItem',adminAuth,brandController.addBrandItem)
router.get("/edit-brand",adminAuth,brandController.editBrand)
router.post("/editBrandDetails", adminAuth, brandController.upload.single("image"), brandController.editBrandDetails);
router.post('/delete-brand',adminAuth,brandController.deleteBrand)

//products management
router.get('/products',adminAuth,productController.productInfo)
router.get("/add-product",adminAuth,productController.addProduct)
router.post("/add-productItem",adminAuth,productController.addProductItem,productController.upload.array('images',3))

module.exports=router;