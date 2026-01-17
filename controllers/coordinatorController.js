const Internship = require('../models/Internship');
const PlacementForm = require('../models/PlacementForm');
const User = require('../models/User');
const AcademicMentor = require('../models/AcademicMentor');
const Marksheet = require('../models/Marksheet');
const Student = require('../models/Student');
const Application = require('../models/Application');

// @desc    Create Academic Mentor Account
// @route   POST /api/coordinator/mentors
// @access  Private (Coordinator/Admin)
const createAcademicMentor = async (req, res) => {
    const { first_name, last_name, email, password, contact_number } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            email,
            password,
            role: 'academic_mentor',
        });

        if (user) {
            const mentor = await AcademicMentor.create({
                user: user._id,
                first_name,
                last_name,
                email,
                contact_number,
            });

            res.status(201).json(mentor);
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Academic Mentors
// @route   GET /api/coordinator/mentors
// @access  Private (Coordinator/Admin)
const getAllMentors = async (req, res) => {
    try {
        const mentors = await AcademicMentor.find().populate('user', 'email').lean();

        // Get student counts for each mentor
        const counts = await Student.aggregate([
            { $match: { academic_mentor: { $ne: null } } },
            { $group: { _id: "$academic_mentor", count: { $sum: 1 } } }
        ]);

        const countMap = {};
        counts.forEach(c => {
            if (c._id) countMap[c._id.toString()] = c.count;
        });

        const mentorsWithCount = mentors.map(m => ({
            ...m,
            assignedStudentsCount: countMap[m._id.toString()] || 0
        }));

        res.json(mentorsWithCount);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Mentor Account (edit/deactivate)
// @route   PUT /api/coordinator/mentors/:id
// @access  Private (Coordinator/Admin)
const updateMentor = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findById(req.params.id);
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor not found' });
        }

        const updatedMentor = await AcademicMentor.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updatedMentor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

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
        const { status, search, batch, mentor } = req.query;
        const Presentation = require('../models/Presentation'); // Lazy load
        const User = require('../models/User'); // Lazy load User model

        let query = {};

        // Filter by mentor
        if (mentor) {
            query.academic_mentor = mentor;
        }

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

        // Filter by batch
        if (batch) {
            query.batch = { $regex: batch, $options: 'i' };
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

        // Attach presentation and marksheet status
        const studentIds = students.map(s => s.user?._id);

        const presentations = await Presentation.find({ studentId: { $in: studentIds } });
        const marksheets = await Marksheet.find({ studentId: { $in: studentIds } }); // Fetch marksheets

        const presentationMap = {};
        presentations.forEach(p => {
            presentationMap[p.studentId.toString()] = true;
        });

        const marksheetMap = {}; // Create map
        marksheets.forEach(m => {
            marksheetMap[m.studentId.toString()] = true;
        });

        const finalResults = allRecords.map(record => ({
            ...record,
            hasPresentation: record.isOrphan ? false : !!presentationMap[record.user?._id?.toString()],
            hasMarksheet: record.isOrphan ? false : !!marksheetMap[record.user?._id?.toString()] // Add hasMarksheet
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

const getStudentProfile = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('user', 'email')
            .populate('academic_mentor', 'first_name last_name email');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Fetch Applications
        const applications = await Application.find({ student: student._id })
            .populate('internship', 'title company_name category')
            .sort({ createdAt: -1 });

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
            applications,
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

// @desc    Delete Mentor Account
// @route   DELETE /api/coordinator/mentors/:id
// @access  Private (Coordinator/Admin)
const deleteMentor = async (req, res) => {
    try {
        const mentor = await AcademicMentor.findById(req.params.id);
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor not found' });
        }

        // Delete associated User account
        await User.findByIdAndDelete(mentor.user);

        // Remove mentor from any assigned students
        await Student.updateMany(
            { academic_mentor: mentor._id },
            { $set: { academic_mentor: null } }
        );

        // Delete the mentor profile
        await mentor.deleteOne();

        res.json({ message: 'Mentor and associated account deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign Mentor to Student
// @route   PUT /api/coordinator/students/:id/assign-mentor
// @access  Private (Coordinator/Admin)
const assignMentor = async (req, res) => {
    try {
        const { mentorId } = req.body;
        const studentId = req.params.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (mentorId) {
            const mentor = await AcademicMentor.findById(mentorId);
            if (!mentor) {
                return res.status(404).json({ message: 'Mentor not found' });
            }
            student.academic_mentor = mentorId;
        } else {
            student.academic_mentor = null;
        }

        // Validate status if assigning a mentor
        if (mentorId && student.status !== 'Completed') {
            return res.status(400).json({ message: 'Academic mentors can only be assigned to students who have completed their internship.' });
        }

        await student.save();
        res.json({ message: 'Mentor assigned successfully', student });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk Assign Mentor to Students
// @route   POST /api/coordinator/students/bulk-assign-mentor
// @access  Private (Coordinator/Admin)
const bulkAssignMentor = async (req, res) => {
    try {
        const { studentIds, mentorId } = req.body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'No students selected' });
        }

        if (!mentorId) {
            return res.status(400).json({ message: 'Mentor ID is required' });
        }

        const mentor = await AcademicMentor.findById(mentorId);
        if (!mentor) {
            return res.status(404).json({ message: 'Mentor not found' });
        }

        // Only assign to students with 'Completed' status
        const result = await Student.updateMany(
            {
                _id: { $in: studentIds },
                status: 'Completed'
            },
            { $set: { academic_mentor: mentorId } }
        );

        res.json({
            message: `Mentor assigned to ${result.modifiedCount} students successfully`,
            modifiedCount: result.modifiedCount
        });
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
    getStudentProfile,
    createAcademicMentor,
    getAllMentors,
    updateMentor,
    deleteMentor,
    assignMentor,
    bulkAssignMentor,
};
