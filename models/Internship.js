const mongoose = require('mongoose');

const internshipSchema = mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    company_name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    requirements: {
        type: String,
        required: true,
    },
    posted_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    deadline: {
        type: Date,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    skills: [{
        type: String,
    }],
    location: {
        type: String,
        required: true,
    },
    company_logo: {
        type: String,
    },
    type: {
        type: String,
        enum: ['On-site', 'Remote', 'Hybrid'],
        required: true,
    },
    website: {
        type: String,
    },
    responsibilities: {
        type: String,
    },
    stipend: {
        type: String,
        enum: ['Paid', 'Unpaid'],
        required: true,
    },
    duration: {
        type: String,
        required: true,
    },
    employer_email: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'closed', 'expired'],
        default: 'active',
    },
}, {
    timestamps: true,
});

const Internship = mongoose.model('Internship', internshipSchema);

module.exports = Internship;
