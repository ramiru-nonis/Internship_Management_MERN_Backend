const Logbook = require('../models/Logbook');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');
const Student = require('../models/Student');
const PlacementForm = require('../models/PlacementForm');
const { mergePDFs } = require('../utils/pdfUtils');
const path = require('path');
const fs = require('fs');
const axios = require('axios'); // Required for Cloudinary proxy

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

exports.getLogbookById = async (req, res) => {
    try {
        const logbook = await Logbook.findById(req.params.id).populate('studentId');
        if (!logbook) return res.status(404).json({ message: 'Logbook not found' });
        res.status(200).json(logbook);
    } catch (error) {
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

        // --- SEQUENTIAL LOGIC CHECK ---
        // If trying to save Month X (where X > 1), Month X-1 must be at least SUBMITTED (Pending or Approved)
        if (monthNum > 1) {
            const prevMonthLogbook = await Logbook.findOne({
                studentId,
                month: monthNum - 1,
                year: yearNum
            });

            // If previous month doesn't exist OR is still in Draft state, BLOCK this action.
            if (!prevMonthLogbook || prevMonthLogbook.status === 'Draft') {
                return res.status(400).json({
                    message: `You must submit Month ${monthNum - 1} before working on Month ${monthNum}.`
                });
            }
        }

        // Find or Create Logbook
        let logbook = await Logbook.findOne({ studentId, month: monthNum, year: yearNum });

        if (logbook) {
            if (logbook.status === 'Pending' || logbook.status === 'Approved') {
                return res.status(400).json({ message: "Cannot edit logbook while it is Pending or Approved." });
            }
        }

        if (!logbook) {
            // Create new draft
            if (weekNum > 1) {
                return res.status(400).json({ message: `You must fill Week 1 before working on Week ${weekNum}.` });
            }
            logbook = new Logbook({
                studentId,
                month: monthNum,
                year: yearNum,
                status: 'Draft', // Default to Draft
                mentorEmail: mentorEmail || "",
                weeks: [],
                auditLog: [] // Initialize audit log
            });
        }

        // --- WEEKLY SEQUENTIAL CHECK ---
        if (weekNum > 1) {
            // Check if all weeks from 1 to weekNum - 1 exist
            for (let i = 1; i < weekNum; i++) {
                const weekExists = logbook.weeks.some(w => w.weekNumber === i);
                if (!weekExists) {
                    return res.status(400).json({
                        message: `You must fill Week ${i} before working on Week ${weekNum}.`
                    });
                }
            }
        }

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
    let logbook;
    try {
        console.log("[DEBUG] submitLogbook called with body:", req.body);
        let { logbookId } = req.body;
        let mentorEmail = null;

        // STRICT: Always fetch from Placement Record to ensure source of truth
        console.log("[DEBUG] Fetching strictly from Placement Record for Logbook:", logbookId);

        logbook = await Logbook.findById(logbookId).populate('studentId');
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

        // 1. OPTIMISTIC UPDATE (Save as Pending first)
        logbook.status = 'Pending';
        logbook.submittedDate = Date.now();
        logbook.mentorEmail = mentorEmail;
        await logbook.save();

        // Send Email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const approveLink = `${frontendUrl}/verify-logbook/${logbook._id}?action=approve`;
        const rejectLink = `${frontendUrl}/verify-logbook/${logbook._id}?action=reject`;

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

        // Mail template

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

        try {
            await sendEmail({
                email: mentorEmail,
                subject: `Logbook Approval Request - ${studentName}`,
                message,
                isHtml: true
            });
            console.log("✅ Email sent successfully to mentor.");

            res.status(200).json({ message: "Submitted successfully", logbook, mentorEmail });

        } catch (emailError) {
            // 2. REVERT IF EMAIL FAILS
            console.error("❌ Email failed, reverting logbook status:", emailError);
            logbook.status = 'Draft'; // Revert
            await logbook.save();

            return res.status(500).json({
                message: "Failed to send email to mentor. Submission cancelled. Please try again.",
                error: emailError.message
            });
        }

    } catch (error) {
        console.error("Error submitting logbook:", error);
        // If we crashed before email try/catch, ensure we try to revert if possible (though logbook var might be void)
        if (logbook && logbook.status === 'Pending') {
            logbook.status = 'Draft';
            await logbook.save().catch(e => console.log("Failed to revert during crash recovery"));
        }
        res.status(500).json({ message: `Submission failed: ${error.message}`, error: error.message });
    }
};

// Handle Mentor Action
// Handle Mentor Action (Supports GET for legacy/backward compat, but mostly POST now)
exports.handleMentorActionLink = async (req, res) => {
    console.log("[DEBUG] handleMentorActionLink invoked");
    try {
        // Support both params (GET) and body (POST)
        const body = req.body || {};
        const id = req.params.id || body.logbookId;
        const status = req.body.status || req.params.status; // Prefer body for status in POST
        const feedback = body.feedback || "";
        const rejectionReason = body.rejectionReason || ""; // NEW: Capture rejection reason

        console.log(`[DEBUG] Params - ID: ${id}, Status: ${status}`);

        if (!id || !status) return res.status(400).json({ message: "Missing parameters" });
        if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: "Invalid status" });

        const logbook = await Logbook.findById(id);
        console.log("[DEBUG] Logbook found:", logbook ? "Yes" : "No");

        if (!logbook) return res.status(404).json({ message: "Logbook not found" });

        // Prevent modifying if already processed
        if (logbook.status !== 'Pending' && logbook.status !== 'Submitted') {
            // Allow update if it's just 'Submitted' (backward compat), but block if Approved/Rejected
            if (['Approved', 'Rejected'].includes(logbook.status)) {
                return res.status(400).json({ message: "You have already submitted this logbook." });
            }
        }

        logbook.status = status;
        if (feedback) logbook.mentorComments = feedback;
        if (status === 'Rejected' && rejectionReason) {
            logbook.rejectionReason = rejectionReason;
        }

        // Add to audit log
        logbook.auditLog.push({
            action: status.toUpperCase(),
            user: 'Mentor',
            details: status === 'Rejected' ? `Reason: ${rejectionReason}` : 'Approved by mentor'
        });

        await logbook.save();
        console.log("[DEBUG] Logbook saved with new status");

        // NEW: Check if all logbooks are approved to generate combined PDF
        if (status === 'Approved' && logbook.studentId) {
            try {
                const studentProfile = await Student.findOne({ user: logbook.studentId });
                const placement = await PlacementForm.findOne({ student: studentProfile?._id });

                if (studentProfile && placement) {
                    const start = new Date(placement.start_date);
                    const end = new Date(placement.end_date);
                    let expectedMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                    if (expectedMonths < 1) expectedMonths = 1;

                    const allLogbooks = await Logbook.find({ studentId: logbook.studentId });
                    const approvedLogbooks = allLogbooks.filter(lb => lb.status === 'Approved');

                    if (approvedLogbooks.length >= expectedMonths) {
                        console.log("[DEBUG] Logbook requirements met. Generating combined PDF...");
                        // Sort by year and month
                        approvedLogbooks.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

                        const pdfPaths = approvedLogbooks
                            .map(lb => lb.signedPDFPath)
                            .filter(p => p && p !== "");

                        if (pdfPaths.length > 0) {
                            const fileName = `Combined_Logbook_${studentProfile.cb_number}_${Date.now()}.pdf`;
                            const outputPath = path.join(__dirname, '..', 'uploads', 'combined_logbooks', fileName);

                            const success = await mergePDFs(pdfPaths, outputPath);
                            if (success) {
                                studentProfile.combinedLogbookUrl = `/uploads/combined_logbooks/${fileName}`;
                                await studentProfile.save();
                                console.log("[DEBUG] Combined PDF generated and student profile updated.");
                            }
                        }
                    }
                }
            } catch (mergeError) {
                console.error("[DEBUG] Combined PDF generation failed:", mergeError);
            }
        }

        // Notify Student (In-App)
        if (logbook.studentId) {
            console.log(`[DEBUG] Notifying student ID: ${logbook.studentId}`);
            try {
                await Notification.create({
                    recipient: logbook.studentId,
                    message: `Your logbook for Month ${logbook.month} was ${status} by your mentor.`,
                    type: status === 'Approved' ? 'success' : 'error'
                });
                console.log("[DEBUG] Notification created");
            } catch (notifError) {
                console.error("[DEBUG] Notification creation failed:", notifError);
            }
        } else {
            console.log("[DEBUG] No studentId in logbook, skipping notification");
        }

        // Notify Student (Email)
        try {
            console.log(`[DEBUG] Attempting to notify student logic for logbook: ${id}`);
            const studentUser = await User.findById(logbook.studentId);

            if (!studentUser) {
                console.log(`[DEBUG] Student User not found for ID: ${logbook.studentId}`);
            } else if (!studentUser.email) {
                console.log(`[DEBUG] Student User has no email. User: ${studentUser.username}`);
            } else {
                console.log(`[DEBUG] Sending notification to student email: ${studentUser.email}`);

                let feedbackHtml = '';
                if (feedback) {
                    feedbackHtml += `
                        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
                            <strong>Mentor Feedback:</strong><br/>
                            <p style="margin-top: 5px; font-style: italic;">"${feedback}"</p>
                        </div>
                    `;
                }
                if (status === 'Rejected' && rejectionReason) {
                    feedbackHtml += `
                        <div style="background-color: #fff5f5; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
                            <strong>Rejection Reason:</strong><br/>
                            <p style="margin-top: 5px; font-style: italic;">"${rejectionReason}"</p>
                        </div>
                    `;
                }

                await sendEmail({
                    email: studentUser.email,
                    subject: `Logbook ${status} by Mentor`,
                    message: `
                        <div style="font-family: Arial, sans-serif; padding: 20px;">
                            <h2>Logbook Update</h2>
                            <p>Your logbook for <strong>Month ${logbook.month} / ${logbook.year}</strong> has been <strong>${status}</strong> by your mentor.</p>
                            ${feedbackHtml}
                            <p>Please check your dashboard for more details.</p>
                            ${status === 'Rejected' ? '<p>You may now edit your entries and resubmit.</p>' : ''}
                        </div>
                    `,
                    isHtml: true
                });
                console.log("✅ Student notification email sent.");
            }
        } catch (emailError) {
            console.error("❌ Error sending student notification email:", emailError);
            // Don't fail the request if email fails, just log it
        }

        res.status(200).json({ message: `Logbook ${status} successfully`, status });

    } catch (error) {
        console.error("Action error stack:", error.stack);
        console.error("Action error:", error);
        res.status(500).json({ message: `Server Error: ${error.message} ` });
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

// Download Logbook PDF
exports.downloadLogbookPDF = async (req, res) => {
    try {
        const { generateLogbookPDF } = require('../utils/logbookTemplate');

        const logbook = await Logbook.findById(req.params.id);
        if (!logbook) return res.status(404).json({ message: 'Logbook not found' });

        const studentData = await Student.findOne({ user: logbook.studentId });
        if (!studentData) return res.status(404).json({ message: 'Student profile not found' });

        // If a signed PDF exists, serve it
        if (logbook.signedPDFPath) {
            // Check if it's a URL (Cloudinary)
            if (logbook.signedPDFPath.startsWith('http')) {
                console.log("[DEBUG] Proxying Cloudinary PDF:", logbook.signedPDFPath);
                // Proxy the file from Cloudinary 
                try {
                    const response = await axios({
                        method: 'get',
                        url: logbook.signedPDFPath,
                        responseType: 'stream',
                        timeout: 10000 // 10s timeout
                    });

                    // Set headers
                    res.setHeader('Content-Type', 'application/pdf');
                    // "inline" allows viewing in browser/iframe
                    res.setHeader('Content-Disposition', `inline; filename="Signed_Logbook_${studentData.cb_number}_Month_${logbook.month}.pdf"`);

                    response.data.pipe(res);
                    return;
                } catch (proxyError) {
                    console.error("Error proxying PDF from Cloudinary:", proxyError.message);
                    if (proxyError.response) {
                        console.error("Cloudinary Response Status:", proxyError.response.status);
                    }
                    // DO NOT redirect to the failing URL. Return error to client.
                    return res.status(502).json({
                        message: "Failed to retrieve signed logbook from cloud storage.",
                        detail: proxyError.message
                    });
                }
            } else {
                // If it's a local file path
                const fullPath = path.isAbsolute(logbook.signedPDFPath)
                    ? logbook.signedPDFPath
                    : path.join(__dirname, '..', logbook.signedPDFPath);

                if (fs.existsSync(fullPath)) {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="Signed_Logbook_${studentData.cb_number}_Month_${logbook.month}.pdf"`);
                    return res.sendFile(fullPath);
                } else {
                    console.error("Local file missing:", fullPath);
                    return res.status(404).json({ message: "Signed logbook file not found on server." });
                }
            }
        }

        // Fallback: Generate PDF from data if no signed PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Logbook_${studentData.cb_number}_Month_${logbook.month}.pdf`);

        generateLogbookPDF(logbook, studentData, res);
    } catch (error) {
        console.error("Error generating/fetching PDF:", error);
        res.status(500).json({ message: 'Error processing PDF request', error: error.message });
    }
};

// Upload Signed Logbook
exports.uploadSignedLogbook = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const logbook = await Logbook.findById(id);
        if (!logbook) {
            return res.status(404).json({ message: "Logbook not found" });
        }

        // Save path (handle local vs cloudinary)
        const rawPath = req.file.path || req.file.secure_url;
        const filePath = rawPath.replace(/\\/g, '/');
        logbook.signedPDFPath = filePath;

        // Add to audit log
        logbook.auditLog.push({
            action: 'PDF_UPLOADED',
            user: 'Mentor',
            details: `Signed PDF uploaded: ${req.file.originalname || 'file'}`
        });

        await logbook.save();

        res.status(200).json({
            message: "Signed logbook uploaded successfully",
            signedPDFPath: filePath
        });
    } catch (error) {
        console.error("Error uploading signed logbook:", error);
        res.status(500).json({ message: "Error uploading signed logbook", error: error.message });
    }
};
