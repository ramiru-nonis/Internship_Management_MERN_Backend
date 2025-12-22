const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Student = require('./models/Student');
const PlacementForm = require('./models/PlacementForm');
const Logbook = require('./models/Logbook');

dotenv.config();

const debugData = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected.");

        const email = 'ramirunonis2006@gmail.com';
        console.log(`\n--- Debugging Data for: ${email} ---\n`);

        // 1. User
        const user = await User.findOne({ email });
        if (!user) {
            console.log("❌ User not found!");
            process.exit();
        }
        console.log(`✅ User Found: ID=${user._id}`);

        // 2. Student Profile
        const student = await Student.findOne({ user: user._id });
        if (!student) {
            console.log("❌ Student Profile not found!");
        } else {
            console.log(`✅ Student Profile Found: ID=${student._id}`);
        }

        // 3. Placement Form
        if (student) {
            const placement = await PlacementForm.findOne({ student: student._id });
            if (!placement) {
                console.log("❌ Placement Form not found!");
            } else {
                console.log(`✅ Placement Form Found: ID=${placement._id}`);
                console.log(`   👉 Mentor Email in Placement: '${placement.mentor_email}'`);
            }
        }

        // 4. Logbooks (Query by User ID)
        const logbooks = await Logbook.find({ studentId: user._id }).sort({ createdAt: -1 });
        console.log(`\nFound ${logbooks.length} Logbooks for this User:`);
        logbooks.forEach(lb => {
            console.log(`   - ID=${lb._id}`);
            console.log(`     Month=${lb.month}, Year=${lb.year}, Status=${lb.status}`);
            console.log(`     👉 Saved Mentor Email in Logbook: '${lb.mentorEmail}'`);
            console.log(`     Last Updated: ${lb.updatedAt}`);
        });

        console.log("\n--- End Debug ---");
        process.exit();

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

debugData();
