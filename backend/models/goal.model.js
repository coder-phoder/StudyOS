const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        text: {
            type: String,
            required: [true, 'Goal text is required'],
            trim: true,
            maxlength: [300, 'Goal text cannot exceed 300 characters'],
        },
        targetCgpa: {
            type: Number,
            min: [0, 'Target CGPA cannot be less than 0'],
            max: [10, 'Target CGPA cannot exceed 10'],
            default: null,
        },
        currentCgpa: {
            type: Number,
            min: [0, 'Current CGPA cannot be less than 0'],
            max: [10, 'Current CGPA cannot exceed 10'],
            default: null,
        },
        targetDate: {
            type: Date,
            default: null,
        },
        completed: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

goalSchema.index({ owner: 1, completed: 1, createdAt: -1 });

module.exports = mongoose.model('Goal', goalSchema);
