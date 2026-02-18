const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Student = require('./models/Student');

dotenv.config();

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const students = await Student.find({
            finalConsolidatedLogbookUrl: { $type: "string", $ne: "" }
        }).limit(20);

        console.log(`Found ${students.length} students with actual logbook URLs.`);

        if (students.length === 0) {
            console.log("No students found. Checking if any Student record exists at all...");
            const anyStudent = await Student.findOne();
            if (anyStudent) {
                console.log("At least one student exists:", anyStudent.first_name);
                console.log("Fields:", Object.keys(anyStudent.toObject()));
            } else {
                console.log("No students in DB.");
            }
        }

        for (const s of students) {
            console.log(`\n--- Student: ${s.first_name} ${s.last_name} (${s.cb_number}) ---`);
            console.log(`User ID: ${s.user}`);
            console.log(`URL: ${s.finalConsolidatedLogbookUrl}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

diagnose();
