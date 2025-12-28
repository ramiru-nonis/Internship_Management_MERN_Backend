const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/enhance', aiController.enhanceLogbook);

module.exports = router;
