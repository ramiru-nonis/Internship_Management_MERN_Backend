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
    // Industry Mentor Marks (entered by Coordinator)
    industryMentorMarks: {
        type: Number,
        min: 0,
        max: 40,
        default: null
    },
    industryMentorComments: {
        type: String,
        default: null
    },
    finalMarks: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    finalMarkStatus: {
        type: String,
        enum: ['pending', 'submitted'],
        default: 'pending'
    },
    finalMarksSubmittedDate: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Marksheet', marksheetSchema);
