const Student = require('../models/Student');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const PlacementForm = require('../models/PlacementForm');

// @desc    Get dashboard statistics
// @route   GET /api/coordinator/dashboard
// @access  Private (Coordinator/Admin)
const getDashboardStats = async (req, res) => {
    try {
        // Total students
        const totalStudents = await Student.countDocuments();

        // Students with internships (Intern or Completed)
        const studentsWithInternships = await Student.countDocuments({
            status: { $in: ['intern', 'Completed', 'hired'] } // hired kept for legacy compatibility
        });

        // Total job posts
        const totalJobs = await Internship.countDocuments({ status: 'active' });

        // Expired posts
        const expiredPosts = await Internship.countDocuments({ status: 'expired' });

        // Status breakdown
        const statusBreakdown = {
            nonIntern: await Student.countDocuments({ status: 'non-intern' }),
            intern: await Student.countDocuments({ status: 'intern' }),
            completed: await Student.countDocuments({ status: 'Completed' }),
            approved: await Student.countDocuments({ status: 'approved' }),
            hired: await Student.countDocuments({ status: 'hired' }),
            notHired: await Student.countDocuments({ status: 'not hired' }),
        };

        // Recent applications (last 10)
        const recentApplications = await Application.find()
            .populate('student', 'first_name last_name cb_number')
            .populate('internship', 'title company_name')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            totalStudents,
            studentsWithInternships,
            totalJobs,
            expiredPosts,
            statusBreakdown,
            recentApplications,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all students with filters
// @route   GET /api/coordinator/students
// @access  Private (Coordinator/Admin)
const getAllStudents = async (req, res) => {
    try {
        const { status, search } = req.query;
        const Presentation = require('../models/Presentation'); // Lazy load

        let query = {};

        // Filter by status
        if (status && status !== 'all') {
            const statuses = status.split(',');
            query.status = { $in: statuses };
        }

        // Filter by degree
        if (req.query.degree && req.query.degree !== 'all') {
            const degrees = req.query.degree.split(',');
            query.degree = { $in: degrees };
        }

        // Search by name or CB number
        if (search) {
            query.$or = [
                { first_name: { $regex: search, $options: 'i' } },
                { last_name: { $regex: search, $options: 'i' } },
                { cb_number: { $regex: search, $options: 'i' } },
            ];
        }

        const students = await Student.find(query)
            .populate('user', 'email')
            .sort({ createdAt: -1 })
            .lean(); // Convert to plain object to attach new properties

        // Attach presentation status to each student
        const studentIds = students.map(s => s.user._id);
        const presentations = await Presentation.find({ studentId: { $in: studentIds } });

        const presentationMap = {};
        presentations.forEach(p => {
            presentationMap[p.studentId.toString()] = true;
        });

        const studentsWithStats = students.map(student => ({
            ...student,
            hasPresentation: !!presentationMap[student.user._id.toString()]
        }));

        res.json(studentsWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update student status
// @route   PUT /api/coordinator/students/:id/status
// @access  Private (Coordinator/Admin)
const updateStudentStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        student.status = status;
        await student.save();

        res.json({ message: 'Student status updated', student });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all applications
// @route   GET /api/coordinator/applications
// @access  Private (Coordinator/Admin)
const getAllApplications = async (req, res) => {
    try {
        const { internship, student, search } = req.query;

        let query = {};

        if (internship) {
            query.internship = internship;
        }

        if (student) {
            query.student = student;
        }

        if (search) {
            // Find matching students
            const matchingStudents = await Student.find({
                $or: [
                    { first_name: { $regex: search, $options: 'i' } },
                    { last_name: { $regex: search, $options: 'i' } },
                    { cb_number: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const studentIds = matchingStudents.map(s => s._id);

            // Find matching internships (company name or title)
            const matchingInternships = await Internship.find({
                $or: [
                    { company_name: { $regex: search, $options: 'i' } },
                    { title: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const internshipIds = matchingInternships.map(i => i._id);

            // Add to query
            query.$or = [
                { student: { $in: studentIds } },
                { internship: { $in: internshipIds } }
            ];
        }

        const applications = await Application.find(query)
            .populate('student', 'first_name last_name cb_number contact_number email')
            .populate('internship', 'title company_name category')
            .populate({
                path: 'student',
                populate: {
                    path: 'user',
                    select: 'email'
                }
            })
            .sort({ createdAt: -1 });

        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all placement forms
// @route   GET /api/coordinator/placements
// @access  Private (Coordinator/Admin)
const getAllPlacementForms = async (req, res) => {
    try {
        const placements = await PlacementForm.find()
            .populate({
                path: 'student',
                select: 'first_name last_name cb_number contact_number',
                populate: {
                    path: 'user',
                    select: 'email'
                }
            })
            .sort({ createdAt: -1 });

        res.json(placements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getAllStudents,
    updateStudentStatus,
    getAllApplications,
    getAllPlacementForms,
};
