const mongoose = require('mongoose');

const coordinatorSchema = mongoose.Schema({
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
    contact_number: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

const Coordinator = mongoose.model('Coordinator', coordinatorSchema);

module.exports = Coordinator;
