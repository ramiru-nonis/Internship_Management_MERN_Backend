const mongoose = require('mongoose');

const studentSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    cb_number: {
        type: String,
        required: true,
        unique: true,
    },
    first_name: {
        type: String,
        required: true,
    },
    last_name: {
        type: String,
        required: true,
    },
    contact_number: {
        type: String,
        required: true,
    },
    degree: {
        type: String,
        required: true,
    },
    degree_level: {
        type: String,
        required: true,
    },
    availability: {
        type: String,
        enum: ['Full-Time', 'Part-Time'],
        required: true,
    },
    cv: {
        type: String, // Path to file
        required: true,
    },
    profile_picture: {
        type: String, // Path to file
    },
    preferences: [{
        type: String,
    }],
    batch: {
        type: String,
    },
    status: {
        type: String,
        enum: ['non-intern', 'intern', 'Completed', 'approved', 'hired', 'not hired'], // Expanded enum to support transition
        default: 'non-intern',
    },
}, {
    timestamps: true,
});

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
