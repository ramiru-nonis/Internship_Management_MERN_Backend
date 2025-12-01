const mongoose = require('mongoose');

const applicationSchema = mongoose.Schema({
    internship: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Internship',
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Student',
    },
    status: {
        type: String,
        enum: ['Applied', 'Reviewed', 'Accepted', 'Rejected', 'Shortlisted', 'Contacted', 'Sent to Company'],
        default: 'Applied',
    },
    apply_type: {
        type: String,
        enum: ['profile', 'custom_cv'],
        required: true,
        default: 'profile',
    },
    cv: {
        type: String, // Path to application-specific CV
    },
    notes: {
        type: String, // Coordinator comments
    },
}, {
    timestamps: true,
});

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
