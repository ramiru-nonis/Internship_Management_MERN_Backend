require('dotenv').config();
const mongoose = require('mongoose');
const Logbook = require('./models/Logbook');
const Student = require('./models/Student');
const PlacementForm = require('./models/PlacementForm');

const updateEmail = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB...");

        // 1. Find the target Student/Logbook
        // We'll update for the most recent logbook user, as that's likely who is testing
        const logbook = await Logbook.findOne().sort({ submittedDate: -1 });

        if (!logbook) {
            console.log("No logbooks found to identify student.");
            process.exit(1);
        }

        const studentProfile = await Student.findOne({ user: logbook.studentId });
        if (!studentProfile) {
            console.log("Student profile not found.");
            process.exit(1);
        }

        console.log(`Updating Placement for Student: ${studentProfile.first_name} ${studentProfile.last_name}`);

        // 2. Update Placement Form
        const placement = await PlacementForm.findOne({ student: studentProfile._id });
        if (!placement) {
            console.log("Placement form not found.");
            process.exit(1);
        }

        console.log(`Current Email: ${placement.mentor_email}`);

        // REMOVING EMAIL (User Request)
        placement.mentor_email = '';
        await placement.save();

        console.log(`✅  UPDATED Mentor Email to: ${placement.mentor_email}`);
        console.log("Now the 'Get Approval' button will send to this address.");

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
};

updateEmail();
