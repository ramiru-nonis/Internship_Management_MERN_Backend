const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Coordinator = require('./models/Coordinator');

dotenv.config();

const cleanupTestCoordinator = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        let user = await User.findOne({ email: 'test_coordinator@example.com' });
        if (user) {
            await User.deleteOne({ _id: user._id });
            await Coordinator.deleteOne({ user: user._id });
            console.log('Test user removed');
        } else {
            console.log('Test user not found');
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

cleanupTestCoordinator();
