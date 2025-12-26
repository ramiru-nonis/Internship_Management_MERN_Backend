const mongoose = require('mongoose');

const marksheetSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileUrl: {
        type: String, // Relative path or URL
        required: true
    },
    submittedDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Marksheet', marksheetSchema);
