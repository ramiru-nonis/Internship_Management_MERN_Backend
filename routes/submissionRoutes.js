const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use centralized upload middleware
const upload = require('../middleware/uploadMiddleware');

router.post('/marksheet', upload.single('marksheet'), submissionController.uploadMarksheet);
router.post('/presentation', upload.single('presentation'), submissionController.uploadPresentation);
router.get('/', submissionController.getAllSubmissions);
router.post('/notify', submissionController.notifySubmission);
router.put('/presentation/:id/schedule', submissionController.schedulePresentation);
// Final grading routes removed as per request
router.get('/student/:studentId', submissionController.getStudentSubmissions);

module.exports = router;
