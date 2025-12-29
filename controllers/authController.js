const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { createNotification } = require('./notificationController');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
};

const Student = require('../models/Student');

// @desc    Register a new user (Student)
// @route   POST /api/auth/register
// @access  Public
// @desc    Register a new user (Student)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const {
        email,
        password,
        role,
        // Student specific fields
        cb_number,
        first_name,
        last_name,
        contact_number,
        degree,
        degree_level,
        availability,
        preferences
    } = req.body;

    // Parallelize existence checks
    const checkUserPromise = User.findOne({ email });
    const checkStudentPromise = (role === 'student' || !role) ? Student.findOne({ cb_number }) : Promise.resolve(null);

    const [userExists, studentExists] = await Promise.all([checkUserPromise, checkStudentPromise]);

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    if (studentExists) {
        return res.status(400).json({ message: 'CB Number already registered' });
    }

    // Create User
    const user = await User.create({
        email,
        password,
        role: role || 'student',
    });

    if (user) {
        // If student, create Student profile
        if (user.role === 'student') {
            try {
                // Ensure files are present before proceeding
                if (!req.files || !req.files.cv) {
                    await User.findByIdAndDelete(user._id);
                    return res.status(400).json({ message: 'CV file is required.' });
                }

                // Handle file paths
                let cvPath = req.files.cv[0].path;
                let profilePath = '';

                // Normalize paths if using local storage
                if (process.env.STORAGE_TYPE === 'local') {
                    const serverUrl = `${req.protocol}://${req.get('host')}`;

                    // Normalize CV path
                    if (!cvPath.startsWith('http')) {
                        cvPath = cvPath.replace(/\\/g, '/');
                        cvPath = `${serverUrl}/${cvPath}`;
                    }

                    // Normalize Profile Picture path if exists
                    if (req.files.profile_picture) {
                        profilePath = req.files.profile_picture[0].path.replace(/\\/g, '/');
                        profilePath = `${serverUrl}/${profilePath}`;
                    }
                } else {
                    // Cloudinary or other storage (paths are already URLs)
                    if (req.files.profile_picture) {
                        profilePath = req.files.profile_picture[0].path;
                    }
                }

                await Student.create({
                    user: user._id,
                    cb_number,
                    first_name,
                    last_name,
                    contact_number,
                    degree,
                    degree_level,
                    availability,
                    cv: cvPath,
                    profile_picture: profilePath,
                    preferences: preferences ? JSON.parse(preferences) : []
                });

                // Send welcome notification reminding about placement form
                await createNotification(
                    user._id,
                    `Welcome to InternHub! Please submit your Industry Placement Form as soon as possible.`,
                    'info'
                );
            } catch (error) {
                // Rollback user creation if student creation fails
                await User.findByIdAndDelete(user._id);
                console.error("Registration Error:", error);
                res.status(400).json({ message: 'Invalid student data: ' + error.message });
                return;
            }
        }

        res.status(201).json({
            _id: user._id,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

module.exports = { loginUser, registerUser };
