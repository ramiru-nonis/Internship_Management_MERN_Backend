require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');
const PlacementForm = require('./models/PlacementForm');

const audit = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB...");
        console.log("Fetching ALL Placement Forms...");

        const forms = await PlacementForm.find({}).populate('student');

        if (forms.length === 0) {
            console.log("No placement forms found in the database.");
        } else {
            console.log("\n--------------------------------------------------------------------------------");
            console.log(String("Student Name").padEnd(30) + " | " + String("Mentor Email (Stored in DB)").padEnd(40));
            console.log("--------------------------------------------------------------------------------");

            forms.forEach(f => {
                const name = f.student
                    ? `${f.student.first_name || ''} ${f.student.last_name || ''}`
                    : "Unknown Student";

                console.log(name.padEnd(30) + " | " + f.mentor_email);
            });
            console.log("--------------------------------------------------------------------------------\n");
            console.log("NOTE: This is the EXACT email address the student entered. The system sends to THIS address.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
};

audit();
