const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Topic name is required'],
            trim: true,
            maxlength: [160, 'Topic name cannot exceed 160 characters'],
        },
        completed: {
            type: Boolean,
            default: false,
        },
        dueDate: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

const subjectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Subject name is required'],
            trim: true,
            maxlength: [160, 'Subject name cannot exceed 160 characters'],
        },
        grade: {
            type: Number,
            min: [0, 'Grade cannot be less than 0'],
            max: [100, 'Grade cannot exceed 100'],
            default: null,
        },
        credits: {
            type: Number,
            min: [0.5, 'Credits must be at least 0.5'],
            max: [100, 'Credits cannot exceed 100'],
            default: null,
        },
        topics: {
            type: [topicSchema],
            default: [],
        },
    },
    { timestamps: true }
);

const semesterSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Semester name is required'],
            trim: true,
            maxlength: [120, 'Semester name cannot exceed 120 characters'],
        },
        color: {
            type: String,
            default: '#a78bfa',
            match: [/^#[0-9a-fA-F]{6}$/, 'Semester color must be a six-digit hex color'],
        },
        subjects: {
            type: [subjectSchema],
            default: [],
        },
    },
    { timestamps: true }
);

semesterSchema.index({ owner: 1, createdAt: -1 });

const Semester = mongoose.model('Semester', semesterSchema);

module.exports = Semester;
