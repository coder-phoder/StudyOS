const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        text: {
            type: String,
            required: [true, 'Task text is required'],
            trim: true,
            maxlength: [300, 'Task text cannot exceed 300 characters'],
        },
        completed: {
            type: Boolean,
            default: false,
        },
        priority: {
            type: String,
            enum: {
                values: ['high', 'medium', 'low'],
                message: 'Priority must be high, medium, or low',
            },
            default: 'medium',
        },
        recurrence: {
            type: String,
            enum: {
                values: ['daily', 'weekly', 'monthly', null],
                message: 'Recurrence must be daily, weekly, monthly, or empty',
            },
            default: null,
        },
        lastCompleted: {
            type: Date,
            default: null,
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

todoSchema.index({ owner: 1, completed: 1, order: 1, createdAt: 1 });

module.exports = mongoose.model('Todo', todoSchema);
