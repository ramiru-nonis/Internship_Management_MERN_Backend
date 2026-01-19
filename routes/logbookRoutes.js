const express = require('express');
const router = express.Router();
const logbookController = require('../controllers/logbookController');
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');

router.get('/', logbookController.getLogbook);
router.post('/entry', logbookController.saveLogbookEntry);
router.post('/submit', logbookController.submitLogbook);
// router.post('/submit-all', logbookController.submitAllLogbooks);
router.get('/:id', logbookController.getLogbookById);
router.get('/:id/download', protect, logbookController.downloadLogbookPDF);
router.get('/history/:studentId', logbookController.getHistory);
router.get('/action/:id/:status', logbookController.handleMentorActionLink);
router.post('/verify/:id', logbookController.handleMentorActionLink);
router.post('/upload-signed/:id', upload.single('signed_logbook'), logbookController.uploadSignedLogbook);

module.exports = router;