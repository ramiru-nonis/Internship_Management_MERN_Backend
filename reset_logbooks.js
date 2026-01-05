const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Logbook = require('./models/Logbook');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const resetLogbooks = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected.");

        // Update ALL logbooks to 'Draft'
        const result = await Logbook.updateMany(
            {},
            { $set: { status: 'Draft' } }
        );

        console.log(`✅ Reset ${result.modifiedCount} logbooks to 'Draft' status for ALL users.`);
        console.log("You can now go to the frontend and click 'Get Approval' again.");

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

resetLogbooks();
