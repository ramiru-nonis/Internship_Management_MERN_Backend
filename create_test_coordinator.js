const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Coordinator = require('./models/Coordinator');

dotenv.config();

const createTestCoordinator = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // Check if test user exists
        let user = await User.findOne({ email: 'test_coordinator@example.com' });
        if (user) {
            await User.deleteOne({ _id: user._id });
            await Coordinator.deleteOne({ user: user._id });
            console.log('Existing test user removed');
        }

        user = await User.create({
            email: 'test_coordinator@example.com',
            password: 'password123', // Will be hashed by pre-save hook
            role: 'coordinator',
        });

        await Coordinator.create({
            user: user._id,
            first_name: 'Test',
            last_name: 'Coordinator',
            contact_number: '0000000000',
        });

        console.log('Test Coordinator Created');
        console.log('Email: test_coordinator@example.com');
        console.log('Password: password123');

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

createTestCoordinator();
