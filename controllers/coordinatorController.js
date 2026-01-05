const Student = require('../models/Student');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const PlacementForm = require('../models/PlacementForm');
const User = require('../models/User');

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

        // Calculate incomplete profiles (Orphan Users)
        // Users with role 'student' BUT not in Student document count
        const totalStudentUsers = await User.countDocuments({ role: 'student' });
        const totalStudentProfiles = await Student.countDocuments();
        const incompleteProfiles = Math.max(0, totalStudentUsers - totalStudentProfiles);

        // Status breakdown
        const statusBreakdown = {
            nonIntern: await Student.countDocuments({ status: 'non-intern' }),
            intern: await Student.countDocuments({ status: 'intern' }),
            completed: await Student.countDocuments({ status: 'Completed' }),
            approved: await Student.countDocuments({ status: 'approved' }),
            hired: await Student.countDocuments({ status: 'hired' }),
            notHired: await Student.countDocuments({ status: 'not hired' }),
            incomplete: incompleteProfiles
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
        const User = require('../models/User'); // Lazy load User model

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

        // 1. Fetch Students (with profiles)
        const students = await Student.find(query)
            .populate('user', 'email')
            .sort({ createdAt: -1 })
            .lean();

        // 2. Fetch All "Student" Users (only if search/filters don't strictly exclude them)
        // If searching by name/degree, orphans won't match (they have no name/degree). 
        // We only show orphans if searching by email (which we should add) or viewing all.
        // For simplicity, we fetch orphans if no strict name/degree filter is active OR if the search matches their email.

        let orphanUsers = [];

        // Only fetch orphans if we are NOT filtering by degree (orphans have none) 
        // and NOT filtering by a specific status that isn't 'Incomplete' (orphans are effectively Incomplete)
        // Adjust logic: Fetch them, then filter in memory if needed.

        const fetchOrphans = (!req.query.degree || req.query.degree === 'all') &&
            (!status || status === 'all' || status.includes('Incomplete'));

        if (fetchOrphans) {
            let userQuery = { role: 'student' }; // Only fetch students
            if (search) {
                userQuery.email = { $regex: search, $options: 'i' };
            }

            const allUsers = await User.find(userQuery).select('-password').lean();

            // Set of User IDs that already have a student profile
            const existingStudentUserIds = new Set(students.map(s => s.user?._id?.toString() || s.user?.toString()));

            // Filter for users NOT in the set
            orphanUsers = allUsers.filter(u => !existingStudentUserIds.has(u._id.toString()));
        }

        // 3. Format Orphans/Staff to look like Students
        const formattedOrphans = orphanUsers.map(u => {
            let derivedStatus = 'Incomplete';

            return {
                _id: 'user_' + u._id,
                user: u,
                first_name: 'N/A',
                last_name: '(No Profile)',
                cb_number: 'N/A',
                email: u.email,
                contact_number: 'N/A',
                degree: 'N/A',
                degree_level: 'N/A',
                status: derivedStatus,
                profile_picture: null,
                cv: null,
                isOrphan: true,
                role: u.role
            };
        });

        // 4. Merge
        const allRecords = [...students, ...formattedOrphans];

        // Attach presentation status (only for real students, orphans have none)
        const studentIds = students.map(s => s.user?._id);
        const presentations = await Presentation.find({ studentId: { $in: studentIds } });

        const presentationMap = {};
        presentations.forEach(p => {
            presentationMap[p.studentId.toString()] = true;
        });

        const finalResults = allRecords.map(record => ({
            ...record,
            hasPresentation: record.isOrphan ? false : !!presentationMap[record.user?._id?.toString()]
        }));

        res.json(finalResults);
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
