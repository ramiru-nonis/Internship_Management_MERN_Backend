const Application = require('../models/Application');
const Student = require('../models/Student');
const Internship = require('../models/Internship');

// @desc    Create application (Apply for internship)
// @route   POST /api/applications
// @access  Private (Student)
const createApplication = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        const { internshipId } = req.body;

        const internship = await Internship.findById(internshipId);

        if (!internship) {
            return res.status(404).json({ message: 'Internship not found' });
        }

        // Check if already applied
        const existingApplication = await Application.findOne({
            internship: internshipId,
            student: student._id,
        });

        if (existingApplication) {
            return res.status(400).json({ message: 'You have already applied for this internship' });
        }

        // Create application
        const application = new Application({
            internship: internshipId,
            student: student._id,
            cv: req.file ? req.file.path : student.cv, // Use uploaded CV or default
        });

        await application.save();

        // Update student status to 'Applied' if first application
        if (student.status === 'Not Applied') {
            student.status = 'Applied';
            await student.save();
        }

        res.status(201).json(application);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get application details
// @route   GET /api/applications/:id
// @access  Private
const getApplicationDetails = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('student')
            .populate('internship')
            .populate({
                path: 'student',
                populate: {
                    path: 'user',
                    select: 'email'
                }
            });

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        res.json(application);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update application status
// @route   PUT /api/applications/:id/status
// @access  Private (Coordinator/Admin)
const updateApplicationStatus = async (req, res) => {
    try {
        const { status, notes } = req.body;

        const application = await Application.findById(req.params.id);

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        application.status = status;
        if (notes) {
            application.notes = notes;
        }

        const { createNotification } = require('./notificationController');

        // ... (inside updateApplicationStatus)

        await application.save();

        // Notify Student
        // We need to find the student's User ID. Application has student ID (Student Profile), not User ID.
        // We need to populate student to get user ID or fetch student.
        // Let's fetch student with user populated.
        const student = await Student.findById(application.student);
        if (student) {
            await createNotification(
                student.user,
                `Your application for ${application.internship ? 'internship' : 'job'} has been updated to: ${status}`,
                status === 'Accepted' || status === 'Hired' ? 'success' : 'info',
                application._id,
                'Application'
            );
        }

        res.json({ message: 'Application status updated', application });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get student applications
// @route   GET /api/applications/student/:studentId
// @access  Private
const getStudentApplications = async (req, res) => {
    try {
        const applications = await Application.find({ student: req.params.studentId })
            .populate('internship')
            .sort({ createdAt: -1 });

        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createApplication,
    getApplicationDetails,
    updateApplicationStatus,
    getStudentApplications,
};
