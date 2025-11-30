const mongoose = require('mongoose');

const notificationSchema = mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
    },
    read: {
        type: Boolean,
        default: false
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        // Can refer to Application, Internship, etc.
    },
    relatedModel: {
        type: String,
        // 'Application', 'Internship', etc.
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
