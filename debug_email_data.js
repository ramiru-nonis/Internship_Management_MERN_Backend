require('dotenv').config();
const mongoose = require('mongoose');
const PlacementForm = require('./models/PlacementForm');
const sendEmail = require('./utils/sendEmail');

const debug = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const placements = await PlacementForm.find({}).populate('student');
        console.log(`Found ${placements.length} placement records.`);

        for (const p of placements) {
            console.log(`\nStudent: ${p.full_name} (${p.student_id_number})`);
            console.log(`Mentor: ${p.mentor_name}`);
            console.log(`Mentor Email: ${p.mentor_email}`);

            if (p.mentor_email) {
                console.log(`Attempting to send test email to: ${p.mentor_email}`);
                try {
                    await sendEmail({
                        email: p.mentor_email,
                        subject: 'Debug Test Email from Application',
                        message: 'This is a test email to verify the address stored in the database works.',
                        isHtml: false
                    });
                    console.log('✅ Email sent successfully!');
                } catch (e) {
                    console.error('❌ Failed to send email:', e.message);
                }
            } else {
                console.warn('⚠️ No mentor email found for this record.');
            }
        }

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

debug();
