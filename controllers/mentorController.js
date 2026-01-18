const AcademicMentor = require('../models/AcademicMentor');
const Student = require('../models/Student');
const Application = require('../models/Application');
const PlacementForm = require('../models/PlacementForm');
const path = require('path');
const fs = require('fs');
const { generateMarksheetPDF } = require('../utils/pdfGenerator');

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

// @desc    Submit marks and generate Marksheet PDF
// @route   POST /api/mentor/marksheet
// @access  Private (Academic Mentor)
const submitMarksheet = async (req, res) => {
    try {
        const { studentId, marks, comments } = req.body;

        // Validation
        if (!marks || !comments) {
            return res.status(400).json({ message: 'Marks and comments are required' });
        }
        if (marks.total > 60) {
            return res.status(400).json({ message: 'Total marks cannot exceed 60' });
        }

        const mentor = await AcademicMentor.findOne({ user: req.user._id });
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor profile not found' });
        }

        const student = await Student.findOne({ _id: studentId, academic_mentor: mentor._id }).populate('user');
        if (!student) {
            return res.status(403).json({ message: 'Student not assigned to you' });
        }

        // Generate PDF
        const uploadsDir = path.join(__dirname, '../uploads/marksheet');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filename = `marksheet_${student.cb_number || student._id}_${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, filename);

        await generateMarksheetPDF(student, mentor, marks, comments, filePath);

        const fileUrl = `/uploads/marksheet/${filename}`;

        const Marksheet = require('../models/Marksheet');

        let marksheet = await Marksheet.findOne({
            studentId: student.user._id,
            mentorId: { $exists: true }
        });

        if (marksheet) {
            marksheet.fileUrl = fileUrl;
            marksheet.mentorId = mentor._id;
            marksheet.marks = marks;
            marksheet.comments = comments;
            marksheet.submittedDate = Date.now();
            await marksheet.save();
        } else {
            marksheet = await Marksheet.create({
                studentId: student.user._id,
                mentorId: mentor._id,
                fileUrl,
                marks,
                comments
            });
        }

        res.status(201).json({ message: 'Marksheet generated and submitted successfully', marksheet });
    } catch (error) {
        console.error('Marksheet Submission Error:', error);
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

        // Get ALL marksheets for these students to differentiate between Academic and Industry
        const studentUserIds = students.map(s => s.user?._id);
        const allMarksheets = await Marksheet.find({
            studentId: { $in: studentUserIds }
        });

        const academicMarksheetMap = {};
        const industryMarksheetMap = {};

        allMarksheets.forEach(m => {
            if (m.mentorId) {
                academicMarksheetMap[m.studentId.toString()] = m;
            } else {
                industryMarksheetMap[m.studentId.toString()] = m;
            }
        });

        const studentsWithStatus = students.map(s => {
            const sid = s.user?._id?.toString();
            return {
                ...s.toObject(),
                marksheet: academicMarksheetMap[sid] || null, // Academic Marksheet
                industryMarksheet: industryMarksheetMap[sid] || null, // Industry Marksheet
                isFinalized: academicMarksheetMap[sid]?.isFinalized || false
            };
        });

        res.json(studentsWithStatus);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAssignedStudents,
    getStudentProfile,
    submitMarksheet,
    getAssignedStudentsWithMarksheet,
};
