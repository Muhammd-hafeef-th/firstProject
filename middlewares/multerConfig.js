const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/"); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});


const upload = multer({ storage: storage }).fields([
    { name: 'images1', maxCount: 1 },
    { name: 'images2', maxCount: 1 },
    { name: 'images3', maxCount: 1 }
]);

module.exports = upload;
