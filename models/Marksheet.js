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
        required: false
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
        total: { type: Number, max: 60 },
        industryMarks: { type: Number, min: 0, max: 40 },
        finalTotal: { type: Number, min: 0, max: 100 }
    },
    isFinalized: {
        type: Boolean,
        default: false
    },
    comments: {
        technical: String,
        softSkills: String,
        presentation: String,
        finalComments: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Marksheet', marksheetSchema);
