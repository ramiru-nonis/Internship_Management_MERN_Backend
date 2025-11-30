const express = require('express');
const router = express.Router();
const {
    createApplication,
    getApplicationDetails,
    updateApplicationStatus,
    getStudentApplications,
} = require('../controllers/applicationController');
const { protect, coordinator } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, upload.single('cv'), createApplication);
router.get('/:id', protect, getApplicationDetails);
router.put('/:id/status', protect, coordinator, updateApplicationStatus);
router.get('/student/:studentId', protect, getStudentApplications);

module.exports = router;
