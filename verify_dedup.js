const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { getAllSubmissions } = require('./controllers/submissionController');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const mockRes = {
    status: (code) => ({
        json: (data) => {
            console.log(`Status: ${code}`);
            if (Array.isArray(data)) {
                console.log(`Total Submissions: ${data.length}`);
                const logbooks = data.filter(d => d.type === 'Logbook');
                console.log(`Total Logbooks: ${logbooks.length}`);

                const studentCounts = {};
                logbooks.forEach(l => {
                    const key = l.cbNumber || l.name;
                    studentCounts[key] = (studentCounts[key] || 0) + 1;
                });

                const duplicates = Object.entries(studentCounts).filter(([k, v]) => v > 1);
                if (duplicates.length > 0) {
                    console.log('Duplicates Found:', duplicates);
                } else {
                    console.log('No Duplicates Found per Student.');
                }
            } else {
                console.log('Response:', data);
            }
        }
    })
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    await getAllSubmissions({}, mockRes);
    await mongoose.disconnect();
};

run();
