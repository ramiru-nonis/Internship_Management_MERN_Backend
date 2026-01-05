const express = require('express');
const router = express.Router();
const { loginUser, registerUser } = require('../controllers/authController');
const upload = require('../middleware/uploadMiddleware');

router.post('/login', loginUser);
router.post('/register', upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'profile_picture', maxCount: 1 }]), registerUser);

module.exports = router;
