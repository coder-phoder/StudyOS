const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            maxlength: [255, 'Attachment name cannot exceed 255 characters'],
        },
        mimeType: {
            type: String,
            trim: true,
            maxlength: [100, 'Attachment type cannot exceed 100 characters'],
        },
        size: {
            type: Number,
            min: [0, 'Attachment size cannot be negative'],
        },
        data: {
            type: String,
            maxlength: [5000000, 'Attachment is too large'],
        },
    },
    { _id: false }
);

const noteSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: {
            type: String,
            trim: true,
            required: [true, 'Note title is required'],
            maxlength: [160, 'Note title cannot exceed 160 characters'],
        },
        body: {
            type: String,
            default: '',
            maxlength: [200000, 'Note content cannot exceed 200,000 characters'],
        },
        tags: {
            type: [
                {
                    type: String,
                    trim: true,
                    maxlength: [50, 'Each tag cannot exceed 50 characters'],
                },
            ],
            default: [],
            validate: {
                validator: (tags) => tags.length <= 20,
                message: 'A note can have at most 20 tags',
            },
        },
        attachment: {
            type: attachmentSchema,
            default: null,
        },
    },
    { timestamps: true }
);

noteSchema.index({ owner: 1, updatedAt: -1 });

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
