const mongoose = require('mongoose');

const logbookSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    month: {
        type: String, // e.g., "January" or relative "Month 1"
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    weeks: [{
        weekNumber: { type: Number, required: true },
        activities: { type: String, default: "" },
        techSkills: { type: String, default: "" },
        softSkills: { type: String, default: "" },
        trainings: { type: String, default: "" },
        lastUpdated: { type: Date, default: Date.now }
    }],
    mentorEmail: {
        type: String,
        // required: true // Might be populated on submission
    },
    status: {
        type: String,
        enum: ['Draft', 'Pending', 'Approved', 'Rejected'],
        default: 'Draft'
    },
    submittedDate: {
        type: Date
    },
    submittedToCoordinator: {
        type: Boolean,
        default: false
    },
    feedback: {
        type: String // Mentor feedback if rejected
    }
}, { timestamps: true });

// Ensure unique logbook per student per month
logbookSchema.index({ studentId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Logbook', logbookSchema);
