const mongoose = require('mongoose');

const marksheetSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mentorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicMentor'
    },
    fileUrl: {
        type: String, // Relative path or URL
        required: true
    },
    submittedDate: {
        type: Date,
        default: Date.now
    },
    // Academic Mentor Specific Fields
    marks: {
        technical: { type: Number, min: 0, max: 20 },
        softSkills: { type: Number, min: 0, max: 20 },
        presentation: { type: Number, min: 0, max: 20 },
        total: { type: Number, max: 60 }
    },
    comments: {
        technical: String,
        softSkills: String,
        presentation: String
    },
    // Coordinator/Final Grading Fields
    industryMarks: {
        type: Number,
        min: 0,
        max: 40,
        default: 0
    },
    finalTotal: {
        type: Number,
        min: 0,
        max: 100
    },
    finalGradingStatus: {
        type: String,
        enum: ['Pending', 'Completed'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Marksheet', marksheetSchema);
