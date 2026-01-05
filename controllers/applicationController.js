const Application = require('../models/Application');
const Student = require('../models/Student');
const Internship = require('../models/Internship');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');

// @desc    Create application (Apply for internship)
// @route   POST /api/applications
// @access  Private (Student)
const createApplication = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        // Check if student is already hired/approved
        if (['hired', 'approved', 'intern'].includes(student.status)) {
            return res.status(400).json({ message: 'your are already hired/approved. so you cannot apply for this internship. Please change your status in the profile if this is incorrect' });
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

        // Determine application type and CV source
        let applyType = req.body.apply_type || (req.file ? 'custom_cv' : 'profile');

        if (applyType === 'custom') {
            applyType = 'custom_cv';
        }

        if (!['profile', 'custom_cv'].includes(applyType)) {
            applyType = 'profile';
        }

        let cvPath = student.cv;

        if (applyType === 'custom_cv') {
            if (!req.file) {
                return res.status(400).json({ message: 'Please upload a custom CV to apply with this option' });
            }
            cvPath = req.file.path;
        } else if (req.file) {
            cvPath = req.file.path;
        }

        // Create application
        const application = new Application({
            internship: internshipId,
            student: student._id,
            apply_type: applyType,
            cv: cvPath, // Use uploaded CV or default
        });

        await application.save();

        // NOTIFY COORDINATORS
        const coordinators = await User.find({ role: 'coordinator' });

        // Prepare Email Content
        const studentName = `${student.first_name} ${student.last_name}`;
        const internshipTitle = internship.title;
        const emailSubject = `New Application from ${studentName}`;
        const emailMessage = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>New Internship Application</h2>
                <p><strong>Student:</strong> ${studentName} (${student.reg_no || 'No Reg No'})</p>
                <p><strong>Applying For:</strong> ${internshipTitle}</p>
                <p><strong>Application Type:</strong> ${applyType === 'custom_cv' ? 'Custom CV' : 'Profile CV'}</p>
                <p>Please log in to the portal to review this application.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/coordinator/applications" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Applications</a>
            </div>
        `;

        // Send Notifications Loop
        for (const coord of coordinators) {
            // 1. In-App Notification
            await Notification.create({
                recipient: coord._id,
                message: `New Application: ${studentName} applied for ${internshipTitle}`,
                type: 'info',
                relatedId: application._id,
                relatedModel: 'Application'
            });

            // 2. Email Notification
            if (coord.email) {
                try {
                    await sendEmail({
                        email: coord.email,
                        subject: emailSubject,
                        message: emailMessage,
                        isHtml: true
                    });
                    console.log(`[Notification] Sent email to coordinator: ${coord.email}`);
                } catch (emailErr) {
                    console.error(`[Notification] Failed to send email to coordinator ${coord.email}:`, emailErr.message);
                    // Continue loop even if one email fails
                }
            }
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

// @desc    Download all CVs for a specific internship application
// @route   POST /api/applications/download-cvs
// @access  Private (Coordinator/Admin)
const downloadJobCVs = async (req, res) => {
    const AdmZip = require('adm-zip');
    const axios = require('axios');
    const { internshipId } = req.body;

    try {
        const applications = await Application.find({ internship: internshipId })
            .populate('student');

        if (!applications || applications.length === 0) {
            return res.status(404).json({ message: 'No applications found for this internship' });
        }

        const zip = new AdmZip();
        let count = 0;

        for (const app of applications) {
            // Use application-specific CV if available, otherwise student profile CV
            const cvUrl = app.cv || (app.student && app.student.cv);

            if (cvUrl) {
                try {
                    // Check if it's a Cloudinary URL (starts with http)
                    if (cvUrl.startsWith('http')) {
                        const response = await axios.get(cvUrl, { responseType: 'arraybuffer' });
                        const studentName = app.student ? `${app.student.first_name}_${app.student.last_name}` : 'Unknown_Student';
                        const filename = `${studentName}_CV.pdf`;
                        zip.addFile(filename, Buffer.from(response.data));
                        count++;
                    }
                } catch (err) {
                    console.error(`Error downloading CV for application ${app._id}:`, err.message);
                }
            }
        }

        if (count === 0) {
            return res.status(404).json({ message: 'No valid CV files found to download' });
        }

        const downloadName = `Internship_CVs_${Date.now()}.zip`;
        const data = zip.toBuffer();

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename=${downloadName}`);
        res.set('Content-Length', data.length);
        res.send(data);

    } catch (error) {
        console.error('Bulk download error:', error);
        res.status(500).json({ message: 'Failed to generate zip file' });
    }
};

module.exports = {
    createApplication,
    getApplicationDetails,
    updateApplicationStatus,
    getStudentApplications,
    downloadJobCVs,
};
