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

const fileFilter = function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);

    if (extName && mimeType) {
        cb(null, true);
    } else {
        cb(new Error("Only images (jpeg, jpg, png, webp) are allowed!"));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
}).fields([
    { name: 'images1', maxCount: 1 },
    { name: 'images2', maxCount: 1 },
    { name: 'images3', maxCount: 1 }
]);

module.exports = upload;
