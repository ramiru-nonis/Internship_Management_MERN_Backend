const mongoose = require('mongoose');

const placementFormSchema = mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true, // One submission per student
        ref: 'Student',
    },
    company_name: {
        type: String,
        required: true,
    },
    position: {
        type: String,
        required: true,
    },
    start_date: {
        type: Date,
        required: true,
    },
    end_date: {
        type: Date,
        required: true,
    },

    description: {
        type: String,
        required: true,
    },
    full_name: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String, required: true },
    student_id_number: { type: String, required: true },
    batch_code: { type: String, required: true },
    has_visa: { type: String, enum: ['yes', 'no'], required: true },
    award_title: { type: String, required: true },
    emergency_contact: { type: Number, required: true },
    emergency_relationship: { type: String, required: true },
    company_address: { type: String, required: true },
    company_phone: { type: String, required: true },
    company_email: { type: String, required: true },
    placement_job_title: { type: String, required: true },
    placement_job_role: { type: String, required: true },
    mentor_name: { type: String, required: true },
    mentor_phone: { type: String, required: true },
    mentor_email: { type: String, required: true },
    submitted: {
        type: Boolean,
        default: true,
    },
    submittedDate: {
        type: Date,
        default: Date.now,
    },
    oneMonthNotificationSent: {
        type: Boolean,
        default: false,
    },
    twoWeekNotificationSent: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

const PlacementForm = mongoose.model('PlacementForm', placementFormSchema);

module.exports = PlacementForm;
