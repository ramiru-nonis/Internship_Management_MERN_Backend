const express = require('express');
const router = express.Router();
const {
    getAssignedStudents,
    getStudentProfile,
    uploadMarksheet,
    getAssignedStudentsWithMarksheet,
} = require('../controllers/mentorController');
const { protect, academicMentor } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All routes require authentication and academic mentor role
router.use(protect);
router.use(academicMentor);

router.get('/students', getAssignedStudents);
router.get('/students-marks', getAssignedStudentsWithMarksheet);
router.post('/marksheet', upload.single('file'), uploadMarksheet);
router.get('/students/:id', getStudentProfile);

module.exports = router;
