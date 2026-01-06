const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getAllStudents,
    updateStudentStatus,
    getAllApplications,
    getAllPlacementForms,
    getStudentProfile,
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

module.exports = router;
