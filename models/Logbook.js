const mongoose = require('mongoose');

const LogbookSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student', // Changing to Student based on previous context, or User if strictly auth user. Checking... Student model usually wraps User or is distinct. The previous system used 'User' ref for studentId in some places but 'Student' is likely the specific profile. I'll stick to 'User' as the primary auth ID is usually used for ownership, consistent with other models viewed previously. PROCEEDING WITH 'User' as safest default for auth ID.
        ref: 'User',
        required: true
    },
    month: {
        type: Number,
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
        type: String,
        default: ""
    },
    mentorComments: {
        type: String,
        default: ""
    },
    rejectionReason: {
        type: String,
        default: ""
    },
    submittedDate: {
        type: Date,
        default: Date.now
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

// Ensure one logbook per month per student
LogbookSchema.index({ studentId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Logbook', LogbookSchema);
