const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400).json({ message: 'User already exists' });
        return;
    }

    // If student, check CB number
    if (role === 'student' || !role) {
        const studentExists = await Student.findOne({ cb_number });
        if (studentExists) {
            res.status(400).json({ message: 'CB Number already registered' });
            return;
        }
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
                // Note: File uploads (CV, Profile Pic) will be handled separately or passed as paths
                // For now, we assume paths are sent or handled by middleware before this
                // Ideally, use multer middleware in the route

                await Student.create({
                    user: user._id,
                    cb_number,
                    first_name,
                    last_name,
                    contact_number,
                    degree,
                    degree_level,
                    availability,
                    cv: req.files && req.files.cv ? req.files.cv[0].path : '', // Multer
                    profile_picture: req.files && req.files.profile_picture ? req.files.profile_picture[0].path : '',
                    preferences: preferences ? JSON.parse(preferences) : [] // Expecting JSON string for array
                });
            } catch (error) {
                // Rollback user creation if student creation fails
                await User.findByIdAndDelete(user._id);
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
