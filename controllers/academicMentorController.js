const AcademicMentor = require('../models/AcademicMentor');
const Student = require('../models/Student');
const Presentation = require('../models/Presentation');
const Logbook = require('../models/Logbook');
const Marksheet = require('../models/Marksheet');

// @desc    Get Mentor Dashboard (assigned students)
// @route   GET /api/academic-mentor/dashboard
// @access  Private (Academic Mentor)
const getMentorDashboard = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const students = await Student.find({ academic_mentor: mentor._id })
            .populate('user', 'email');

        res.json({
            mentor,
            students
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Specific Assigned Student Details & Documents
// @route   GET /api/academic-mentor/student/:id
// @access  Private (Academic Mentor)
const getAssignedStudent = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const student = await Student.findById(req.params.id)
            .populate('user', 'email')
            .lean();

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Security check: Only assigned mentor or admin can view
        if (student.academic_mentor.toString() !== mentor._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to view this student' });
        }

        // Fetch submissions
        const logbooks = await Logbook.find({ studentId: student.user._id });
        const marksheet = await Marksheet.findOne({ studentId: student.user._id });
        const presentation = await Presentation.findOne({ studentId: student.user._id });

        res.json({
            ...student,
            submissions: {
                logbooks,
                marksheet,
                presentation
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMentorDashboard,
    getAssignedStudent
};
