const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');
const Student = require('./models/Student');
const PlacementForm = require('./models/PlacementForm');
const Logbook = require('./models/Logbook');
const logbookController = require('./controllers/logbookController');

// Load env vars
dotenv.config();

const runTest = async () => {
    try {
        console.log("Connecting to MongoDB...");
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) throw new Error("MONGO_URI is not defined in .env");
        await mongoose.connect(mongoUri);
        console.log("Connected.");

        const studentEmail = 'ramirunonis2006@gmail.com';
        const mentorEmail = 'dulainmu@gmail.com'; // Corrected from gmaiol
        const month = 1;
        const year = 2025;

        // 1. Find User
        let user = await User.findOne({ email: studentEmail });
        if (!user) {
            console.log("User not found, creating temp user...");
            user = await User.create({
                username: 'RamiruTest',
                email: studentEmail,
                password: 'password123',
                role: 'student'
            });
        }
        console.log("User ID:", user._id);

        // 2. Find Student Profile
        let student = await Student.findOne({ user: user._id });
        if (!student) {
            console.log("Student profile not found, creating...");
            student = await Student.create({
                user: user._id,
                first_name: 'Ramiru',
                last_name: 'Nonis',
                cb_number: 'CB000001',
                email: studentEmail
            });
        }
        console.log("Student Profile ID:", student._id);

        // 3. Update/Create Placement Form
        // We need to set the mentor email here because the controller looks HERE.
        let placement = await PlacementForm.findOne({ student: student._id });
        if (!placement) {
            console.log("Creating Placement Form...");
            placement = await PlacementForm.create({
                student: student._id,
                mentor_email: mentorEmail,
                company_name: "Test Corp",
                role: "Intern",
                start_date: new Date(),
                end_date: new Date()
            });
        } else {
            console.log("Updating Placement Form with Mentor Email...");
            placement.mentor_email = mentorEmail;
            await placement.save();
        }
        console.log("Placement Mentor Email set to:", placement.mentor_email);

        // 4. Create/Update Logbook with Random Data
        let logbook = await Logbook.findOne({ studentId: user._id, month, year });
        if (!logbook) {
            console.log("Creating Logbook...");
            logbook = new Logbook({
                studentId: user._id,
                month,
                year,
                status: 'Draft',
                weeks: []
            });
        }

        // Fill 4 weeks
        const randomData = () => ({
            activities: "Worked on " + Math.random().toString(36).substring(7),
            techSkills: "React, Node " + Math.floor(Math.random() * 100),
            softSkills: "Communication",
            trainings: "Safety Training " + Math.floor(Math.random() * 10)
        });

        logbook.weeks = [
            { weekNumber: 1, ...randomData() },
            { weekNumber: 2, ...randomData() },
            { weekNumber: 3, ...randomData() },
            { weekNumber: 4, ...randomData() }
        ];
        // Reset status to Draft so we can submit
        logbook.status = 'Draft';
        await logbook.save();
        console.log("Logbook populated with random data. ID:", logbook._id);

        // 5. Invoke Controller
        console.log("Invoking submitLogbook controller...");
        const req = {
            body: { logbookId: logbook._id.toString() },
            get: () => 'localhost:5000', // Mock host
            protocol: 'http',
            params: {}
        };

        const res = {
            status: function (code) {
                console.log(`[RES] Status: ${code}`);
                return this;
            },
            json: function (data) {
                console.log(`[RES] JSON:`, JSON.stringify(data, null, 2));
            },
            send: function (data) {
                console.log(`[RES] PROMPT:`, data);
            }
        };

        await logbookController.submitLogbook(req, res);

        console.log("Test Complete.");
        process.exit(0);

    } catch (error) {
        console.error("Test Failed:", error);
        process.exit(1);
    }
};

runTest();
