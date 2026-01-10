const Student = require('../models/Student');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

// @desc    Get student profile
// @route   GET /api/students/profile
// @access  Private (Student)
const getProfile = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id }).populate('user', 'email role');

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update student profile
// @route   PUT /api/students/profile
// @access  Private (Student)
const updateProfile = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        const {
            first_name,
            last_name,
            contact_number,
            degree,
            degree_level,
            availability,
            preferences,
            status,
            batch
        } = req.body;

        // Update fields if provided
        if (first_name) student.first_name = first_name;
        if (last_name) student.last_name = last_name;
        if (contact_number) student.contact_number = contact_number;
        if (degree) student.degree = degree;
        if (degree_level) student.degree_level = degree_level;
        if (availability) student.availability = availability;
        if (batch) student.batch = batch;
        if (preferences) student.preferences = Array.isArray(preferences) ? preferences : JSON.parse(preferences);

        if (status && student.status !== status) {
            student.status = status;

            // Notify Coordinators (Status Change)
            const coordinators = await User.find({ role: 'coordinator' });

            for (const coordinator of coordinators) {
                await createNotification(
                    coordinator._id,
                    `Student ${student.first_name} ${student.last_name} has changed their status to: ${status}`,
                    'info',
                    student._id,
                    'Student'
                );
            }
        }

        // Notify Coordinators (Profile Details Update)
        const updateFields = ['first_name', 'last_name', 'contact_number', 'degree', 'degree_level', 'availability', 'preferences'];
        const hasProfileUpdates = updateFields.some(field => req.body[field] !== undefined);

        if (hasProfileUpdates) {
            const coordinators = await User.find({ role: 'coordinator' });
            for (const coordinator of coordinators) {
                await createNotification(
                    coordinator._id,
                    `Student ${student.first_name} ${student.last_name} has updated their profile details.`,
                    'info',
                    student._id,
                    'Student'
                );
            }
        }

        const updatedStudent = await student.save();
        res.json(updatedStudent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Upload/Update CV
// @route   POST /api/students/upload-cv
// @access  Private (Student)
const uploadCV = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Cloudinary returns the URL in req.file.path
        student.cv = req.file.path;
        await student.save();

        // Notify Coordinators
        const coordinators = await User.find({ role: 'coordinator' });
        for (const coordinator of coordinators) {
            await createNotification(
                coordinator._id,
                `Student ${student.first_name} ${student.last_name} has uploaded a new CV.`,
                'info',
                student._id,
                'Student'
            );
        }

        res.json({ message: 'CV uploaded successfully', cv: student.cv });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Upload/Update Profile Picture
// @route   POST /api/students/upload-picture
// @access  Private (Student)
const uploadProfilePicture = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Cloudinary returns the URL in req.file.path
        student.profile_picture = req.file.path;
        await student.save();

        res.json({ message: 'Profile picture uploaded successfully', profile_picture: student.profile_picture });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get student's applications
// @route   GET /api/students/applications
// @access  Private (Student)
const getApplications = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        const Application = require('../models/Application');
        const applications = await Application.find({ student: student._id })
            .populate('internship')
            .sort({ createdAt: -1 });

        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student status
// @route   GET /api/students/status
// @access  Private (Student)
const getStatus = async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });

        if (!student) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        res.json({ status: student.status });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Download selected CVs as ZIP
// @route   POST /api/students/download-cvs
// @access  Private (Coordinator/Admin)
const downloadCVs = async (req, res) => {
    const AdmZip = require('adm-zip');
    const axios = require('axios');
    const { studentIds } = req.body;

    try {
        let students;

        // If studentIds provided, fetch selected. Otherwise fetch ALL students with a CV.
        if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
            students = await Student.find({ _id: { $in: studentIds } });
        } else {
            // Fetch all students who have a CV uploaded
            students = await Student.find({ cv: { $exists: true, $ne: null } });
        }

        if (!students || students.length === 0) {
            return res.status(404).json({ message: 'No students with CVs found' });
        }

        const zip = new AdmZip();
        let count = 0;

        for (const student of students) {
            if (student.cv) {
                try {
                    // Check if it's a Cloudinary URL
                    if (student.cv.startsWith('http')) {
                        const response = await axios.get(student.cv, { responseType: 'arraybuffer' });
                        const filename = `${student.first_name}_${student.last_name}_${student.cb_number}.pdf`;
                        zip.addFile(filename, Buffer.from(response.data));
                        count++;
                    }
                } catch (err) {
                    console.error(`Error downloading CV for ${student.first_name}:`, err.message);
                }
            }
        }

        if (count === 0) {
            return res.status(404).json({ message: 'No valid CV files found to download' });
        }

        const downloadName = `InternHub_CVs_${Date.now()}.zip`;
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

// @desc    Delete student account
// @route   DELETE /api/students/profile
// @access  Private (Student)
const deleteAccount = async (req, res) => {
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user._id;
        const student = await Student.findOne({ user: userId });

        if (!student) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Student profile not found' });
        }

        const studentId = student._id;

        // Models to delete from
        const Application = require('../models/Application');
        const PlacementForm = require('../models/PlacementForm');
        const Logbook = require('../models/Logbook');
        const Marksheet = require('../models/Marksheet');
        const Presentation = require('../models/Presentation');
        const Notification = require('../models/Notification');

        // Delete all associated data
        await Application.deleteMany({ student: studentId }).session(session);
        await PlacementForm.deleteMany({ student: studentId }).session(session);
        await Logbook.deleteMany({ studentId: userId }).session(session); // Logbook uses User ID
        await Marksheet.deleteMany({ studentId: userId }).session(session); // Marksheet uses User ID
        await Presentation.deleteMany({ studentId: userId }).session(session); // Presentation uses User ID
        await Notification.deleteMany({ recipient: userId }).session(session);

        // Delete Student profile and User account
        await Student.deleteOne({ _id: studentId }).session(session);
        await User.deleteOne({ _id: userId }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Account and all associated data deleted successfully' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Account deletion error:', error);
        res.status(500).json({ message: 'Failed to delete account', error: error.message });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    uploadCV,
    uploadProfilePicture,
    getApplications,
    getStatus,
    downloadCVs,
    deleteAccount,
};
