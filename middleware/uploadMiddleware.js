const multer = require('multer');
const { storage: cloudinaryStorage } = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');

// Ensure local directories exist if using local storage
// (Although server.js does this, it's safe to have here for isolated testing/usage)
const createDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Local Storage Configuration
const localStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = 'uploads/';
        if (file.fieldname === 'cv') {
            uploadPath += 'cv';
        } else if (file.fieldname === 'profile_picture') {
            uploadPath += 'profile';
        }
        createDir(uploadPath);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Create unique filename: fieldname-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Select storage based on env
const storage = process.env.STORAGE_TYPE === 'local' ? localStorage : cloudinaryStorage;

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
        const filetypes = /pdf/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: CV must be a PDF file!');
        }
    } else if (file.fieldname === 'profile_picture') {
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
