const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Internship = require('./models/Internship');
const Application = require('./models/Application');

dotenv.config();

const verify = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        const userCount = await User.countDocuments();
        const internshipCount = await Internship.countDocuments();
        const applicationCount = await Application.countDocuments();

        console.log(`Users: ${userCount}`);
        console.log(`Internships: ${internshipCount}`);
        console.log(`Applications: ${applicationCount}`);

        const internship = await Internship.findOne();
        if (internship) {
            console.log('Sample Internship:', JSON.stringify(internship, null, 2));
        }

        // Generate Token for the first user
        const user = await User.findOne();
        if (user) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: '30d',
            });
            console.log('Test Token:', token);
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

verify();
