const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folderName = 'mern-internship-portal';
        let resourceType = 'auto';

        if (file.fieldname === 'cv') {
            folderName += '/cvs';
            // PDFs are often treated as 'raw' or 'image' (if converting) in Cloudinary
            // 'auto' usually works best to let Cloudinary decide and serve correct headers
            resourceType = 'auto';
        } else if (file.fieldname === 'profile_picture') {
            folderName += '/profiles';
            resourceType = 'image';
        }

        return {
            folder: folderName,
            resource_type: resourceType,
            public_id: file.fieldname + '-' + Date.now(),
        };
    },
});

module.exports = {
    cloudinary,
    storage,
};
