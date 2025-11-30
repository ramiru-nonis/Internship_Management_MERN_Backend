const express = require('express');
const router = express.Router();
const {
    submitPlacementForm,
    getPlacementForm,
    getAllPlacementForms,
} = require('../controllers/placementController');
const { protect, coordinator } = require('../middleware/authMiddleware');

router.post('/', protect, submitPlacementForm);
router.get('/', protect, getPlacementForm);
router.get('/all', protect, coordinator, getAllPlacementForms);

module.exports = router;
