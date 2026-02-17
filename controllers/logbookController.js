const Logbook = require('../models/Logbook');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
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
        if (status === 'Approved') {
            logbook.isIndustryApproved = true; // NEW: Set explicit approval flag
        } else if (status === 'Rejected' && rejectionReason) {
            logbook.rejectionReason = rejectionReason;
            logbook.isIndustryApproved = false;
        }

        // Add to audit log
        logbook.auditLog.push({
            action: status.toUpperCase(),
            user: 'Mentor',
            details: status === 'Rejected' ? `Reason: ${rejectionReason}` : 'Approved by mentor'
        });

        await logbook.save();
        console.log("[DEBUG] Logbook saved with new status");

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
        const jwt = require('jsonwebtoken');

        const logbook = await Logbook.findById(req.params.id);
        if (!logbook) return res.status(404).json({ message: 'Logbook not found' });

        const studentData = await Student.findOne({ user: logbook.studentId });
        if (!studentData) return res.status(404).json({ message: 'Student profile not found' });

        const { template } = req.query;

        // If a signed PDF exists, serve it (restricted access) - UNLESS template is requested
        if (logbook.signedPDFPath && template !== 'true') {
            // Manual verification of token since route is now public to allow mentor access to template
            let user = req.user;
            if (!user && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
                try {
                    const token = req.headers.authorization.split(' ')[1];
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    user = await User.findById(decoded.id).select('-password');
                } catch (err) {
                    console.error("[DEBUG] Token verification failed for signed logbook access:", err.message);
                }
            }

            if (!user) {
                console.error("[DEBUG] No user found for signed logbook access. Req.user:", req.user, "Headers:", req.headers.authorization ? "Present" : "Missing");
                return res.status(401).json({ message: "Authentication required to access signed logbooks." });
            }

            const isOwner = user._id.toString() === logbook.studentId.toString();
            const isAdminStaff = ['admin', 'coordinator', 'academic_mentor'].includes(user.role);

            console.log(`[DEBUG] access check - User: ${user._id}, Role: ${user.role}, isOwner: ${isOwner}, isAdminStaff: ${isAdminStaff}`);

            if (!isOwner && !isAdminStaff) {
                console.error(`[DEBUG] Authorization failed for user ${user._id} on logbook ${logbook._id}`);
                return res.status(403).json({ message: "Not authorized to access this signed logbook." });
            }

            // Check if it's a URL
            if (logbook.signedPDFPath.startsWith('http')) {
                let downloadUrl = logbook.signedPDFPath;

                // If it's Cloudinary, try to generate a signed URL for private assets
                if (logbook.signedPDFPath.includes('cloudinary.com')) {
                    try {
                        const parts = logbook.signedPDFPath.split('/upload/');
                        if (parts.length === 2) {
                            const versionAndId = parts[1];
                            const pathParts = versionAndId.split('/');
                            if (pathParts[0].startsWith('v')) pathParts.shift(); // remove version
                            const publicIdWithExt = pathParts.join('/');

                            const cloudinary = require('../config/cloudinary').cloudinary;
                            downloadUrl = cloudinary.url(publicIdWithExt, {
                                resource_type: 'raw', // Mostly PDFs are raw in this project
                                sign_url: true,
                                secure: true,
                                expires_at: Math.floor(Date.now() / 1000) + 3600
                            });
                            console.log("[DEBUG] Generated signed Cloudinary URL");
                        }
                    } catch (urlErr) {
                        console.warn("[DEBUG] Could not re-sign Cloudinary URL, using original:", logbook.signedPDFPath);
                    }
                }

                console.log(`[DEBUG] Proxying fetch to: ${downloadUrl}`);

                try {
                    const response = await axios({
                        method: 'get',
                        url: downloadUrl,
                        responseType: 'stream',
                        timeout: 10000 // 10s timeout
                    });

                    // Pass along important headers from the source if they exist
                    if (response.headers['content-type']) {
                        res.setHeader('Content-Type', response.headers['content-type']);
                    } else {
                        res.setHeader('Content-Type', 'application/pdf');
                    }

                    res.setHeader('Content-Disposition', `inline; filename="Signed_Logbook_${logbook.month}_${logbook.year}.pdf"`);

                    return response.data.pipe(res);
                } catch (proxyError) {
                    console.error("[DEBUG] Proxy fetch failed:", proxyError.message);
                    if (proxyError.response) {
                        console.error("[DEBUG] Cloudinary responded with status:", proxyError.response.status);
                    }
                    // Fallback to direct redirect only as a last resort (might hit CORS)
                    return res.redirect(logbook.signedPDFPath);
                }
            } else {
                // Local File
                const fullPath = path.isAbsolute(logbook.signedPDFPath)
                    ? logbook.signedPDFPath
                    : path.join(__dirname, '..', logbook.signedPDFPath); // Fix relative path resolution

                if (fs.existsSync(fullPath)) {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="Signed_Logbook_${studentData.cb_number || 'ST'}_Month_${logbook.month}.pdf"`);
                    return res.sendFile(fullPath);
                } else {
                    console.error(`[DEBUG] Local PDF file not found at: ${fullPath}`);
                    return res.status(404).json({ message: "Signed logbook file not found on server." });
                }
            }
        }

        // generateLogbookPDF(logbook, studentData, res);
        console.log("[DEBUG] Generating new PDF for logbook:", req.params.id);
        generateLogbookPDF(logbook, studentData, res);
    } catch (error) {
        console.error("Error generating/fetching PDF:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error processing PDF request', error: error.message });
        }
    }
};

// Consolidated Logbook PDF (Merge all monthly signed PDFs)
exports.getConsolidatedLogbook = async (req, res) => {
    try {
        const { studentId } = req.params;
        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        const studentProfile = await Student.findOne({ user: studentId });

        // 1. Find all approved logbooks with signed PDFs
        const logbooks = await Logbook.find({
            studentId: studentId,
            status: 'Approved',
            signedPDFPath: { $exists: true, $ne: "" }
        }).sort({ year: 1, month: 1 });

        if (logbooks.length === 0) {
            console.warn(`[DEBUG] No signed logbooks found for student ${studentId} during consolidation.`);
            return res.status(404).json({ message: "No signed logbooks found to consolidate." });
        }

        // 2. Prepare paths for merging
        const pdfPaths = logbooks.map(l => l.signedPDFPath);
        console.log(`[DEBUG] Attempting to merge ${pdfPaths.length} PDFs for student: ${studentId}. Paths:`, pdfPaths);

        // 3. Define temp output path
        const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(tempDir)) {
            console.log("[DEBUG] Creating temp directory for consolidation:", tempDir);
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileName = `Consolidated_Logbook_${studentProfile?.cb_number || 'Student'}_${Date.now()}.pdf`;
        const outputPath = path.join(tempDir, fileName);

        // 4. Merge
        console.log("[DEBUG] Calling mergePDFs utility...");
        const success = await mergePDFs(pdfPaths, outputPath);

        if (!success) {
            console.error("[DEBUG] mergePDFs returned false for student:", studentId);
            return res.status(500).json({ message: "Failed to merge logbook PDFs." });
        }

        // 5. Send file and cleanup
        console.log("[DEBUG] Merge successful, sending file:", outputPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Consolidated_Logbook.pdf"`);

        res.sendFile(outputPath, (err) => {
            if (err) {
                console.error("[DEBUG] Error sending consolidated PDF:", err);
            }
            // Cleanup temp file after sending
            fs.unlink(outputPath, (unlinkErr) => {
                if (unlinkErr) console.error("[DEBUG] Error deleting temp PDF:", unlinkErr);
            });
        });

    } catch (error) {
        console.error("Error consolidating logbooks:", error);
        res.status(500).json({ message: "Error consolidating logbooks", error: error.message });
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

        // Only allow upload if Pending (mentor phase)
        if (logbook.status !== 'Pending') {
            return res.status(400).json({ message: "Cannot upload PDF to a logbook that is not Pending." });
        }

        // Save path (handle local vs cloudinary)
        const filePath = req.file.path || req.file.secure_url;
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
