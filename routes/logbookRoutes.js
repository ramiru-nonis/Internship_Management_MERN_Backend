const express = require('express');
const router = express.Router();
const logbookController = require('../controllers/logbookController');
// const { protect } = require('../middleware/authMiddleware'); // Assuming auth middleware exists

// router.use(protect); // Protect all routes

router.get('/', logbookController.getLogbook);
router.post('/entry', logbookController.saveLogbookEntry);
router.post('/submit', logbookController.submitLogbook);
router.post('/submit-all', logbookController.submitAllLogbooks);
router.get('/history/:studentId', logbookController.getHistory);
router.post('/mentor-action', logbookController.mentorAction); // Should arguably be unprotected if accessed via email link, or protected if mentor portal

module.exports = router;
