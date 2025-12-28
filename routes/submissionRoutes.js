const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        let uploadPath = uploadDir;

        // Ensure root upload dir exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        if (file.fieldname === 'marksheet') {
            uploadPath = path.join(uploadDir, 'marksheet');
        } else if (file.fieldname === 'presentation') {
            uploadPath = path.join(uploadDir, 'presentation');
        } else {
            uploadPath = path.join(uploadDir, 'others');
        }

        // Create dir if not exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.post('/marksheet', upload.single('marksheet'), submissionController.uploadMarksheet);
router.post('/presentation', upload.single('presentation'), submissionController.uploadPresentation);
router.get('/', submissionController.getAllSubmissions);
router.post('/notify', submissionController.notifySubmission);
router.put('/presentation/:id/schedule', submissionController.schedulePresentation);
router.get('/student/:studentId', submissionController.getStudentSubmissions);

module.exports = router;
