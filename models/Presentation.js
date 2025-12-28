const mongoose = require('mongoose');

const presentationSchema = new mongoose.Schema({
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
    },
    scheduledDate: {
        type: Date, // Valid when coordinator assigns time
    }
}, { timestamps: true });

module.exports = mongoose.model('Presentation', presentationSchema);
