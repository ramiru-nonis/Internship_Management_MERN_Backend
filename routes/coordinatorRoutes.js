const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getAllStudents,
    updateStudentStatus,
    getAllApplications,
    getAllPlacementForms,
    getStudentProfile,
    createAcademicMentor,
    getAllMentors,
    updateMentor,
    deleteMentor,
    assignMentor,
    bulkAssignMentor,
    getCompletedStudents,
    getStudentMarksForFinalSubmission,
    submitFinalMarks,
} = require('../controllers/coordinatorController');
const { downloadCVs } = require('../controllers/studentController');
const { protect, coordinator } = require('../middleware/authMiddleware');

// All routes require authentication and coordinator role
router.use(protect);
router.use(coordinator);

router.get('/dashboard', getDashboardStats);
router.get('/students', getAllStudents);
router.put('/students/:id/status', updateStudentStatus);
router.post('/students/download-cvs', downloadCVs);
router.get('/students/:id/profile', getStudentProfile);
router.get('/applications', getAllApplications);
router.get('/placements', getAllPlacementForms);

// Mentor Management
router.post('/mentors', protect, coordinator, createAcademicMentor);
router.get('/mentors', protect, coordinator, getAllMentors);
router.put('/mentors/:id', protect, coordinator, updateMentor);
router.delete('/mentors/:id', protect, coordinator, deleteMentor);
router.put('/students/:id/assign-mentor', assignMentor);
router.post('/students/bulk-assign-mentor', bulkAssignMentor);

// Final Marks Management
router.get('/final-marks/students', getCompletedStudents);
router.get('/final-marks/student/:studentId', getStudentMarksForFinalSubmission);
router.post('/final-marks/submit/:studentId', submitFinalMarks);

module.exports = router;
