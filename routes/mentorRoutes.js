const express = require('express');
const router = express.Router();
const {
    getAssignedStudents,
    getStudentProfile,
    submitMarksheet,
    getAssignedStudentsWithMarksheet,
} = require('../controllers/mentorController');
const { protect, academicMentor } = require('../middleware/authMiddleware');


// All routes require authentication and academic mentor role
router.use(protect);
router.use(academicMentor);

router.get('/students', getAssignedStudents);
router.get('/students-marks', getAssignedStudentsWithMarksheet);
router.post('/marksheet', submitMarksheet);
router.get('/students/:id', getStudentProfile);

module.exports = router;
