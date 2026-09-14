const mongoose = require('mongoose');
const Note = require('../models/note.model');

const getPlainPreview = (body) => String(body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

const getAttachmentMetadata = (attachment) => {
    if (!attachment) return null;

    return {
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
    };
};

const formatNote = (note) => {
    const item = note.toObject ? note.toObject() : note;

    return {
        ...item,
        attachment: item.attachment ? {
            name: item.attachment.name,
            mimeType: item.attachment.mimeType,
            size: item.attachment.size,
            data: item.attachment.data,
        } : null,
    };
};

const formatNoteSummary = (note) => {
    const item = note.toObject ? note.toObject() : note;

    return {
        _id: item._id,
        title: item.title,
        tags: item.tags || [],
        preview: getPlainPreview(item.body),
        attachment: getAttachmentMetadata(item.attachment),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
};

const normalizeTags = (tags) => {
    if (!Array.isArray(tags)) return [];

    return [...new Set(tags
        .filter((tag) => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean))];
};

const normalizeAttachment = (attachment) => {
    if (!attachment) return null;

    if (typeof attachment !== 'object' || Array.isArray(attachment)) {
        const error = new Error('Attachment must be a valid file object');
        error.statusCode = 400;
        throw error;
    }

    const { name, mimeType, size, data } = attachment;
    const normalizedMimeType = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
    if (typeof name !== 'string' || !name.trim() || !allowedMimeTypes.includes(normalizedMimeType) || typeof data !== 'string' || !data.startsWith(`data:${normalizedMimeType};base64,`)) {
        const error = new Error('Attachment data is invalid');
        error.statusCode = 400;
        throw error;
    }

    if (data.length > 5000000) {
        const error = new Error('Attachment is too large. Keep files below 3.5 MB');
        error.statusCode = 413;
        throw error;
    }

    return {
        name: name.trim(),
        mimeType: normalizedMimeType,
        size: Number.isFinite(Number(size)) ? Number(size) : 0,
        data,
    };
};

const validateNotePayload = (payload) => {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload.body === 'string' ? payload.body : '';

    if (!title) {
        const error = new Error('Note title is required');
        error.statusCode = 400;
        throw error;
    }

    return {
        title,
        body,
        tags: normalizeTags(payload.tags),
        attachment: normalizeAttachment(payload.attachment),
    };
};

const findUserNote = async (noteId, userId) => {
    if (!mongoose.isValidObjectId(noteId)) return null;
    return Note.findOne({ _id: noteId, owner: userId });
};

const getNotes = async (req, res) => {
    try {
        const notes = await Note.find({ owner: req.user._id })
            .select('title body tags attachment.name attachment.mimeType attachment.size createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Notes retrieved successfully',
            data: { notes: notes.map(formatNoteSummary) },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve notes',
            data: {},
        });
    }
};

const getNote = async (req, res) => {
    try {
        const note = await findUserNote(req.params.noteId, req.user._id);

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found',
                data: {},
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Note retrieved successfully',
            data: { note: formatNote(note) },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve the note',
            data: {},
        });
    }
};

const createNote = async (req, res) => {
    try {
        const noteData = validateNotePayload({
            title: req.body.title || 'New Note',
            body: req.body.body || '',
            tags: req.body.tags || [],
            attachment: req.body.attachment || null,
        });
        const note = await Note.create({ owner: req.user._id, ...noteData });

        return res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: { note: formatNote(note) },
        });
    } catch (error) {
        if (error.statusCode || error.name === 'ValidationError') {
            return res.status(error.statusCode || 400).json({
                success: false,
                message: error.message || Object.values(error.errors)[0].message,
                data: {},
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Unable to create the note',
            data: {},
        });
    }
};

const updateNote = async (req, res) => {
    try {
        const note = await findUserNote(req.params.noteId, req.user._id);

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found',
                data: {},
            });
        }

        const noteData = validateNotePayload(req.body);
        note.set(noteData);
        await note.save();

        return res.status(200).json({
            success: true,
            message: 'Note saved successfully',
            data: { note: formatNote(note) },
        });
    } catch (error) {
        if (error.statusCode || error.name === 'ValidationError') {
            return res.status(error.statusCode || 400).json({
                success: false,
                message: error.message || Object.values(error.errors)[0].message,
                data: {},
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Unable to save the note',
            data: {},
        });
    }
};

const deleteNote = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.noteId)) {
            return res.status(404).json({
                success: false,
                message: 'Note not found',
                data: {},
            });
        }

        const note = await Note.findOneAndDelete({ _id: req.params.noteId, owner: req.user._id });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found',
                data: {},
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Note deleted successfully',
            data: {},
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Unable to delete the note',
            data: {},
        });
    }
};

module.exports = { getNotes, getNote, createNote, updateNote, deleteNote };
