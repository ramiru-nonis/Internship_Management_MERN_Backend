const express = require('express');
const router = express.Router();
const logbookController = require('../controllers/logbookController');

router.get('/', logbookController.getLogbook);
router.post('/save', logbookController.saveLogbookEntry); // "Save Draft"
router.post('/submit', logbookController.submitLogbook);
router.get('/history/:studentId', logbookController.getHistory);
router.get('/action/:id/:status', logbookController.handleMentorActionLink);

module.exports = router;
