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

    // 3. Count Approved Logbooks Only
    const approvedCount = await Logbook.countDocuments({
        studentId,
        status: 'Approved'
    });

    return approvedCount >= expectedMonths;
};

exports.uploadMarksheet = async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Enforce Logbook Completion
        const logbookComplete = await isLogbookRequirementsMet(studentId);
        if (!logbookComplete) {
            return res.status(403).json({ message: "Final submission not allowed. You must have logbook entries for your entire placement duration." });
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
            return res.status(403).json({ message: "Final submission not allowed. You must have logbook entries for your entire placement duration." });
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

        const PlacementForm = require('../models/PlacementForm');

        const logbooks = await Logbook.find({ status: { $ne: 'Draft' } })
            .populate('studentId')
            .sort({ submittedDate: -1, createdAt: -1 });
        // Fetch ALL submissions
        const allMarksheets = await Marksheet.find().populate('studentId').sort({ createdAt: -1 });
        const allPresentations = await Presentation.find().populate('studentId').sort({ createdAt: -1 });
        const allPlacements = await PlacementForm.find()
            .populate({
                path: 'student',
                populate: {
                    path: 'user',
                    select: 'email'
                }
            })
            .sort({ createdAt: -1 });

        // Extract User IDs to fetch Student Profiles for mapping
        const userIds = [
            ...logbooks.map(l => l.studentId?._id),
            ...allMarksheets.map(m => m.studentId?._id),
            ...allPresentations.map(p => p.studentId?._id),
            ...allPlacements.map(pl => pl.student?.user)
        ].filter(id => id);

        // Fetch Student Profiles
        const students = await Student.find({ user: { $in: userIds } });
        const studentMap = {};
        students.forEach(s => {
            if (s.user) studentMap[s.user.toString()] = s;
        });

        const mapSubmission = (item, type) => {
            let user = item.studentId;
            let student = null;

            if (type === 'Placements') {
                student = item.student;
                user = student?.user;
            } else {
                student = user ? studentMap[user._id.toString()] : null;
            }

            return {
                id: item._id,
                type: type,
                name: student ? `${student.first_name} ${student.last_name}` : (user?.username || "Unknown Student"),
                cbNumber: student?.cb_number || "N/A",
                profilePicture: student?.profile_picture || null,
                status: item.status || 'Submitted',
                date: item.submittedDate || item.createdAt || item.updatedAt, // Fallback to createdAt/updatedAt
                scheduledDate: item.scheduledDate || null,
                meetLink: item.meetLink || null,
                fileUrl: item.fileUrl,
                month: item.month ? `${MONTH_NAMES[item.month - 1]} ${item.year}` : undefined,
                logbookId: type === 'Logbook' ? item._id : undefined,
                studentId: user?._id || user, // Include user ID for history fetching
                // Additional fields for Placement Details
                placement: type === 'Placements' ? {
                    company_name: item.company_name,
                    position: item.position || item.placement_job_title,
                    start_date: item.start_date,
                    end_date: item.end_date,
                    mentor_name: item.mentor_name,
                    mentor_email: item.mentor_email,
                    mentor_phone: item.mentor_phone,
                    company_address: item.company_address,
                    description: item.description,
                    placement_job_title: item.placement_job_title,
                    contact_number: student?.contact_number,
                    email: student?.user?.email || item.email
                } : undefined
            };
        };

        const combined = [
            ...logbooks.map(l => mapSubmission(l, 'Logbook')),
            ...allMarksheets.map(m => mapSubmission(m, 'Marksheet')),
            ...allPresentations.map(p => mapSubmission(p, 'Exit Presentation')),
            ...allPlacements.map(pl => mapSubmission(pl, 'Placements'))
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
        const User = require('../models/User');
        const Notification = require('../models/Notification');
        const Marksheet = require('../models/Marksheet');
        const Presentation = require('../models/Presentation');
        const Student = require('../models/Student');
        const Logbook = require('../models/Logbook');
        const { mergePDFs } = require('../utils/pdfUtils');
        const { cloudinary } = require('../config/cloudinary');
        const path = require('path');
        const fs = require('fs');

        // 1. Verify that presentation exists
        const presentationCount = await Presentation.countDocuments({ studentId });
        if (presentationCount === 0) {
            return res.status(400).json({ message: 'Final presentation is required to complete the internship.' });
        }

        const student = await Student.findOne({ user: studentId });
        if (!student) return res.status(404).json({ message: 'Student not found' });

        // 2. Automatically submit any DRAFT logbooks
        await Logbook.updateMany(
            { studentId, status: 'Draft' },
            { $set: { status: 'Pending', submittedDate: Date.now() } }
        );

        // 3. GENERATE CONSOLIDATED LOGBOOK PDF
        console.log(`[DEBUG] Finalizing submission: Generating consolidated logbook for student ${studentId}`);
        const approvedLogbooks = await Logbook.find({
            studentId,
            status: 'Approved',
            signedPDFPath: { $exists: true, $ne: "" }
        }).sort({ year: 1, month: 1 });

        if (approvedLogbooks.length > 0) {
            const pdfPaths = approvedLogbooks.map(lb => lb.signedPDFPath);
            const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempFileName = `Final_Consolidated_${student.cb_number}_${Date.now()}.pdf`;
            const tempPath = path.join(tempDir, tempFileName);

            const mergeSuccess = await mergePDFs(pdfPaths, tempPath);
            if (mergeSuccess) {
                try {
                    console.log("[DEBUG] Uploading consolidated logbook to Cloudinary...");
                    const uploadResult = await cloudinary.uploader.upload(tempPath, {
                        folder: 'mern-internship-portal/final-logbooks',
                        resource_type: 'raw',
                        public_id: `Final_Logbook_${student.cb_number}_${Date.now()}`
                    });

                    student.finalConsolidatedLogbookUrl = uploadResult.secure_url;
                    console.log("[DEBUG] Consolidated logbook uploaded successfully:", uploadResult.secure_url);

                    // Deleting the temporary local file
                    fs.unlink(tempPath, (err) => {
                        if (err) console.error("[DEBUG] Error deleting temp consolidated file:", err);
                    });
                } catch (uploadErr) {
                    console.error("[DEBUG] Error uploading final logbook to Cloudinary:", uploadErr);
                }
            } else {
                console.error("[DEBUG] Failed to merge logbooks during final submission notify.");
            }
        } else {
            console.warn("[DEBUG] No approved logbooks found to consolidate during final notification.");
        }

        // 4. Notify Coordinator
        const coordinator = await User.findOne({ role: 'coordinator' });
        if (coordinator) {
            await Notification.create({
                recipient: coordinator._id,
                message: `Student ${student.first_name} ${student.last_name} (${student.cb_number}) has completed final submission. Consolidated logbook has been generated.`,
                type: 'success'
            });
        }

        // 5. Update Student Status to 'Completed'
        student.status = 'Completed';
        await student.save();

        res.status(200).json({
            message: 'Coordinator notified, consolidated logbook generated, and status updated to Completed.',
            finalLogbookUrl: student.finalConsolidatedLogbookUrl
        });
    } catch (error) {
        console.error("[DEBUG] Error in notifySubmission:", error);
        res.status(500).json({ message: 'Error notifying coordinator', error: error.message });
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

        // Fetch LATEST Marksheet (Student upload - only for file view/resubmit)
        const marksheet = await Marksheet.findOne({
            studentId,
            mentorId: { $exists: false }
        }).sort({ createdAt: -1 });

        // Fetch Official FINALIZED Marksheet (submitted by Mentor/Coordinator)
        const finalizedMarksheet = await Marksheet.findOne({
            studentId,
            mentorId: { $exists: true },
            isFinalized: true
        }).sort({ updatedAt: -1 });

        const marksheetCount = await Marksheet.countDocuments({
            studentId,
            mentorId: { $exists: false }
        });

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
            finalizedMarksheet: finalizedMarksheet || null,
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
        const { scheduledDate, meetLink } = req.body;

        if (!scheduledDate) {
            return res.status(400).json({ message: "Scheduled date is required." });
        }

        if (new Date(scheduledDate) < new Date()) {
            return res.status(400).json({ message: "Scheduled date must be in the future." });
        }

        const Presentation = require('../models/Presentation');
        const Notification = require('../models/Notification');
        const Student = require('../models/Student');
        const User = require('../models/User');
        const sendEmail = require('../utils/sendEmail');

        const presentation = await Presentation.findById(id);
        if (!presentation) {
            return res.status(404).json({ message: "Presentation not found." });
        }

        presentation.scheduledDate = scheduledDate;
        if (meetLink) presentation.meetLink = meetLink;
        await presentation.save();

        // Notify Student (In-App)
        const student = await Student.findOne({ user: presentation.studentId });
        const studentUser = await User.findById(presentation.studentId);

        if (student && student.user) {
            await Notification.create({
                recipient: student.user,
                message: `Presentation Scheduled: Your exit presentation has been scheduled for ${new Date(scheduledDate).toLocaleString()}.`,
                type: 'info'
            });
        }

        // Notify Student (Email)
        if (studentUser && studentUser.email) {
            const formattedDate = new Date(scheduledDate).toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            const formattedTime = new Date(scheduledDate).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
            });

            const emailMessage = `
                <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
                    <h2 style="color: #4f46e5;">Exit Presentation Scheduled</h2>
                    <p>Dear ${student ? student.first_name : 'Student'},</p>
                    <p>Your exit presentation has been scheduled by the coordinator. Please find the details below:</p>
                    
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Time:</strong> ${formattedTime}</p>
                        ${meetLink ? `<p><strong>Meeting Link:</strong> <a href="${meetLink}" style="color: #4f46e5; font-weight: bold;">Join Meeting</a></p>` : ''}
                    </div>

                    ${meetLink ? `<p>Please ensure you join the meeting on time via the link provided above.</p>` : '<p>The meeting details will be shared with you shortly or please check the dashboard for updates.</p>'}
                    
                    <p>Best regards,<br/>The Internship Coordination Team</p>
                </div>
            `;

            try {
                await sendEmail({
                    email: studentUser.email,
                    subject: 'Exit Presentation Scheduled',
                    message: emailMessage,
                    isHtml: true
                });
                console.log(`✅ Presentation invitation sent to: ${studentUser.email}`);
            } catch (emailError) {
                console.error("❌ Failed to send presentation invitation email to student:", emailError);
            }
        }

        // NEW: Notify Academic Mentor (Email)
        if (student && student.academic_mentor) {
            const AcademicMentor = require('../models/AcademicMentor');
            const mentor = await AcademicMentor.findById(student.academic_mentor);

            if (mentor && mentor.email) {
                const formattedDate = new Date(scheduledDate).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });
                const formattedTime = new Date(scheduledDate).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                });

                const mentorEmailMessage = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
                        <h2 style="color: #4f46e5;">Academic Mentoring: Presentation Scheduled</h2>
                        <p>Hello ${mentor.first_name},</p>
                        <p>An exit presentation has been scheduled for your assigned student, <strong>${student.first_name} ${student.last_name}</strong>. Please find the details below:</p>
                        
                        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Student:</strong> ${student.first_name} ${student.last_name} (${student.cb_number})</p>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${formattedTime}</p>
                            ${meetLink ? `<p><strong>Meeting Link:</strong> <a href="${meetLink}" style="color: #4f46e5; font-weight: bold;">Join Meeting</a></p>` : ''}
                        </div>

                        <p>Please join the session to evaluate the student's performance.</p>
                        
                        <p>Best regards,<br/>The Internship Coordination Team</p>
                    </div>
                `;

                try {
                    await sendEmail({
                        email: mentor.email,
                        subject: `Presentation Scheduled - ${student.first_name} ${student.last_name}`,
                        message: mentorEmailMessage,
                        isHtml: true
                    });
                    console.log(`✅ Presentation invitation sent to mentor: ${mentor.email}`);
                } catch (emailError) {
                    console.error("❌ Failed to send presentation invitation email to mentor:", emailError);
                }
            }
        }

        res.status(200).json({ message: "Presentation scheduled and invitation sent.", presentation });
    } catch (error) {
        console.error("Error scheduling presentation:", error);
        res.status(500).json({ message: "Failed to schedule presentation.", error });
    }
};

// Proxy/View Marksheet (Forces Inline)
exports.viewMarksheet = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query; // 'academic' (default) or 'industry'
        const Marksheet = require('../models/Marksheet');
        const axios = require('axios');

        const marksheet = await Marksheet.findById(id).populate('studentId');
        if (!marksheet) return res.status(404).json({ message: "Marksheet not found" });

        let fileUrl = marksheet.fileUrl;
        let label = "Marksheet";

        // Determine which file to serve
        if (type === 'industry') {
            fileUrl = marksheet.marks?.industryMarksheetUrl;
            label = "Industry_Evaluation";
            if (!fileUrl) return res.status(404).json({ message: "Industry marksheet not found" });
        } else {
            label = "Academic_Evaluation";
        }

        // 1. Handle Cloudinary URL
        if (fileUrl.startsWith('http')) {
            try {
                const response = await axios({
                    method: 'get',
                    url: fileUrl,
                    responseType: 'stream'
                });

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${label}_${id}.pdf"`);
                response.data.pipe(res);
            } catch (proxyError) {
                console.error("Proxy error:", proxyError.message);
                return res.redirect(fileUrl); // Fallback to direct link
            }
        }
        // 2. Handle Local File
        else {
            const cwd = process.cwd();
            // fileUrl might be "/uploads/marksheet/..."
            const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
            const fullPath = path.join(cwd, relativePath);

            if (fs.existsSync(fullPath)) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${label}_${id}.pdf"`);
                res.sendFile(fullPath);
            } else {
                return res.status(404).json({ message: "File not found on server" });
            }
        }
    } catch (error) {
        console.error("Error serving marksheet:", error);
        res.status(500).json({ message: "Error serving file" });
    }
};

