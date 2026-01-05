const express = require('express');
const router = express.Router();
const {
    getProfile,
    updateProfile,
    uploadCV,
    uploadProfilePicture,
    getApplications,
    getStatus,
} = require('../controllers/studentController');
const { protect, student } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All routes require authentication and student role
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/upload-cv', (req, res, next) => {
    upload.single('cv')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Max size is 5MB.' });
            }
            return res.status(400).json({ message: err.message || err });
        }
        next();
    });
}, uploadCV);
router.post('/upload-picture', (req, res, next) => {
    upload.single('profile_picture')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Max size is 5MB.' });
            }
            return res.status(400).json({ message: err.message || err });
        }
        next();
    });
}, uploadProfilePicture);
router.get('/applications', getApplications);
router.get('/status', getStatus);

module.exports = router;
