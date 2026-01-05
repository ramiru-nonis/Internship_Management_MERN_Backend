const Marksheet = require('../models/Marksheet');
const Presentation = require('../models/Presentation');

const fs = require('fs');
const path = require('path');

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Helper: Check if all logbooks are approved
// Helper: Check if all logbooks are approved based on duration
const isLogbookRequirementsMet = async (studentId) => {
    const Logbook = require('../models/Logbook');
    const PlacementForm = require('../models/PlacementForm');
    const Student = require('../models/Student');

    // 1. Get Student Profile & Placement
    const studentProfile = await Student.findOne({ user: studentId });
    if (!studentProfile) return false;

    const placement = await PlacementForm.findOne({ student: studentProfile._id });
    if (!placement) return false;

    // 2. Calculate Expected Months
    const start = new Date(placement.start_date);
    const end = new Date(placement.end_date);
    let expectedMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    if (expectedMonths < 1) expectedMonths = 1;

    // 3. Count Approved Logbooks
    const logbooks = await Logbook.find({ studentId });
    const approvedCount = logbooks.filter(lb => lb.status === 'Approved').length;

    return approvedCount >= expectedMonths;
};

exports.uploadMarksheet = async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Enforce Logbook Completion
        const logbookComplete = await isLogbookRequirementsMet(studentId);
        if (!logbookComplete) {
            return res.status(403).json({ message: "Final submission not allowed. You must have Approved Logbooks for your entire placement duration." });
        }

        // Check attempt limit
        const existingCount = await Marksheet.countDocuments({ studentId });
        if (existingCount >= 3) {
            return res.status(403).json({ message: "Maximum submission attempts (3) reached for Marksheet." });
        }

        // Determine file URL based on storage type (Local vs Cloudinary)
        let fileUrl;
        if (req.file.path && (req.file.path.startsWith('http') || req.file.path.startsWith('https'))) {
            fileUrl = req.file.path;
        } else {
            fileUrl = `/uploads/marksheet/${req.file.filename}`;
        }

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
        const { studentId } = req.body;

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({ message: "Presentation must be a PDF file to enable offline viewing." });
        }


        // Enforce Logbook Completion
        const logbookComplete = await isLogbookRequirementsMet(studentId);
        if (!logbookComplete) {
            return res.status(403).json({ message: "Final submission not allowed. You must have Approved Logbooks for your entire placement duration." });
        }

        // Check attempt limit
        const existingCount = await Presentation.countDocuments({ studentId });
        if (existingCount >= 3) {
            return res.status(403).json({ message: "Maximum submission attempts (3) reached for Presentation." });
        }

        let fileUrl;
        if (req.file.path && (req.file.path.startsWith('http') || req.file.path.startsWith('https'))) {
            fileUrl = req.file.path;
        } else {
            fileUrl = `/uploads/presentation/${req.file.filename}`;
        }

        const User = require('../models/User'); // Lazy load
        const Notification = require('../models/Notification');
        const Student = require('../models/Student');

        const presentation = await Presentation.create({
            studentId,
            fileUrl
        });

        // Notify Coordinator
        const coordinator = await User.findOne({ role: 'coordinator' });
        const student = await Student.findOne({ user: studentId });

        if (coordinator && student) {
            await Notification.create({
                recipient: coordinator._id,
                message: `Student ${student.first_name} ${student.last_name} (${student.cb_number}) has uploaded their Final Exit Presentation (Attempt ${existingCount + 1}).`,
                type: 'info'
            });
        }

        res.status(201).json({ message: 'Presentation uploaded', presentation });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading presentation', error });
    }
};

