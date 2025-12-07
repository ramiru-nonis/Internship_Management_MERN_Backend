const Marksheet = require('../models/Marksheet');
const Presentation = require('../models/Presentation');
const Logbook = require('../models/Logbook');
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
        const logbooks = await Logbook.find({ submittedToCoordinator: true }).populate('studentId', 'firstName lastName cbNumber');
        const marksheets = await Marksheet.find().populate('studentId', 'firstName lastName cbNumber');
        const presentations = await Presentation.find().populate('studentId', 'firstName lastName cbNumber');

        const combined = [
            ...logbooks.map(l => ({
                id: l._id,
                type: 'Logbook',
                name: l.studentId ? `${l.studentId.firstName} ${l.studentId.lastName}` : "Unknown Student",
                cbNumber: l.studentId?.cbNumber || "N/A",
                month: l.month,
                status: l.status,
                date: l.updatedAt
            })),
            ...marksheets.map(m => ({
                id: m._id,
                type: 'Marksheet',
                name: m.studentId ? `${m.studentId.firstName} ${m.studentId.lastName}` : "Unknown Student",
                cbNumber: m.studentId?.cbNumber || "N/A",
                status: 'Submitted',
                date: m.submittedDate,
                fileUrl: m.fileUrl
            })),
            ...presentations.map(p => ({
                id: p._id,
                type: 'Exit Presentation',
                name: p.studentId ? `${p.studentId.firstName} ${p.studentId.lastName}` : "Unknown Student",
                cbNumber: p.studentId?.cbNumber || "N/A",
                status: 'Submitted',
                date: p.submittedDate,
                fileUrl: p.fileUrl
            }))
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

        res.status(200).json({ message: 'Coordinator notified.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error notifying coordinator', error });
    }
};
