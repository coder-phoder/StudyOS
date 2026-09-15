const mongoose = require('mongoose');
const CalendarEvent = require('../models/calendarEvent.model');

const requestError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const isValidDateKey = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const normalizeDate = (value) => {
    if (!isValidDateKey(value)) throw requestError('Event date must be a valid YYYY-MM-DD date');
    return value;
};

const normalizeSubject = (value) => {
    if (typeof value !== 'string' || !value.trim()) throw requestError('Subject or event name is required');
    return value.trim();
};

const normalizeTime = (value) => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        throw requestError('Event time must use the HH:MM format');
    }
    return value;
};

const normalizeRoom = (value) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw requestError('Room must be text');
    return value.trim();
};

const normalizeBoolean = (value, label) => {
    if (typeof value !== 'boolean') throw requestError(`${label} must be true or false`);
    return value;
};

const normalizeRepeatWeeks = (value) => {
    if (value === undefined || value === null || value === '') return 8;
    const weeks = Number(value);
    if (!Number.isInteger(weeks) || ![4, 8, 12, 16].includes(weeks)) {
        throw requestError('Repeat duration must be 4, 8, 12, or 16 weeks');
    }
    return weeks;
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const formatEvent = (event) => {
    const item = event.toObject ? event.toObject() : event;
    const { owner, ...eventData } = item;
    return eventData;
};

const handleControllerError = (res, error, fallbackMessage) => res.status(error.statusCode || (error.name === 'ValidationError' ? 400 : 500)).json({
    success: false,
    message: error.statusCode || error.name === 'ValidationError' ? error.message : fallbackMessage,
    data: {},
});

const getCalendarEvents = async (req, res) => {
    try {
        const filter = { owner: req.user._id };
        if (req.query.from !== undefined) filter.date = { $gte: normalizeDate(req.query.from) };
        if (req.query.to !== undefined) {
            const to = normalizeDate(req.query.to);
            filter.date = { ...(filter.date || {}), $lte: to };
        }
        if (filter.date?.$gte && filter.date?.$lte && filter.date.$gte > filter.date.$lte) {
            throw requestError('The date range is invalid');
        }

        const events = await CalendarEvent.find(filter).sort({ date: 1, time: 1, createdAt: 1 });
        return res.status(200).json({
            success: true,
            message: 'Calendar events retrieved successfully',
            data: { events: events.map(formatEvent) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to retrieve calendar events');
    }
};

const createCalendarEvents = async (req, res) => {
    try {
        const date = normalizeDate(req.body.date);
        const subject = normalizeSubject(req.body.subject);
        const time = normalizeTime(req.body.time);
        const room = normalizeRoom(req.body.room);
        const isExam = req.body.isExam === undefined ? false : normalizeBoolean(req.body.isExam, 'Exam setting');
        const recurring = req.body.recurring === undefined ? false : normalizeBoolean(req.body.recurring, 'Recurring setting');
        const occurrences = recurring ? normalizeRepeatWeeks(req.body.repeatWeeks) : 1;
        const [year, month, day] = date.split('-').map(Number);
        const firstDate = new Date(Date.UTC(year, month - 1, day));
        const eventData = Array.from({ length: occurrences }, (_, index) => {
            const occurrenceDate = new Date(firstDate);
            occurrenceDate.setUTCDate(firstDate.getUTCDate() + (index * 7));
            return {
                owner: req.user._id,
                date: toDateKey(occurrenceDate),
                subject,
                time,
                room,
                isExam: isExam && index === 0,
                recurring,
            };
        });
        const events = await CalendarEvent.insertMany(eventData);

        return res.status(201).json({
            success: true,
            message: recurring ? 'Recurring calendar events created successfully' : 'Calendar event created successfully',
            data: { events: events.map(formatEvent) },
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to create calendar event');
    }
};

const deleteCalendarEvent = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.eventId)) {
            return res.status(404).json({ success: false, message: 'Calendar event not found', data: {} });
        }

        const event = await CalendarEvent.findOneAndDelete({ _id: req.params.eventId, owner: req.user._id });
        if (!event) return res.status(404).json({ success: false, message: 'Calendar event not found', data: {} });

        return res.status(200).json({
            success: true,
            message: 'Calendar event deleted successfully',
            data: {},
        });
    } catch (error) {
        return handleControllerError(res, error, 'Unable to delete calendar event');
    }
};

module.exports = { getCalendarEvents, createCalendarEvents, deleteCalendarEvent };
