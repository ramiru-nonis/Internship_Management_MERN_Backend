const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Logbook = require('./models/Logbook');

dotenv.config();

const resetLogbooks = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected.");

        const email = 'ramirunonis2006@gmail.com';
        console.log(`Resetting logbooks for: ${email}`);

        const user = await User.findOne({ email });
        if (!user) {
            console.log("User not found");
            process.exit(1);
        }

        // Update all logbooks for this user to 'Draft'
        const result = await Logbook.updateMany(
            { studentId: user._id },
            { $set: { status: 'Draft' } }
        );

        console.log(`✅ Reset ${result.modifiedCount} logbooks to 'Draft' status.`);
        console.log("You can now go to the frontend and click 'Get Approval' again.");

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

resetLogbooks();
