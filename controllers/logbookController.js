const Logbook = require('../models/Logbook');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');
const Student = require('../models/Student');
const PlacementForm = require('../models/PlacementForm');

// Get Logbook for a specific month
exports.getLogbook = async (req, res) => {
    try {
        const { studentId, month, year } = req.query;

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

// Save Draft (Weekly Entry)
exports.saveLogbookEntry = async (req, res) => {
    try {
        const { studentId, month, year, weekNumber, data, mentorEmail } = req.body;

        if (!data) return res.status(400).json({ message: "No data provided" });

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const weekNum = parseInt(weekNumber);

        // Find or Create Logbook
        let logbook = await Logbook.findOne({ studentId, month: monthNum, year: yearNum });

        if (logbook) {
            if (logbook.status === 'Pending' || logbook.status === 'Approved') {
                return res.status(400).json({ message: "Cannot edit logbook while it is Pending or Approved." });
            }
        }

        if (!logbook) {
            // Create new draft
            logbook = new Logbook({
                studentId,
                month: monthNum,
                year: yearNum,
                status: 'Draft', // Default to Draft
                mentorEmail: mentorEmail || "", // Will be updated on submit or strictly passed
                weeks: []
            });
            // Override status to Draft locally if we want separate status? 
            // Requirement says: "Pending by default for the student and it should be stored in the logbook table... when student fills all four weeks... click get approval".
            // Actually, while editing it's effectively a draft. But let's stick to the user's flow: "stored... as summary".
        }

        // Requirements check: "When the student fills all four weeks... and click get approval... stored in logbook history... as pending".
        // This implies before that it's just saved data.

        // Upsert Week Data
        const weekIndex = logbook.weeks.findIndex(w => w.weekNumber === weekNum);

        const newWeekData = {
            weekNumber: weekNum,
            activities: data.activities || "",
            techSkills: data.techSkills || "",
            softSkills: data.softSkills || "",
            trainings: data.trainings || "",
            lastUpdated: Date.now()
        };

        if (weekIndex > -1) {
            logbook.weeks[weekIndex] = newWeekData;
        } else {
            logbook.weeks.push(newWeekData);
        }

        // Ensure mentor available if passed
        if (mentorEmail) logbook.mentorEmail = mentorEmail;

        await logbook.save();

        res.status(200).json({ message: "Entry saved", logbook });

    } catch (error) {
        console.error("Error saving logbook entry:", error);
        res.status(500).json({ message: "Error saving logbook entry", error: error.message });
    }
};

// Submit for Approval
exports.submitLogbook = async (req, res) => {
    try {
        console.log("[DEBUG] submitLogbook called with body:", req.body);
        let { logbookId } = req.body;
        let mentorEmail = null; // FORCE NULL: We will ONLY take it from the database below

        // STRICT: Always fetch from Placement Record to ensure source of truth
        console.log("[DEBUG] Fetching strictly from Placement Record for Logbook:", logbookId);

        const logbook = await Logbook.findById(logbookId).populate('studentId');
        if (!logbook) return res.status(404).json({ message: "Logbook not found" });

        // Logic to get Mentor Email from Placement Form
        const studentProfile = await Student.findOne({ user: logbook.studentId._id });

        if (studentProfile) {
            const placement = await PlacementForm.findOne({ student: studentProfile._id });
            if (placement && placement.mentor_email) {
                mentorEmail = placement.mentor_email;
                console.log("[DEBUG] Found Verified Mentor Email:", mentorEmail);
            } else {
                console.log("[DEBUG] Placement not found or no email for student:", studentProfile._id);
            }
        } else {
            console.log("[DEBUG] Student profile not found for user:", logbook.studentId._id);
        }

        if (!mentorEmail) {
            console.error("[DEBUG] Could not resolve mentorEmail from PlacementForm");
            return res.status(400).json({ message: "Mentor email not found. Please ensure your Placement Form is submitted and contains a mentor email." });
        }

        const studentName = studentProfile
            ? `${studentProfile.first_name} ${studentProfile.last_name}`
            : "Student";

        logbook.status = 'Pending';
        logbook.submittedDate = Date.now();
        logbook.mentorEmail = mentorEmail;
        await logbook.save();

        // Send Email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const approveLink = `${frontendUrl}/verify-logbook?id=${logbook._id}&status=Approved`;
        const rejectLink = `${frontendUrl}/verify-logbook?id=${logbook._id}&status=Rejected`;

        // Generate HTML Table
        const rows = logbook.weeks.sort((a, b) => a.weekNumber - b.weekNumber).map(w => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">Week ${w.weekNumber}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${w.activities || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${w.techSkills || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${w.softSkills || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${w.trainings || '-'}</td>
            </tr>
        `).join('');

        const message = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Logbook Approval Request</h2>
                <p><strong>Student:</strong> ${studentName}</p>
                <p><strong>Month:</strong> ${logbook.month} / ${logbook.year}</p>
                
                <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px;">Week</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Activities</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Tech Skills</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Soft Skills</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Trainings</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                
                <div style="margin-top: 30px;">
                    <p>Please review the entries above and select an action:</p>
                    <a href="${approveLink}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 15px; display: inline-block;">Approve Logbook</a>
                    <a href="${rejectLink}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reject Logbook</a>
                </div>
                <p style="margin-top: 20px; color: #666; font-size: 12px;">If rejected, the student will be notified to revise their entries.</p>
            </div>
        `;

        await sendEmail({
            email: mentorEmail,
            subject: `Logbook Approval Request - ${studentName}`,
            message,
            isHtml: true
        });

        res.status(200).json({ message: "Submitted successfully", logbook, mentorEmail });

    } catch (error) {
        console.error("Error submitting logbook:", error);
        // Send specific error message to frontend
        res.status(500).json({ message: `Submission failed: ${error.message}`, error: error.message });
    }
};

// Handle Mentor Action
exports.handleMentorActionLink = async (req, res) => {
    try {
        const { id, status } = req.params;
        if (!['Approved', 'Rejected'].includes(status)) return res.status(400).send("Invalid status");

        const logbook = await Logbook.findById(id);
        if (!logbook) return res.status(404).send("Logbook not found");

        logbook.status = status;
        await logbook.save();

        // Notify Student (In-App)
        await Notification.create({
            recipient: logbook.studentId,
            message: `Your logbook for Month ${logbook.month} was ${status} by your mentor.`,
            type: status === 'Approved' ? 'success' : 'error'
        });

        // Notify Student (Email)
        try {
            const studentUser = await User.findById(logbook.studentId);
            if (studentUser && studentUser.email) {
                await sendEmail({
                    email: studentUser.email,
                    subject: `Logbook ${status} by Mentor`,
                    message: `
                        <div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Logbook Update</h2>
                            <p>Your logbook for <strong>Month ${logbook.month} / ${logbook.year}</strong> has been <strong>${status}</strong> by your mentor.</p>
                            <p>Please check your dashboard for more details.</p>
                            ${status === 'Rejected' ? '<p>You may now edit your entries and resubmit.</p>' : ''}
                        </div>
                    `,
                    isHtml: true
                });
            }
        } catch (emailError) {
            console.error("Error sending student notification email:", emailError);
            // Don't fail the request if email fails, just log it
        }

        res.status(200).json({ message: `Logbook ${status} successfully`, status });

    } catch (error) {
        console.error("Action error:", error);
        res.status(500).send("Server Error");
    }
};

// Get Student History
exports.getHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        // Fetch all logbooks for this student that are NOT drafts? Or all? User said "logbook table record for that month should be saved in a separate page called logbook history... along with submitted date... pending by default".
        // This implies only submitted ones.
        const logbooks = await Logbook.find({ studentId }).sort({ year: 1, month: 1 });
        res.status(200).json(logbooks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching history', error: error.message });
    }
};
