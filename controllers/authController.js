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
                // Handle file paths
                let cvPath = '';
                let profilePath = '';

                if (req.files && req.files.cv) {
                    // Cloudinary returns .path as the secure URL
                    // Local multer returns .path as the file system path
                    cvPath = req.files.cv[0].path;
                    // If local, we need to convert to a URL: "uploads/cv/filename.pdf"
                    if (process.env.STORAGE_TYPE === 'local') {
                        // Normalize path separators for Windows
                        cvPath = cvPath.replace(/\\/g, '/');
                        // Ensure it starts with uploads/ if not already (it should be)
                        if (!cvPath.startsWith('http')) {
                            cvPath = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/${cvPath}`;
                            // NOTE: Ideally server static files via a proper URL. 
                            // If server is on 5001, we want http://localhost:5001/uploads/...
                            // But let's check how headers are set. 
                            // Usually we just save the relative path 'uploads/cv/...' or the full server URL.
                            // For simplicity given existing logic likely expects a full URL if it was Cloudinary:
                            const serverUrl = `${req.protocol}://${req.get('host')}`;
                            cvPath = req.files.cv[0].path.replace(/\\/g, '/'); // uploads/cv/file.pdf
                            cvPath = `${serverUrl}/${cvPath}`;
                        }
                    }
                }

                if (req.files && req.files.profile_picture) {
                    profilePath = req.files.profile_picture[0].path;
                    if (process.env.STORAGE_TYPE === 'local') {
                        const serverUrl = `${req.protocol}://${req.get('host')}`;
                        let relativePath = req.files.profile_picture[0].path.replace(/\\/g, '/');
                        profilePath = `${serverUrl}/${relativePath}`;
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
                // Also optionally delete uploaded files here if local
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