exports.getAllSubmissions = async (req, res) => {
    try {
        const Student = require('../models/Student');
        const Logbook = require('../models/Logbook');

        const logbooks = await Logbook.find({ status: { $ne: 'Draft' } }).populate('studentId');
        // Fetch ALL submissions
        const allMarksheets = await Marksheet.find().populate('studentId').sort({ createdAt: -1 });
        const allPresentations = await Presentation.find().populate('studentId').sort({ createdAt: -1 });

        // Filter to keep only the LATEST submission per student for Marksheet & Presentation
        const latestMarksheets = [];
        const seenMarksheetStudents = new Set();
        for (const m of allMarksheets) {
            const sid = m.studentId?._id?.toString();
            if (sid && !seenMarksheetStudents.has(sid)) {
                latestMarksheets.push(m);
                seenMarksheetStudents.add(sid);
            }
        }

        const latestPresentations = [];
        const seenPresentationStudents = new Set();
        for (const p of allPresentations) {
            const sid = p.studentId?._id?.toString();
            if (sid && !seenPresentationStudents.has(sid)) {
                latestPresentations.push(p);
                seenPresentationStudents.add(sid);
            }
        }

        // Extract User IDs to fetch Student Profiles
        const userIds = [
            ...logbooks.map(l => l.studentId?._id),
            ...latestMarksheets.map(m => m.studentId?._id),
            ...latestPresentations.map(p => p.studentId?._id)
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
                status: item.status || 'Submitted',
                date: item.submittedDate || item.createdAt, // Fallback to createdAt
                scheduledDate: item.scheduledDate || null,
                fileUrl: item.fileUrl,
                month: item.month ? `${MONTH_NAMES[item.month - 1]} ${item.year}` : undefined,
                logbookId: type === 'Logbook' ? item._id : undefined,
                studentId: user?._id // Include user ID for history fetching
            };
        };

        // Deduplicate Logbooks: Show only the latest submission per student
        const uniqueLogbooks = [];
        const studentLogbookMap = new Map();

        logbooks.forEach(lb => {
            const sid = lb.studentId?._id?.toString();
            if (!sid) return;

            if (!studentLogbookMap.has(sid)) {
                studentLogbookMap.set(sid, lb);
            } else {
                // Check if current lb is newer than stored lb
                const stored = studentLogbookMap.get(sid);
                if (lb.year > stored.year || (lb.year === stored.year && lb.month > stored.month)) {
                    studentLogbookMap.set(sid, lb);
                }
            }
        });

        studentLogbookMap.forEach(lb => uniqueLogbooks.push(lb));

        const combined = [
            ...uniqueLogbooks.map(l => mapSubmission(l, 'Logbook')),
            ...latestMarksheets.map(m => mapSubmission(m, 'Marksheet')),
            ...latestPresentations.map(p => mapSubmission(p, 'Exit Presentation'))
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
        const Marksheet = require('../models/Marksheet');
        const Presentation = require('../models/Presentation');

        // Verify that both submissions exist (check for at least one of each)
        const marksheetCount = await Marksheet.countDocuments({ studentId });
        const presentationCount = await Presentation.countDocuments({ studentId });

        if (marksheetCount === 0 || presentationCount === 0) {
            return res.status(400).json({ message: 'Both marksheet and presentation are required to complete the internship.' });
        }

        const Student = require('../models/Student');
        const student = await Student.findOne({ user: studentId });

        const coordinator = await User.findOne({ role: 'coordinator' });
        if (coordinator && student) {
            await Notification.create({
                recipient: coordinator._id,
                message: `Student ${student.first_name} ${student.last_name} (${student.cb_number}) has completed final submission (Marksheet & Presentation).`,
                type: 'success'
            });
        }

        // Update Student Status to 'Completed'
        if (student) {
            student.status = 'Completed';
            await student.save();
        }

        res.status(200).json({ message: 'Coordinator notified and status updated to Completed.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error notifying coordinator', error });
    }
};

exports.getStudentSubmissions = async (req, res) => {
    try {
        const { studentId } = req.params;
        const Marksheet = require('../models/Marksheet');
        const Presentation = require('../models/Presentation');
        const Logbook = require('../models/Logbook');
        const PlacementForm = require('../models/PlacementForm');
        const Student = require('../models/Student');

        // Fetch LATEST Marksheet
        const marksheet = await Marksheet.findOne({ studentId }).sort({ createdAt: -1 });
        const marksheetCount = await Marksheet.countDocuments({ studentId });

        // Fetch LATEST Presentation
        const presentation = await Presentation.findOne({ studentId }).sort({ createdAt: -1 });
        const presentationCount = await Presentation.countDocuments({ studentId });

        // Check Logbook Status
        const logbooks = await Logbook.find({ studentId });
        const totalLogbooks = logbooks.length;
        const approvedLogbooks = logbooks.filter(lb => lb.status === 'Approved').length;

        // Calculate EXPECTED Logbooks
        let expectedTotal = 0;
        const studentProfile = await Student.findOne({ user: studentId });
        if (studentProfile) {
            const placement = await PlacementForm.findOne({ student: studentProfile._id });
            if (placement) {
                const start = new Date(placement.start_date);
                const end = new Date(placement.end_date);
                expectedTotal = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                if (expectedTotal < 1) expectedTotal = 1;
            }
        }

        const isLogbookComplete = approvedLogbooks >= expectedTotal && expectedTotal > 0;

        res.status(200).json({
            marksheet: marksheet || null,
            marksheetCount: marksheetCount,
            presentation: presentation || null,
            presentationCount: presentationCount,
            logbookStatus: {
                complete: isLogbookComplete,
                total: expectedTotal, // Send EXPECTED total to frontend
                approved: approvedLogbooks,
                actualTotal: totalLogbooks
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching student submissions', error });
    }
};

exports.schedulePresentation = async (req, res) => {
    try {
        const { id } = req.params;
        const { scheduledDate } = req.body;

        if (!scheduledDate) {
            return res.status(400).json({ message: "Scheduled date is required." });
        }

        const Presentation = require('../models/Presentation');
        const Notification = require('../models/Notification');
        const Student = require('../models/Student');

        const presentation = await Presentation.findById(id);
        if (!presentation) {
            return res.status(404).json({ message: "Presentation not found." });
        }

        presentation.scheduledDate = scheduledDate;
        await presentation.save();

        // Notify Student
        const student = await Student.findOne({ user: presentation.studentId });
        if (student && student.user) {
            await Notification.create({
                recipient: student.user,
                message: `Presentation Scheduled: Your exit presentation has been scheduled for ${new Date(scheduledDate).toLocaleString()}.`,
                type: 'info'
            });
        }

        res.status(200).json({ message: "Presentation scheduled successfully.", presentation });
    } catch (error) {
        console.error("Error scheduling presentation:", error);
        res.status(500).json({ message: "Failed to schedule presentation.", error });
    }
};

