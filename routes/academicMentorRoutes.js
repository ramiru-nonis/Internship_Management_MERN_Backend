const express = require('express');
const router = express.Router();
const {
    getMentorDashboard,
    getAssignedStudent
} = require('../controllers/academicMentorController');
const { protect, academicMentor } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, academicMentor, getMentorDashboard);
router.get('/student/:id', protect, academicMentor, getAssignedStudent);

module.exports = router;
