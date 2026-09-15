const mongoose = require('mongoose');

const codingSessionSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        language: {
            type: String,
            required: [true, 'Programming language is required'],
            trim: true,
            maxlength: [50, 'Programming language cannot exceed 50 characters'],
        },
        minutes: {
            type: Number,
            required: [true, 'Coding duration is required'],
            min: [1, 'Coding duration must be at least one minute'],
            max: [1440, 'Coding duration cannot exceed 24 hours'],
        },
        date: {
            type: Date,
            required: [true, 'Session date is required'],
        },
        subject: {
            type: String,
            default: null,
            trim: true,
            maxlength: [160, 'Subject cannot exceed 160 characters'],
        },
        source: {
            type: String,
            enum: {
                values: ['timer', 'pomodoro', 'manual'],
                message: 'Session source must be timer, pomodoro, or manual',
            },
            default: 'manual',
        },
    },
    { timestamps: true }
);

codingSessionSchema.index({ owner: 1, date: -1, createdAt: -1 });

module.exports = mongoose.model('CodingSession', codingSessionSchema);
