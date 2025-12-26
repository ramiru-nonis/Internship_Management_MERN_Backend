const express = require('express');
const router = express.Router();
const logbookController = require('../controllers/logbookController');
// const { protect } = require('../middleware/authMiddleware'); // Assuming auth middleware exists

// router.use(protect); // Protect all routes

router.get('/', logbookController.getLogbook);
router.post('/entry', logbookController.saveLogbookEntry);
router.post('/submit', logbookController.submitLogbook);
// router.post('/submit-all', logbookController.submitAllLogbooks);
router.get('/history/:studentId', logbookController.getHistory);
router.get('/action/:id/:status', logbookController.handleMentorActionLink); // Legacy/GET link support
router.post('/action', logbookController.handleMentorActionLink); // New POST support with feedback

module.exports = router;