const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};

const coordinator = (req, res, next) => {
    if (req.user && (req.user.role === 'coordinator' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a coordinator' });
    }
};

const student = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a student' });
    }
};

module.exports = { protect, admin, coordinator, student };

