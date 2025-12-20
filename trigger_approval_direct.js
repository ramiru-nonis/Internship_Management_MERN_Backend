require('dotenv').config();
const mongoose = require('mongoose');
const Logbook = require('./models/Logbook');
const Student = require('./models/Student'); // Required for population
const PlacementForm = require('./models/PlacementForm'); // Required for population
const logbookController = require('./controllers/logbookController');

const trigger = async () => {
    try {
        console.log("1. Connecting to DB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("   Connected.");

        // 2. Find target Logbook
        const logbook = await Logbook.findOne().sort({ submittedDate: -1 });
        if (!logbook) {
            console.log("X  No logbook found.");
            process.exit(1);
        }
        console.log(`2. Target Logbook ID: ${logbook._id}`);

        // 3. Mock Req/Res
        const req = {
            body: {
                logbookId: logbook._id.toString()
            },
            protocol: 'http',
            get: () => 'localhost:5001' // Mock host for link generation
        };

        const res = {
            status: function (code) {
                console.log(`   [Controller Status]: ${code}`);
                return this;
            },
            json: function (data) {
                console.log(`   [Controller Response]:`, data);
                return this;
            },
            send: function (data) {
                console.log(`   [Controller Send]:`, data);
                return this;
            }
        };

        // 4. Run Controller Function
        console.log("3. Executing submitLogbook logic directly...");
        await logbookController.submitLogbook(req, res);

        console.log("\n✅ Execution Finished. If successful, email has been sent.");

    } catch (err) {
        console.error("Script Error:", err);
    } finally {
        // Give it a moment for email promise to clear if not awaited properly (controller does await it though)
        setTimeout(() => mongoose.disconnect(), 2000);
    }
};

trigger();
