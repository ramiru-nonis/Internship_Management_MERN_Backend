require('dotenv').config();
const mongoose = require('mongoose');
const Logbook = require('./models/Logbook');
const Student = require('./models/Student');
const PlacementForm = require('./models/PlacementForm');
const sendEmail = require('./utils/sendEmail');

const testFlow = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // 1. Find a valid Logbook to test (one with a studentId)
        console.log('Finding a recent logbook...');
        const logbook = await Logbook.findOne().sort({ createdAt: -1 });

        if (!logbook) {
            console.error('❌ No logbooks found to test with.');
            return;
        }

        console.log(`Testing with Logbook ID: ${logbook._id}`);
        console.log(`Student User ID from Logbook: ${logbook.studentId}`);

        // 2. Simulate the FIXED logic from logbookController.js
        let mentorEmail = logbook.mentorEmail;
        console.log(`Initial Mentor Email on Logbook: ${mentorEmail || 'NULL'}`);

        if (!mentorEmail) {
            console.log('Simulating Fallback Lookup...');

            // Step A: Find Student Profile using User ID
            const studentProfile = await Student.findOne({ user: logbook.studentId });

            if (studentProfile) {
                console.log(`✅ Found Student Profile: ${studentProfile._id} (${studentProfile.first_name})`);

                // Step B: Find Placement using Student Profile ID
                const placement = await PlacementForm.findOne({ student: studentProfile._id });

                if (placement) {
                    console.log(`✅ Found Placement Record. Mentor Email: ${placement.mentor_email}`);
                    mentorEmail = placement.mentor_email;
                } else {
                    console.error('❌ Placement form not found for this student.');
                }
            } else {
                console.error('❌ Student Profile not found for this User ID.');
            }
        }

        // 3. Attempt Send
        if (mentorEmail) {
            console.log(`[DEBUG] Final Mentor Email to use: ${mentorEmail}`);
            // Explicitly force to user's email for safety if needed, but let's try the real one or a safe test
            // mentorEmail = 'ramirunonis2006@gmail.com'; // Uncomment to override for safety during heavy testing

            try {
                await sendEmail({
                    email: mentorEmail,
                    subject: 'VERIFICATION: Logbook Approval Test',
                    message: 'This is a verification email from the test_logbook_approval.js script.',
                    isHtml: false
                });
                console.log(`✅ Message sent successfully to ${mentorEmail}`);
            } catch (e) {
                console.error('❌ Send failed:', e.message);
            }
        } else {
            console.error('❌ Could not resolve a mentor email.');
        }

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

testFlow();
