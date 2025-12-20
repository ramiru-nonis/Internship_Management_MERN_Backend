require('dotenv').config();
const mongoose = require('mongoose');
const Logbook = require('./models/Logbook');
const Student = require('./models/Student');
const PlacementForm = require('./models/PlacementForm');

const verifyChain = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB...');

        // 1. Get a recent logbook
        const logbook = await Logbook.findOne().sort({ createdAt: -1 });
        if (!logbook) {
            console.log("No logbook found.");
            process.exit(1);
        }

        console.log("------------------------------------------------");
        console.log(`1. Found Logbook ID: ${logbook._id}`);
        console.log(`   Student User ID : ${logbook.studentId} (from logbook.studentId)`);

        // 2. Find Student Profile from User ID
        const studentProfile = await Student.findOne({ user: logbook.studentId });
        if (!studentProfile) {
            console.log("X  Student Profile NOT Found for this User ID!");
            process.exit(1);
        }

        console.log(`2. Found Student Profile ID: ${studentProfile._id}`);
        console.log(`   Student Name         : ${studentProfile.first_name} ${studentProfile.last_name}`);

        // 3. Find Placement Form from Student Profile ID
        const placement = await PlacementForm.findOne({ student: studentProfile._id });

        if (placement) {
            console.log(`3. Found PlacementForm ID: ${placement._id}`);
            console.log(`   Mentor Email (DB)     : ${placement.mentor_email}`);
            console.log("------------------------------------------------");
            console.log("✅ VERIFICATION SUCCESS: Data chain is complete.");
            console.log("   The code is designed to pick 'Mentor Email (DB)' exactly.");
        } else {
            console.log("X  PlacementForm NOT Found for this Student ID!");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
};

verifyChain();
