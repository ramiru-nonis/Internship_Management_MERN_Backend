require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Logbook = require('./models/Logbook');

const runTest = async () => {
    try {
        // 1. Get a valid Logbook ID
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB to fetch ID...');

        // Find a recent logbook
        const logbook = await Logbook.findOne().sort({ createdAt: -1 });
        if (!logbook) {
            console.error('No logbook found to test with.');
            process.exit(1);
        }

        const logbookId = logbook._id.toString();
        const testEmail = 'ramirunonis2006@gmail.com'; // User's testing email

        console.log(`Testing API with Logbook ID: ${logbookId}`);
        console.log(`Target Email: ${testEmail}`);

        // 2. Hit the API
        const apiUrl = 'http://localhost:5001/api/logbooks/submit';
        console.log(`POSTing to ${apiUrl}...`);

        try {
            const response = await axios.post(apiUrl, {
                logbookId: logbookId,
                mentorEmail: testEmail
            });
            console.log('✅ API Response Status:', response.status);
            console.log('✅ API Response Data:', response.data);
        } catch (apiError) {
            console.error('❌ API Failed!');
            if (apiError.response) {
                console.error('Status:', apiError.response.status);
                console.error('Data:', apiError.response.data);
            } else if (apiError.request) {
                console.error('No response received. Possible causes: Server not running, Wrong Port, network issue.');
                console.error('Error Code:', apiError.code); // e.g., ECONNREFUSED
            } else {
                console.error('Error Message:', apiError.message);
            }
        }

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runTest();
