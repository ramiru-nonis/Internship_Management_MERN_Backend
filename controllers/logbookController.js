const Logbook = require('../models/Logbook');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');

// Get Logbook for a specific month
exports.getLogbook = async (req, res) => {
    try {
        const { studentId, month, year } = req.query;

        // Find existing logbook
        const logbook = await Logbook.findOne({
            studentId,
            month: parseInt(month),
            year: parseInt(year)
        });

        if (!logbook) {
            return res.status(200).json({ exists: false });
        }

        res.status(200).json({ exists: true, logbook });
    } catch (error) {
        console.error("Error fetching logbook:", error);
        res.status(500).json({ message: 'Error fetching logbook', error: error.message });
    }
};

// Save Draft (Auto-save supported)
exports.saveLogbookEntry = async (req, res) => {
    try {
        const { studentId, month, year, weekNumber, data } = req.body;

        if (!data) return res.status(400).json({ message: "No data provided" });

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const weekNum = parseInt(weekNumber);

        // Find or Create Logbook
        let logbook = await Logbook.findOne({ studentId, month: monthNum, year: yearNum });

        if (!logbook) {
            logbook = new Logbook({
                studentId,
                month: monthNum,
                year: yearNum,
                status: 'Draft',
                weeks: []
            });
        }

        // Cannot edit if not Draft
        if (logbook.status !== 'Draft' && logbook.status !== 'Rejected') {
            return res.status(403).json({ message: "Cannot edit submitted logbook" });
        }

        // Update Week Data
        const weekIndex = logbook.weeks.findIndex(w => w.weekNumber === weekNum);

        if (weekIndex > -1) {
            // Update
            logbook.weeks[weekIndex].activities = data.activities || "";
            logbook.weeks[weekIndex].techSkills = data.techSkills || "";
            logbook.weeks[weekIndex].softSkills = data.softSkills || "";
            logbook.weeks[weekIndex].trainings = data.trainings || "";
            logbook.weeks[weekIndex].lastUpdated = Date.now();
        } else {
            // Add new
            logbook.weeks.push({
                weekNumber: weekNum,
                activities: data.activities || "",
                techSkills: data.techSkills || "",
                softSkills: data.softSkills || "",
                trainings: data.trainings || "",
                lastUpdated: Date.now()
            });
        }

        await logbook.save();
        res.status(200).json({ message: "Entry saved", logbook });

    } catch (error) {
        console.error("Error saving logbook entry:", error);
        res.status(500).json({ message: "Error saving logbook entry", error: error.message });
    }
};

// Submit Logbook for Approval
exports.submitLogbook = async (req, res) => {
    try {
        const { logbookId, mentorEmail } = req.body;

        const logbook = await Logbook.findById(logbookId).populate('studentId');
        if (!logbook) return res.status(404).json({ message: "Logbook not found" });

        // Basic Validation: Check if 4 weeks exist (optional, but good practice)
        // if (logbook.weeks.length < 4) return res.status(400).json({ message: "Incomplete logbook" });

        logbook.status = 'Pending';
        logbook.submittedDate = Date.now();
        logbook.mentorEmail = mentorEmail;
        await logbook.save();

        // ---------------- EMAIL LOGIC ---------------- //
        const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

        // Generate Table Rows
        // Sort weeks ensuring 1,2,3,4 order
        const sortedWeeks = logbook.weeks.sort((a, b) => a.weekNumber - b.weekNumber);

        let weeksRows = '';
        sortedWeeks.forEach(week => {
            weeksRows += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Week ${week.weekNumber}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${week.activities || '-'}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${week.techSkills || '-'}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${week.softSkills || '-'}</td>
                </tr>
            `;
        });

        const tableHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f8f9fa; text-align: left;">
                        <th style="padding: 10px; border: 1px solid #ddd;">Week</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Activities</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Tech Skills</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Soft Skills</th>
                    </tr>
                </thead>
                <tbody>${weeksRows}</tbody>
            </table>
        `;

        const approveLink = `${backendUrl}/api/logbooks/action/${logbook._id}/Approved`;
        const rejectLink = `${backendUrl}/api/logbooks/action/${logbook._id}/Rejected`;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Logbook Submission</h2>
                <p><strong>Student:</strong> ${logbook.studentId.firstName} ${logbook.studentId.lastName}</p>
                <p><strong>Month:</strong> ${logbook.month} / ${logbook.year}</p>
                
                ${tableHtml}

                <div style="margin-top: 30px; text-align: center;">
                    <a href="${approveLink}" style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 15px; font-weight: bold;">Approve</a>
                    <a href="${rejectLink}" style="background-color: #c0392b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reject</a>
                </div>
                
                <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">
                    Approval Links:<br>
                    Approve: ${approveLink}<br>
                    Reject: ${rejectLink}
                </p>
            </div>
        `;

        try {
            await sendEmail({
                email: mentorEmail,
                subject: `Logbook Approval - Month ${logbook.month}`,
                message: emailHtml,
                isHtml: true
            });
        } catch (err) {
            console.error("Email send failed:", err);
            // Don't fail the request, just log it
        }

        res.status(200).json({ message: "Submitted successfully", logbook });

    } catch (error) {
        console.error("Error submitting logbook:", error);
        res.status(500).json({ message: "Error submitting logbook", error: error.message });
    }
};

// Handle Mentor Action (Link Click)
exports.handleMentorActionLink = async (req, res) => {
    try {
        const { id, status } = req.params;

        if (!['Approved', 'Rejected'].includes(status)) return res.status(400).send("Invalid status");

        const logbook = await Logbook.findById(id);
        if (!logbook) return res.status(404).send("Logbook not found");

        logbook.status = status;
        await logbook.save();

        // Notify Student
        await Notification.create({
            recipient: logbook.studentId,
            message: `Your logbook for Month ${logbook.month} was ${status}.`,
            type: status === 'Approved' ? 'success' : 'alert'
        });

        res.send(`
            <div style="text-align: center; font-family: Arial; padding-top: 50px;">
                <h1 style="color: ${status === 'Approved' ? 'green' : 'red'}">Logbook ${status}</h1>
                <p>You can close this tab.</p>
            </div>
        `);

    } catch (error) {
        console.error("Action error:", error);
        res.status(500).send("Server Error");
    }
};

// Get History (All months for a student)
exports.getHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        const logbooks = await Logbook.find({ studentId }).sort({ year: 1, month: 1 });
        res.status(200).json(logbooks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching history', error: error.message });
    }
};

// Legacy/Other endpoints
exports.submitAllLogbooks = async (req, res) => {
    // Keep implementation empty or minimal if not currently used in new flow, or port over old logic
    res.status(200).json({ message: "Not required for new flow" });
};
exports.mentorAction = async (req, res) => { res.status(501).json({ message: "Use email links" }); };
