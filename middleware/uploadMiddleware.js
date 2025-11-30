const multer = require('multer');
const { storage } = require('../config/cloudinary');

// Init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});

// Check file type
function checkFileType(file, cb) {
    const path = require('path');
    if (file.fieldname === 'cv') {
        // CV must be PDF
        // Cloudinary might change the mimetype or extension, but multer checks this before upload usually
        // For Cloudinary, we trust the upload but basic check is good
        const filetypes = /pdf/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: CV must be a PDF file!');
        }
    } else if (file.fieldname === 'profile_picture') {
        // Profile picture must be image
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Profile picture must be an image (JPEG, JPG, PNG, WebP)!');
        }
    } else {
        cb('Error: Unknown field!');
    }
}

module.exports = upload;
