const mongoose = require('mongoose');
const CodingSession = require('../models/codingSession.model');

const requestError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const formatSession = (session) => {
    const item = session.toObject ? session.toObject() : session;
    const { owner, ...sessionData } = item;
    return sessionData;
};

const normalizeLanguage = (value) => {
    if (typeof value !== 'string' || !value.trim()) throw requestError('Programming language is required');
    if (value.trim().length > 50) throw requestError('Programming language cannot exceed 50 characters');
    return value.trim();
};

const normalizeMinutes = (value) => {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        throw requestError('Coding duration must be a whole number between 1 and 1440 minutes');
    }
    return minutes;
};

const normalizeDate = (value) => {
    if (value === undefined || value === null || value === '') return new Date();
    if (typeof value !== 'string') throw requestError('Session date must be a valid date');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw requestError('Session date must be a valid date');
    return date;
};

const normalizeSubject = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw requestError('Subject must be text');
    if (value.trim().length > 160) throw requestError('Subject cannot exceed 160 characters');
    return value.trim() || null;
};

const normalizeSource = (value) => {
    if (value === undefined || value === null || value === '') return 'manual';
    if (!['timer', 'pomodoro', 'manual'].includes(value)) {
        throw requestError('Session source must be timer, pomodoro, or manual');
    }
    return value;
};

const handleControllerError = (res, error, fallbackMessage) => res.status(error.statusCode || (error.name === 'ValidationError' ? 400 : 500)).json({
    success: false,
    message: error.statusCode || error.name === 'ValidationError' ? error.message : fallbackMessage,
    data: {},
});

const getCodingSessions = async (req, res) => {
    try {
        const sessions = await CodingSession.find({ owner: req.user._id }).sort({ date: -1, createdAt: -1 });
        return res.status(200).json({
            success: true,
            message: 'Coding sessions retrieved successfully',
            data: { sessions: sessions.map(formatSession) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to retrieve coding sessions');
    }
};

const createCodingSession = async (req, res) => {
    try {
        const session = await CodingSession.create({
            owner: req.user._id,
            language: normalizeLanguage(req.body.language),
            minutes: normalizeMinutes(req.body.minutes),
            date: normalizeDate(req.body.date),
            subject: normalizeSubject(req.body.subject),
            source: normalizeSource(req.body.source),
        });

        return res.status(201).json({
            success: true,
            message: 'Coding session logged successfully',
            data: { session: formatSession(session) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to log coding session');
    }
};

const deleteCodingSession = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.sessionId)) {
            return res.status(404).json({ success: false, message: 'Coding session not found', data: {} });
        }

        const session = await CodingSession.findOneAndDelete({ _id: req.params.sessionId, owner: req.user._id });
        if (!session) return res.status(404).json({ success: false, message: 'Coding session not found', data: {} });

        return res.status(200).json({
            success: true,
            message: 'Coding session deleted successfully',
            data: {},
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to delete coding session');
    }
};

module.exports = { getCodingSessions, createCodingSession, deleteCodingSession };
