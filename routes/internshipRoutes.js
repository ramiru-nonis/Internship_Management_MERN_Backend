const express = require('express');
const router = express.Router();
const {
    getInternships,
    getInternshipById,
    createInternship,
    applyForInternship,
    updateInternship,
    getExpiredInternships,
    deleteInternship,
} = require('../controllers/internshipController');
const { protect, coordinator } = require('../middleware/authMiddleware');

router.get('/history', protect, coordinator, getExpiredInternships);

router.route('/')
    .get(protect, getInternships)
    .post(protect, coordinator, createInternship);

router.route('/:id')
    .get(protect, getInternshipById)
    .put(protect, coordinator, updateInternship)
    .delete(protect, coordinator, deleteInternship);

router.post('/:id/apply', protect, applyForInternship);

module.exports = router;
