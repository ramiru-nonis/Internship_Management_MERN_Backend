require('dotenv').config();
const mongoose = require('mongoose');
const Logbook = require('./models/Logbook');
const Student = require('./models/Student');
const PlacementForm = require('./models/PlacementForm');
const sendEmail = require('./utils/sendEmail');

const diagnose = async () => {
    try {
        console.log("1. Connecting to DB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("   Connected.");

        // 1. Find the most recent 'Pending' or 'Draft' logbook to see who we are dealing with
        const logbook = await Logbook.findOne().sort({ submittedDate: -1 }); // Get most recently submitted
        if (!logbook) {
            console.log("X  No logbooks found at all.");
            process.exit(1);
        }

        console.log("--------------------------------------------------");
        console.log(`2. Inspecting Logbook: ${logbook._id}`);
        console.log(`   Status: ${logbook.status}`);
        console.log(`   Student User ID: ${logbook.studentId}`);
        console.log(`   Submitted Date: ${logbook.submittedDate}`);

        // 2. Find Student
        const studentProfile = await Student.findOne({ user: logbook.studentId });
        if (!studentProfile) {
            console.log("X  Student Profile NOT Found.");
            process.exit(1);
        }
        console.log(`3. Student: ${studentProfile.first_name} ${studentProfile.last_name}`);

        // 3. Find Placement
        const placement = await PlacementForm.findOne({ student: studentProfile._id });
        if (!placement) {
            console.log("X  PlacementForm NOT Found.");
            console.log("   Therefore, NO MENTOR EMAIL can be found.");
            process.exit(1);
        }

        const dbEmail = placement.mentor_email;
        console.log(`4. PlacementForm ID: ${placement._id}`);
        console.log(`   MENTOR EMAIL (in DB): '${dbEmail}'`);

        if (!dbEmail) {
            console.log("X  Mentor Email field is EMPTY in the database!");
            process.exit(1);
        }

        // 4. Test Sending Email
        console.log("--------------------------------------------------");
        console.log(`5. Attempting to send TEST email to: ${dbEmail}`);
        console.log("   Using credentials from .env...");

        try {
            await sendEmail({
                email: dbEmail,
                subject: "Diagnostic Test Email - Intern System",
                message: "<h1>Pass</h1><p>This is a test to verify your email address is receiving mail from the system.</p>",
                isHtml: true
            });
            console.log("✅ SUCCESS: Email sent successfully via Nodemailer.");
            console.log("   If you don't see it, check SPAM.");
        } catch (emailErr) {
            console.error("X  FAILED to send email:");
            console.error(emailErr);
        }

    } catch (err) {
        console.error("Script Error:", err);
    } finally {
        await mongoose.disconnect();
    }
};

diagnose();
