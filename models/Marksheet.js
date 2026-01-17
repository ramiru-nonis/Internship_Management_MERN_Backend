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
    // Industry Mentor Marks (Coordinator Input)
    industryMentorMarks: {
        type: Number,
        min: 0,
        max: 40,
        default: 0
    },
    // Final Marks (Calculated: Academic Mentor Total + Industry Mentor Marks)
    finalMarks: {
        type: Number,
        default: 0
    },
    // Track if final marks have been submitted by coordinator
    finalMarksSubmitted: {
        type: Boolean,
        default: false
    },
    finalMarksSubmittedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Marksheet', marksheetSchema);
