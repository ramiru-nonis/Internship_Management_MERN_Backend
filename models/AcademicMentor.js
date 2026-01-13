const mongoose = require('mongoose');

const academicMentorSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    first_name: {
        type: String,
        required: true,
    },
    last_name: {
        type: String,
        required: true,
    },
    email: { // redundant but good for quick access
        type: String,
        required: true,
        unique: true,
    },
    contact_number: {
        type: String,
    },
}, {
    timestamps: true,
});

const AcademicMentor = mongoose.model('AcademicMentor', academicMentorSchema);

module.exports = AcademicMentor;
