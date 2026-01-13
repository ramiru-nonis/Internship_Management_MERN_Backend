const AcademicMentor = require('../models/AcademicMentor');
const Student = require('../models/Student');
const User = require('../models/User');

// @desc    Get Mentor Dashboard Data
// @route   GET /api/academic-mentor/dashboard
// @access  Private (Academic Mentor)
const getMentorDashboard = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findOne({ user: req.user._id });

        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const students = await Student.find({ academic_mentor: mentor._id })
            .select('-password')
            .populate('user', 'email');

        res.json({
            mentor,
            students
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Specific Student Details
// @route   GET /api/academic-mentor/student/:id
// @access  Private (Academic Mentor)
const getAssignedStudent = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const student = await Student.findById(req.params.id)
            .populate('user', 'email');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if student is assigned to this mentor
        if (student.academic_mentor && student.academic_mentor.toString() !== mentor._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this student' });
        }

        // Also handle case where student has no mentor assigned yet but mentor tries to access? 
        // Logic says mentor can only see students assigned to them.
        if (!student.academic_mentor) {
            return res.status(403).json({ message: 'Not authorized to view this student' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    getMentorDashboard,
    getAssignedStudent
};
