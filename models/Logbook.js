const mongoose = require('mongoose');

const logbookSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    month: {
        type: Number, // 1, 2, 3, 4, 5, 6
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Pending', 'Approved', 'Rejected'],
        default: 'Draft'
    },
    mentorEmail: {
        type: String // Captured at submission time
    },
    submittedDate: {
        type: Date
    },
    feedback: {
        type: String
    },
    weeks: [{
        weekNumber: { type: Number, required: true },
        activities: { type: String, default: "" },
        techSkills: { type: String, default: "" },
        softSkills: { type: String, default: "" },
        trainings: { type: String, default: "" },
        lastUpdated: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Compound unique index to ensure one logbook per month per student
logbookSchema.index({ studentId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Logbook', logbookSchema);
