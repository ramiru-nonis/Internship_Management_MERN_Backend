const AcademicMentor = require('../models/AcademicMentor');
const Student = require('../models/Student');
const Application = require('../models/Application');
const PlacementForm = require('../models/PlacementForm');

// @desc    Get students assigned to the logged-in mentor
// @route   GET /api/mentor/students
// @access  Private (Academic Mentor)
const getAssignedStudents = async (req, res) => {
    try {
        // Find the mentor profile linked to the user
        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const students = await Student.find({ academic_mentor: mentor._id })
            .populate('user', 'email')
            .sort({ createdAt: -1 });

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get specific student profile for assigned mentor
// @route   GET /api/mentor/students/:id
// @access  Private (Academic Mentor)
const getStudentProfile = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const student = await Student.findOne({
            _id: req.params.id,
            academic_mentor: mentor._id
        }).populate('user', 'email');

        if (!student) {
            return res.status(404).json({ message: 'Student not found or not assigned to you' });
        }

        // Fetch Placement Form
        const placement = await PlacementForm.findOne({ student: student._id });

        // Fetch Submissions
        const Marksheet = require('../models/Marksheet');
        const Presentation = require('../models/Presentation');
        const Logbook = require('../models/Logbook');

        const marksheet = await Marksheet.findOne({ studentId: student.user._id }).sort({ createdAt: -1 });
        const presentation = await Presentation.findOne({ studentId: student.user._id }).sort({ createdAt: -1 });
        const logbooks = await Logbook.find({ studentId: student.user._id });
        const latestLogbook = await Logbook.findOne({
            studentId: student.user._id
        }).sort({ year: -1, month: -1 });

        res.json({
            student,
            applications: [], // Mentors do not see applied jobs
            placement,
            submissions: {
                marksheet,
                presentation,
                logbooks: {
                    total: logbooks.length,
                    approved: logbooks.filter(lb => lb.status === 'Approved').length,
                    currentLogbookId: latestLogbook ? latestLogbook._id : null
                }
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAssignedStudents,
    getStudentProfile,
};
