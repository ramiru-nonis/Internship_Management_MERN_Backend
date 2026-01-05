const express = require('express');
const router = express.Router();
const {
    createApplication,
    getApplicationDetails,
    updateApplicationStatus,
    getStudentApplications,
    downloadJobCVs,
} = require('../controllers/applicationController');
const { protect, coordinator } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, upload.single('cv'), createApplication);
router.get('/student/:studentId', protect, getStudentApplications);
router.post('/download-cvs', protect, coordinator, downloadJobCVs);
router.put('/:id/status', protect, coordinator, updateApplicationStatus);
router.get('/:id', protect, getApplicationDetails);

module.exports = router;
