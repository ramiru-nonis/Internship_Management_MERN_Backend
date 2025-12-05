const Logbook = require('../models/Logbook');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');

// Get Logbook for a specific month
exports.getLogbook = async (req, res) => {
    try {
        const { studentId, month, year } = req.query;
        let logbook = await Logbook.findOne({ studentId, month, year });

        if (!logbook) {
            return res.status(200).json({ exists: false });
        }

        res.status(200).json({ exists: true, logbook });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching logbook', error });
    }
};

// Save Draft for a specific week
// Save Draft for a specific week
exports.saveLogbookEntry = async (req, res) => {
    try {
        const { studentId, month, year, weekNumber, data } = req.body;

        console.log("Saving logbook entry:", { studentId, month, year, weekNumber }); // Debug log

        let logbook = await Logbook.findOne({ studentId, month, year });

        if (!logbook) {
            logbook = new Logbook({
                studentId,
                month,
                year,
                weeks: [],
                status: 'Draft'
            });
        }

        const weekIndex = logbook.weeks.findIndex(w => w.weekNumber === weekNumber);
        if (weekIndex > -1) {
            // Update existing week
            logbook.weeks[weekIndex].activities = data.activities;
            logbook.weeks[weekIndex].techSkills = data.techSkills;
            logbook.weeks[weekIndex].softSkills = data.softSkills;
            logbook.weeks[weekIndex].trainings = data.trainings;
            logbook.weeks[weekIndex].lastUpdated = Date.now();
        } else {
            // Add new week
            logbook.weeks.push({
                weekNumber,
                activities: data.activities,
                techSkills: data.techSkills,
                softSkills: data.softSkills,
                trainings: data.trainings
            });
        }

        logbook.markModified('weeks');
        await logbook.save();


        res.status(200).json({ message: 'Logbook entry saved', logbook });
    } catch (error) {
        console.error("Error in saveLogbookEntry:", error); // Log the actual error
        res.status(500).json({ message: 'Error saving logbook', error: error.message });
    }
};

// Submit for Approval (Pending)
exports.submitLogbook = async (req, res) => {
    try {
        const { logbookId, mentorEmail } = req.body;

        const logbook = await Logbook.findById(logbookId);
        if (!logbook) return res.status(404).json({ message: 'Logbook not found' });

        logbook.status = 'Pending';
        logbook.submittedDate = Date.now();
        logbook.mentorEmail = mentorEmail;
        await logbook.save();

        // Send Email to Mentor
        try {
            const message = `
                Hello, 
                
                You have a new logbook submission (ID: ${logbook._id}) waiting for your approval.
                Please review it at your earliest convenience.
                
                Thank you.
            `;

            await sendEmail({
                email: mentorEmail,
                subject: 'New Logbook Submission for Approval',
                message
            });
            console.log(`Email sent to ${mentorEmail}`);
        } catch (emailError) {
            console.error('Email could not be sent', emailError);
        }

        res.status(200).json({ message: 'Logbook submitted for approval', logbook });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting logbook', error });
    }
};

// Get Student Logbook History (All months)
exports.getHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        const logbooks = await Logbook.find({ studentId }).sort({ year: 1, month: 1 });
        res.status(200).json(logbooks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching history', error });
    }
};

// Mentor Action (Approve/Reject)
exports.mentorAction = async (req, res) => {
    try {
        const { logbookId, status, feedback } = req.body;
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const logbook = await Logbook.findById(logbookId);
        if (!logbook) return res.status(404).json({ message: 'Logbook not found' });

        logbook.status = status;
        if (feedback) logbook.feedback = feedback;
        await logbook.save();

        res.status(200).json({ message: `Logbook ${status}`, logbook });
    } catch (error) {
        res.status(500).json({ message: 'Error processing mentor action', error });
    }
}

// Submit All Logbooks to Coordinator
exports.submitAllLogbooks = async (req, res) => {
    try {
        const { studentId } = req.body;

        const logbooks = await Logbook.find({ studentId });
        const allApproved = logbooks.every(l => l.status === 'Approved');

        if (!allApproved) {
            return res.status(400).json({ message: 'All logbooks must be approved before final submission.' });
        }

        await Logbook.updateMany({ studentId }, { submittedToCoordinator: true });

        const coordinator = await User.findOne({ role: 'coordinator' });
        if (coordinator) {
            await Notification.create({
                recipient: coordinator._id,
                message: `Student with ID ${studentId} has submitted all logbooks for review.`,
                type: 'info'
            });
        }

        res.status(200).json({ message: 'All logbooks submitted to coordinator successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting logbooks', error });
    }
};
