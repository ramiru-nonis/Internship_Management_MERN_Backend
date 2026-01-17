const express = require('express');
const router = express.Router();
const {
    getAssignedStudents,
    getStudentProfile,
    submitMarksheet,
    getAssignedStudentsWithMarksheet,
    getMentorStudentsWithFinalMarks,
} = require('../controllers/mentorController');
const { protect, academicMentor } = require('../middleware/authMiddleware');


// All routes require authentication and academic mentor role
router.use(protect);
router.use(academicMentor);

router.get('/students', getAssignedStudents);
router.get('/students-marks', getAssignedStudentsWithMarksheet);
router.get('/final-marks', getMentorStudentsWithFinalMarks);
router.post('/marksheet', submitMarksheet);
router.get('/students/:id', getStudentProfile);

module.exports = router;
