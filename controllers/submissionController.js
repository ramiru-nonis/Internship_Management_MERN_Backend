const Marksheet = require('../models/Marksheet');
const Presentation = require('../models/Presentation');

const fs = require('fs');
const path = require('path');

exports.uploadMarksheet = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { studentId } = req.body;
        const fileUrl = `/uploads/marksheet/${req.file.filename}`;

        const marksheet = await Marksheet.create({
            studentId,
            fileUrl
        });

        res.status(201).json({ message: 'Marksheet uploaded', marksheet });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading marksheet', error });
    }
};

exports.uploadPresentation = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const { studentId } = req.body;
        const fileUrl = `/uploads/presentation/${req.file.filename}`;

        const presentation = await Presentation.create({
            studentId,
            fileUrl
        });

        res.status(201).json({ message: 'Presentation uploaded', presentation });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading presentation', error });
    }
};

exports.getAllSubmissions = async (req, res) => {
    try {
        const Student = require('../models/Student');

        // Logbook removed
        const marksheets = await Marksheet.find().populate('studentId');
        const presentations = await Presentation.find().populate('studentId');

        // Extract User IDs to fetch Student Profiles
        const userIds = [
            ...marksheets.map(m => m.studentId?._id),
            ...presentations.map(p => p.studentId?._id)
        ].filter(id => id);

        // Fetch Student Profiles
        const students = await Student.find({ user: { $in: userIds } });
        const studentMap = {};
        students.forEach(s => {
            if (s.user) studentMap[s.user.toString()] = s;
        });

        const mapSubmission = (item, type) => {
            const user = item.studentId;
            const student = user ? studentMap[user._id.toString()] : null;

            return {
                id: item._id,
                type: type,
                name: student ? `${student.first_name} ${student.last_name}` : (user?.username || "Unknown Student"),
                cbNumber: student?.cb_number || "N/A",
                profilePicture: student?.profile_picture || null,
                status: 'Submitted',
                date: item.submittedDate,
                fileUrl: item.fileUrl
            };
        };

        const combined = [
            ...marksheets.map(m => mapSubmission(m, 'Marksheet')),
            ...presentations.map(p => mapSubmission(p, 'Exit Presentation'))
        ];

        res.status(200).json(combined);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching submissions', error });
    }
};

exports.notifySubmission = async (req, res) => {
    try {
        const { studentId } = req.body;
        const User = require('../models/User'); // Lazy load or move to top
        const Notification = require('../models/Notification');

        const coordinator = await User.findOne({ role: 'coordinator' });
        if (coordinator) {
            await Notification.create({
                recipient: coordinator._id,
                message: `Student with ID ${studentId} has completed final submission (Marksheet & Presentation).`,
                type: 'success'
            });
        }

        // Update Student Status to 'Completed'
        const Student = require('../models/Student');
        const student = await Student.findOne({ user: studentId });
        if (student) {
            student.status = 'Completed';
            await student.save();
        }

        res.status(200).json({ message: 'Coordinator notified.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error notifying coordinator', error });
    }
};
