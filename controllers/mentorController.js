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

        // Industry Marksheet: Uploaded by student (no mentorId)
        const industryMarksheet = await Marksheet.findOne({
            studentId: student.user._id,
            mentorId: { $exists: false }
        }).sort({ createdAt: -1 });

        // Academic Mentor Marksheet: Uploaded by mentor (has mentorId)
        const academicMarksheet = await Marksheet.findOne({
            studentId: student.user._id,
            mentorId: { $exists: true }
        }).sort({ createdAt: -1 });

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
                marksheet: industryMarksheet, // Standard/Student marksheet (Industry)
                academicMarksheet: academicMarksheet, // New Academic Mentor marksheet
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

// @desc    Upload Marksheet
// @route   POST /api/mentor/marksheet
// @access  Private (Academic Mentor)
const uploadMarksheet = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a PDF file' });
        }

        const { studentId, fileUrl } = req.body;

        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        // Verify student is assigned to this mentor
        const student = await Student.findOne({ _id: studentId, academic_mentor: mentor._id });
        if (!student) {
            return res.status(403).json({ message: 'Student not assigned to you' });
        }

        const Marksheet = require('../models/Marksheet');

        // Check if ACADEMIC marksheet already exists for this student, if so update it
        // Important: checking for exists:true prevents overwriting the student/industry marksheet
        let marksheet = await Marksheet.findOne({
            studentId: student.user,
            mentorId: { $exists: true }
        });

        if (marksheet) {
            marksheet.fileUrl = fileUrl;
            marksheet.mentorId = mentor._id;
            marksheet.submittedDate = Date.now();
            await marksheet.save();
        } else {
            marksheet = await Marksheet.create({
                studentId: student.user, // Marksheet links to User model, not Student model
                mentorId: mentor._id,
                fileUrl
            });
        }

        res.status(201).json(marksheet);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get assigned students with marksheet status
// @route   GET /api/mentor/students-marks
// @access  Private (Academic Mentor)
const getAssignedStudentsWithMarksheet = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const students = await Student.find({ academic_mentor: mentor._id })
            .populate('user', 'email')
            .sort({ createdAt: -1 });

        const Marksheet = require('../models/Marksheet');

        // Get all ACADEMIC marksheets for these students
        const studentUserIds = students.map(s => s.user?._id);
        const marksheets = await Marksheet.find({
            studentId: { $in: studentUserIds },
            mentorId: { $exists: true }
        });

        const marksheetMap = {};
        marksheets.forEach(m => {
            marksheetMap[m.studentId.toString()] = true;
        });

        const studentsWithStatus = students.map(s => ({
            ...s.toObject(),
            hasMarksheet: !!marksheetMap[s.user?._id?.toString()]
        }));

        res.json(studentsWithStatus);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAssignedStudents,
    getStudentProfile,
    uploadMarksheet,
    getAssignedStudentsWithMarksheet,
};
