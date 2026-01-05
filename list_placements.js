require('dotenv').config();
const mongoose = require('mongoose');
const PlacementForm = require('./models/PlacementForm');

const listData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const placements = await PlacementForm.find({});
        console.log('\n--- Placement Forms ---');
        placements.forEach(p => {
            console.log(`Student ID (Profile): ${p.student}`);
            console.log(`Mentor Email: '${p.mentor_email}'`);
            console.log('------------------------');
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

listData();