// Proxy/View Presentation (Forces Inline)
exports.viewPresentation = async (req, res) => {
    try {
        const { id } = req.params;
        const Presentation = require('../models/Presentation');
        const axios = require('axios');

        const presentation = await Presentation.findById(id);
        if (!presentation) return res.status(404).json({ message: "Presentation not found" });

        const fileUrl = presentation.fileUrl;

        if (fileUrl.startsWith('http')) {
            try {
                const response = await axios({
                    method: 'get',
                    url: fileUrl,
                    responseType: 'stream'
                });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="Presentation_${id}.pdf"`);
                response.data.pipe(res);
            } catch (proxyError) {
                console.error("Proxy error:", proxyError.message);
                return res.redirect(fileUrl);
            }
        } else {
            const cwd = process.cwd();
            const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
            const fullPath = path.join(cwd, relativePath);

            if (fs.existsSync(fullPath)) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="Presentation_${id}.pdf"`);
                res.sendFile(fullPath);
            } else {
                return res.status(404).json({ message: "File not found on server" });
            }
        }
    } catch (error) {
        console.error("Error serving presentation:", error);
        res.status(500).json({ message: "Error serving file" });
    }
};

// Proxy/View CV (Forces Inline)
exports.viewCV = async (req, res) => {
    try {
        const { studentId } = req.params;
        const Student = require('../models/Student');
        const axios = require('axios');
        const path = require('path');
        const fs = require('fs');

        const student = await Student.findOne({ user: studentId });
        if (!student || !student.cv) return res.status(404).json({ message: "CV not found" });

        const fileUrl = student.cv;

        if (fileUrl.startsWith('http')) {
            try {
                const response = await axios({
                    method: 'get',
                    url: fileUrl,
                    responseType: 'stream'
                });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="CV_${student.first_name}_${student.last_name}.pdf"`);
                response.data.pipe(res);
            } catch (proxyError) {
                console.error("Proxy error:", proxyError.message);
                return res.redirect(fileUrl);
            }
        } else {
            const cwd = process.cwd();
            const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
            const fullPath = path.join(cwd, relativePath);

            if (fs.existsSync(fullPath)) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="CV_${student.first_name}_${student.last_name}.pdf"`);
                res.sendFile(fullPath);
            } else {
                return res.status(404).json({ message: "File not found on server" });
            }
        }
    } catch (error) {
        console.error("Error serving CV:", error);
        res.status(500).json({ message: "Error serving file" });
    }
};

