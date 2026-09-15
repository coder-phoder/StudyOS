const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        date: {
            type: String,
            required: [true, 'Event date is required'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Event date must use the YYYY-MM-DD format'],
        },
        subject: {
            type: String,
            required: [true, 'Subject or event name is required'],
            trim: true,
            maxlength: [180, 'Subject or event name cannot exceed 180 characters'],
        },
        time: {
            type: String,
            default: '',
            match: [/^$|^([01]\d|2[0-3]):[0-5]\d$/, 'Event time must use the HH:MM format'],
        },
        room: {
            type: String,
            default: '',
            trim: true,
            maxlength: [100, 'Room cannot exceed 100 characters'],
        },
        isExam: {
            type: Boolean,
            default: false,
        },
        recurring: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

calendarEventSchema.index({ owner: 1, date: 1, time: 1, createdAt: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
